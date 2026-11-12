// Voice-over per line (AU-1, mock-up 13): one take per row, recorded in the browser and kept in the script's folder
// as voice/row-<id>.webm, beside voice/row-<id>.json (who, when, how long). By the row's id, so moving a row keeps
// its take. OneDrive shares them like any asset; nothing is uploaded anywhere else.
import { cleaning, measure, span, type Measure } from './cleanup.svelte';
import { chosenMic, openMic } from './mic';
import { countWords } from './readtime.svelte';
import { decoder } from './voiceexport';

// text: the dialogue as it was read, so a take whose line has changed since shows as outdated (asked by the user).
// seconds: the whole recording, as timed. from, to and gain: where the speech is and how loud (AU-4), measured when
// it was recorded; a take from before, or with nothing heard, has none and plays whole.
export type Take = { by: string; at: number; seconds: number; text: string } & Partial<Measure>;
// fellBack: the mic picked in Settings wasn't there, so the default is recording (AU-3).
export type Recording = { stop: () => Promise<Blob>; fellBack?: boolean };

const FOLDER = 'voice';
const CUE = 1000; // ms the ring takes to fill before the cue to read

// A recording from the microphone picked in Settings (or the default). Tests stand in for it, and are handed the
// picked mic's id (tests/e2e/voice.spec.ts, settings.spec.ts).
export async function record(): Promise<Recording> {
  const id = chosenMic().id;
  const fake = (window as unknown as { studioRecord?: (mic: string, noise: boolean) => Promise<Recording> }).studioRecord;
  if (fake) return fake(id, cleaning.noise);
  const { stream, fellBack } = await openMic(id, (c) => navigator.mediaDevices.getUserMedia(c), cleaning.noise);
  const recorder = new MediaRecorder(stream);
  const parts: Blob[] = [];
  recorder.ondataavailable = (e) => e.data.size && parts.push(e.data);
  recorder.start();
  return {
    fellBack,
    stop: () =>
      new Promise((resolve) => {
        recorder.onstop = () => {
          stream.getTracks().forEach((t) => t.stop());
          resolve(new Blob(parts, { type: recorder.mimeType || 'audio/webm' }));
        };
        recorder.stop();
      }),
  };
}

// A take is outdated once its row's dialogue no longer reads as it did (spaces at the ends don't count).
export function outdated(take: Take, dialogue: string): boolean {
  return take.text.trim() !== dialogue.trim();
}

// Words a minute of a take: the words it read (its `text`), not the row as it reads now, so editing the line
// doesn't change the figure. `dialogue` only stands in for a take saved without its text. 0 when nothing to measure.
// Over the cropped length when cropping is on.
export function wpm(take: Take, dialogue: string): number {
  const words = countWords(take.text.trim() ? take.text : dialogue);
  const seconds = span(take).seconds;
  return words && seconds > 0 ? Math.round((words / seconds) * 60) : 0;
}

// How long a take plays: cropped or whole, as set in Settings.
export const takeLength = (take: Take): number => span(take).seconds;

// A take's sound, ready to play its cropped part at its gain (as set in Settings). Through Web Audio, so the crop is
// exact and the gain can go above 1. Pause and carry on by suspending its own context.
export class Sound {
  onended: (() => void) | null = null;
  duration: number; // seconds it plays
  #ctx: AudioContext;
  #source: AudioBufferSourceNode;
  #from: number;
  #started = false;
  #at = 0; // the context's time when it started

  private constructor(ctx: AudioContext, buffer: AudioBuffer, take: Take) {
    const { from, to, gain } = span(take);
    this.#ctx = ctx;
    this.#from = from;
    this.duration = Math.max(0, Math.min(buffer.duration, to ?? buffer.duration) - from);
    const level = ctx.createGain();
    level.gain.value = gain;
    level.connect(ctx.destination);
    this.#source = ctx.createBufferSource();
    this.#source.buffer = buffer;
    this.#source.connect(level);
    this.#source.onended = () => this.onended?.();
  }

  // Throws when the file can't be read or decoded (still syncing).
  static async open(file: File, take: Take): Promise<Sound> {
    const ctx = new AudioContext();
    try {
      return new Sound(ctx, await ctx.decodeAudioData(await file.arrayBuffer()), take);
    } catch (e) {
      ctx.close();
      throw e;
    }
  }

  // Seconds into the take.
  get time() { return this.#started ? Math.min(this.duration, this.#ctx.currentTime - this.#at) : 0; }

  async play() {
    if (!this.#started) {
      this.#started = true;
      this.#at = this.#ctx.currentTime;
      this.#source.start(0, this.#from, this.duration);
    }
    await this.#ctx.resume();
  }

  pause() { this.#ctx.suspend(); }

  close() {
    this.onended = null;
    this.#source.onended = null;
    this.#ctx.close().catch(() => {});
  }
}

// Where the speech is in a recording and how loud, or null when it can't be read or nothing is heard.
async function measureTake(blob: Blob): Promise<Measure | null> {
  try {
    const rate = 16000;
    return measure(await decoder(rate)(await blob.arrayBuffer()), rate);
  } catch {
    return null;
  }
}

// The sound of a row's take. Throws when there is none (or it hasn't synced yet).
export async function takeFile(dir: FileSystemDirectoryHandle, id: string): Promise<File> {
  return (await (await dir.getDirectoryHandle(FOLDER)).getFileHandle(`row-${id}.webm`)).getFile();
}

// The takes in a script's folder, by row id (the script list reads them too, for each script's length).
export async function readTakes(dir: FileSystemDirectoryHandle): Promise<Record<string, Take>> {
  const takes: Record<string, Take> = {};
  try {
    const voice = await dir.getDirectoryHandle(FOLDER);
    for await (const [name, handle] of voice.entries()) {
      const id = name.match(/^row-(.+)\.json$/)?.[1];
      if (!id || handle.kind !== 'file') continue;
      try {
        const take = JSON.parse(await (await (handle as FileSystemFileHandle).getFile()).text());
        if (typeof take.seconds !== 'number') continue;
        takes[id] = { by: String(take.by ?? ''), at: Number(take.at) || 0, seconds: take.seconds, text: String(take.text ?? '') };
        if ([take.from, take.to, take.gain].every((n) => typeof n === 'number')) Object.assign(takes[id], { from: take.from, to: take.to, gain: take.gain });
      } catch {
        // Half-synced: read next time.
      }
    }
  } catch {
    // No voice folder yet.
  }
  return takes;
}

// The takes' speed together, in words a minute (Settings offers it as the speaking speed, AP-12). 0 with none.
export function takesSpeed(takes: Record<string, Take>): number {
  let words = 0;
  let seconds = 0;
  for (const take of Object.values(takes)) {
    const n = countWords(take.text);
    const length = takeLength(take);
    if (n && length > 0) (words += n), (seconds += length);
  }
  return seconds ? Math.round((words / seconds) * 60) : 0;
}

// The takes in a script's folder, by row id. Kept as state: the Editor makes one, Write and the top bar read it.
export class VoiceOver {
  takes = $state<Record<string, Take>>({});
  recording = $state(''); // the row being recorded
  started = $state(0); // when it started (ms), for the running clock
  cue = $state(false); // the first second of a take, before the cue to read (AU-4)
  playing = $state(''); // the row being played
  at = $state(0); // how far it has played, 0 to 1
  #take: Recording | null = null;
  #sound: Sound | null = null;
  #cue: ReturnType<typeof setTimeout> | undefined;

  async load(dir: FileSystemDirectoryHandle) {
    const next = await readTakes(dir);
    if (JSON.stringify(next) !== JSON.stringify(this.takes)) this.takes = next;
  }

  // True when the mic picked in Settings wasn't there and the default is recording instead.
  async start(id: string): Promise<boolean> {
    this.stopPlaying();
    this.#take = await record();
    this.recording = id;
    this.started = Date.now();
    // Recording from the click; a ring fills around the mic for a second, then it turns into ■, the cue to read.
    // The second before is cropped off with the rest of the silence.
    this.cue = true;
    clearTimeout(this.#cue);
    this.#cue = setTimeout(() => (this.cue = false), CUE);
    return !!this.#take.fellBack;
  }

  // Esc while the ring fills: the new take is thrown away and the old one kept.
  async cancel() {
    const take = this.#take;
    this.#take = null;
    this.#end();
    await take?.stop().catch(() => {});
  }

  #end() {
    clearTimeout(this.#cue);
    this.cue = false;
    this.recording = '';
  }

  // text: the row's dialogue now, kept with the take.
  async stop(dir: FileSystemDirectoryHandle, by: string, text: string) {
    const id = this.recording;
    if (!id || !this.#take) return;
    const seconds = Math.max(0.1, (Date.now() - this.started) / 1000);
    const blob = await this.#take.stop();
    this.#take = null;
    this.#end();
    const take: Take = { by, at: Date.now(), seconds: Math.round(seconds * 10) / 10, text };
    const found = await measureTake(blob);
    if (found) Object.assign(take, found);
    const voice = await dir.getDirectoryHandle(FOLDER, { create: true });
    await write(voice, `row-${id}.webm`, blob);
    await write(voice, `row-${id}.json`, JSON.stringify(take));
    this.takes = { ...this.takes, [id]: take };
  }

  async play(dir: FileSystemDirectoryHandle, id: string) {
    if (this.playing === id) return this.stopPlaying();
    this.stopPlaying();
    const take = this.takes[id];
    const sound = await Sound.open(await takeFile(dir, id), take ?? { by: '', at: 0, seconds: 0, text: '' });
    if (this.#sound) this.#sound.close(); // another click while this one loaded
    this.#sound = sound;
    const tick = setInterval(() => (this.at = sound.duration ? Math.min(1, sound.time / sound.duration) : 0), 100);
    sound.onended = () => this.stopPlaying();
    this.#tick = tick;
    this.playing = id;
    this.at = 0;
    await sound.play();
  }

  #tick: ReturnType<typeof setInterval> | undefined;

  stopPlaying() {
    clearInterval(this.#tick);
    this.#sound?.close();
    this.#sound = null;
    this.playing = '';
    this.at = 0;
  }

  async remove(dir: FileSystemDirectoryHandle, id: string) {
    if (this.playing === id) this.stopPlaying();
    const voice = await dir.getDirectoryHandle(FOLDER);
    for (const name of [`row-${id}.webm`, `row-${id}.json`]) await voice.removeEntry(name).catch(() => {});
    const { [id]: _, ...rest } = this.takes;
    this.takes = rest;
  }
}

async function write(dir: FileSystemDirectoryHandle, name: string, data: Blob | string) {
  const writable = await (await dir.getFileHandle(name, { create: true })).createWritable();
  await writable.write(data);
  await writable.close();
}
