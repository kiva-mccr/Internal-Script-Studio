// Clean-up for voice-over takes (AU-4, board 31): crop the silence at a take's start and end, and make every take
// equally loud. The recording is kept whole: `measure` finds where the speech is and how loud, the take's JSON keeps
// that, and `span` applies it when a take is played, joined or timed. The switches live in Settings, in this browser.
import { keep, recall } from './remember';

// Where to cut (seconds into the recording) and how much louder to play it.
export type Measure = { from: number; to: number; gain: number };

const KEY = 'voice-cleanup';
const PAD = 0.25; // seconds kept either side of the speech, so words never start abruptly
const FRAME = 0.01; // seconds per loudness reading
const JOIN = 0.25; // gaps shorter than this are inside the speech
const SOUND = 0.15; // a sound shorter than this on its own (a mouse click, a breath) isn't speech
const TARGET = 0.1; // the speech's loudness to aim for (RMS, about -20 dBFS)
const CEILING = 0.9; // the loudest sample never goes past this

// crop and level are applied when played, so they change every measured take at once; noise is Chrome's own noise
// reduction while recording, so it only changes takes recorded after.
export const cleaning = $state(load());

function load(): { crop: boolean; noise: boolean; level: boolean } {
  const on = { crop: true, noise: true, level: true };
  try {
    return { ...on, ...JSON.parse(recall(KEY) || '{}') };
  } catch {
    return on;
  }
}

export function setCleaning(change: Partial<typeof cleaning>): void {
  Object.assign(cleaning, change);
  keep(KEY, JSON.stringify(cleaning));
}

// Where the speech is in a recording (mono samples at `rate`) and how loud it is. null when nothing is heard.
export function measure(samples: Float32Array, rate: number): Measure | null {
  const size = Math.max(1, Math.round(rate * FRAME));
  const levels: number[] = [];
  for (let at = 0; at + size <= samples.length; at += size) {
    let sum = 0;
    for (let i = at; i < at + size; i++) sum += samples[i] * samples[i];
    levels.push(Math.sqrt(sum / size));
  }
  if (!levels.length) return null;
  const peak = Math.max(...levels);
  if (peak < 0.001) return null; // silence (about -60 dBFS)
  // "Loud" is measured against the voice, not the peak (a click can be the peak) or only the room's noise (which sat
  // just under it, so breaths and rustles counted as speech and nothing was cut): a tenth of the voice's level
  // (-20 dB), and well over the quietest tenth.
  const sorted = [...levels].sort((a, b) => a - b);
  const floor = sorted[Math.floor(levels.length / 10)];
  const voice = sorted[Math.floor(levels.length * 0.95)];
  const loud = Math.max(floor * 4, voice * 0.1, 0.001);
  // Runs of loud frames, joined across short gaps; the speech is from the first long one to the last.
  const runs: [number, number][] = [];
  levels.forEach((level, i) => {
    if (level < loud) return;
    const last = runs.at(-1);
    if (last && (i - last[1]) * FRAME <= JOIN) last[1] = i + 1;
    else runs.push([i, i + 1]);
  });
  const speech = runs.filter(([a, b]) => (b - a) * FRAME >= SOUND);
  if (!speech.length) return null;
  const first = speech[0][0];
  const last = speech.at(-1)![1];
  const length = samples.length / rate;
  // Loudness of the speech alone (its loud frames), and the gain to bring it to TARGET without clipping.
  let power = 0;
  let count = 0;
  for (let i = first; i < last; i++) if (levels[i] >= loud) (power += levels[i] ** 2), count++;
  let top = 0;
  for (let i = first * size; i < Math.min(samples.length, last * size); i++) top = Math.max(top, Math.abs(samples[i]));
  const gain = Math.min(TARGET / Math.sqrt(power / count), CEILING / top, 8);
  return {
    from: round(Math.max(0, first * FRAME - PAD), 100),
    to: round(Math.min(length, last * FRAME + PAD), 100),
    gain: round(Math.max(0.25, gain), 100),
  };
}

// What to play of a take, as set in Settings: the whole recording (`seconds` long, as timed) or its measured part.
// to is null for "to the end".
export function span(take: { seconds: number } & Partial<Measure>, how = cleaning) {
  const cropped = how.crop && take.to !== undefined && take.from !== undefined;
  const from = cropped ? take.from! : 0;
  const to = cropped ? take.to! : null;
  return {
    from,
    to,
    gain: how.level && take.gain ? take.gain : 1,
    seconds: cropped ? round(to! - from, 10) : take.seconds,
    cut: cropped ? Math.max(0, round(take.seconds - (to! - from), 10)) : 0,
  };
}

const round = (n: number, by: number) => Math.round(n * by) / by;
