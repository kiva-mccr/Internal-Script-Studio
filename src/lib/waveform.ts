// A take's waveform for the storyboard timeline (SB-1): its loudest moments in a few hundred bars, cropped as it
// plays (lib/voiceexport.ts cleaned), made once per take and kept for the visit.
import { decoder, cleaned } from './voiceexport';
import { takeFile, type Take } from './voice.svelte';

const RATE = 8000; // enough to see speech, quick to decode
const made = new Map<string, Promise<number[] | null>>();

// Up to `bars` peaks from 0 to 1, or null when the take can't be read (still syncing).
export function waveform(dir: FileSystemDirectoryHandle, id: string, take: Take, bars = 200): Promise<number[] | null> {
  const key = `${id}:${take.at}:${take.from ?? ''}:${take.to ?? ''}`;
  let peaks = made.get(key);
  if (!peaks) {
    peaks = takeFile(dir, id)
      .then(async (file) => peaksOf(cleaned(await decoder(RATE)(await file.arrayBuffer()), take, RATE), bars))
      .catch(() => null);
    made.set(key, peaks);
  }
  return peaks;
}

// The loudest sample in each of `bars` equal parts, scaled so the loudest part is 1.
export function peaksOf(samples: Float32Array, bars: number): number[] {
  const n = Math.max(1, Math.min(bars, samples.length));
  const size = samples.length / n;
  const peaks: number[] = [];
  for (let b = 0; b < n; b++) {
    let top = 0;
    for (let i = Math.floor(b * size); i < Math.floor((b + 1) * size); i++) top = Math.max(top, Math.abs(samples[i]));
    peaks.push(top);
  }
  const loudest = Math.max(...peaks, 1e-6);
  return peaks.map((p) => p / loudest);
}

// An SVG path of vertical bars in a 100 × 40 box, the middle at 20.
export function wavePath(peaks: number[]): string {
  return peaks
    .map((p, i) => {
      const x = (((i + 0.5) / peaks.length) * 100).toFixed(2);
      const h = Math.max(0.6, p * 18).toFixed(1);
      return `M${x} ${(20 - +h).toFixed(1)}V${(20 + +h).toFixed(1)}`;
    })
    .join('');
}
