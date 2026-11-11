// Voice-over per line (AU-1, mock-up 13): one take per row, recorded in the browser and kept in the script's folder
// as voice/row-<id>.webm, beside voice/row-<id>.json (who, when, how long). By the row's id, so moving a row keeps
// its take. OneDrive shares them like any asset; nothing is uploaded anywhere else.
import { countWords } from './readtime';

// text: the dialogue as it was read, so a take whose line has changed since shows as outdated (asked by the user).
export type Take = { by: string; at: number; seconds: number; text: string };
export type Recording = { stop: () => Promise<Blob> };

const FOLDER = 'voice';

// A recording from the microphone. Tests stand in for it (tests/e2e/voice.spec.ts).
export async function record(): Promise<Recording> {
  const fake = (window as unknown as { studioRecord?: () => Promise<Recording> }).studioRecord;
  if (fake) return fake();
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  const recorder = new MediaRecorder(stream);
  const parts: Blob[] = [];
  recorder.ondataavailable = (e) => e.data.size && parts.push(e.data);
  recorder.start();
  return {
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
export function wpm(take: Take, dialogue: string): number {
  const words = countWords(take.text.trim() ? take.text : dialogue);
  return words && take.seconds > 0 ? Math.round((words / take.seconds) * 60) : 0;
}

// The sound of a row's take. Throws when there is none (or it hasn't synced yet).
export async function takeFile(dir: FileSystemDirectoryHandle, id: string): Promise<File> {
  return (await (await dir.getDirectoryHandle(FOLDER)).getFileHandle(`row-${id}.webm`)).getFile();
}

// The takes in a script's folder, by row id. Kept as state: the Editor makes one, Write and the top bar read it.
export class VoiceOver {
  takes = $state<Record<string, Take>>({});
  recording = $state(''); // the row being recorded
  started = $state(0); // when it started (ms), for the running clock
  playing = $state(''); // the row being played
  at = $state(0); // how far it has played, 0 to 1
  #take: Recording | null = null;
  #audio: HTMLAudioElement | null = null;

  async load(dir: FileSystemDirectoryHandle) {
    const next: Record<string, Take> = {};
    try {
      const voice = await dir.getDirectoryHandle(FOLDER);
      for await (const [name, handle] of voice.entries()) {
        const id = name.match(/^row-(.+)\.json$/)?.[1];
        if (!id || handle.kind !== 'file') continue;
        try {
          const take = JSON.parse(await (await (handle as FileSystemFileHandle).getFile()).text());
          if (typeof take.seconds === 'number') next[id] = { by: String(take.by ?? ''), at: Number(take.at) || 0, seconds: take.seconds, text: String(take.text ?? '') };
        } catch {
          // Half-synced: read next time.
        }
      }
    } catch {
      // No voice folder yet.
    }
    if (JSON.stringify(next) !== JSON.stringify(this.takes)) this.takes = next;
  }

  async start(id: string) {
    this.stopPlaying();
    this.#take = await record();
    this.recording = id;
    this.started = Date.now();
  }

  // text: the row's dialogue now, kept with the take.
  async stop(dir: FileSystemDirectoryHandle, by: string, text: string) {
    const id = this.recording;
    if (!id || !this.#take) return;
    const seconds = Math.max(0.1, (Date.now() - this.started) / 1000);
    const blob = await this.#take.stop();
    this.#take = null;
    this.recording = '';
    const take: Take = { by, at: Date.now(), seconds: Math.round(seconds * 10) / 10, text };
    const voice = await dir.getDirectoryHandle(FOLDER, { create: true });
    await write(voice, `row-${id}.webm`, blob);
    await write(voice, `row-${id}.json`, JSON.stringify(take));
    this.takes = { ...this.takes, [id]: take };
  }

  async play(dir: FileSystemDirectoryHandle, id: string) {
    if (this.playing === id) return this.stopPlaying();
    this.stopPlaying();
    const url = URL.createObjectURL(await takeFile(dir, id));
    const audio = (this.#audio = new Audio(url));
    const seconds = this.takes[id]?.seconds || 1;
    audio.ontimeupdate = () => (this.at = Math.min(1, audio.currentTime / seconds));
    audio.onended = () => this.stopPlaying();
    this.playing = id;
    this.at = 0;
    audio.onpause = () => URL.revokeObjectURL(url);
    await audio.play();
  }

  stopPlaying() {
    this.#audio?.pause();
    this.#audio = null;
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
