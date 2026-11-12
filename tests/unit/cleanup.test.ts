import { describe, expect, it } from 'vitest';
import { measure, span } from '../../src/lib/cleanup.svelte';
import { cleaned } from '../../src/lib/voiceexport';
import { plan } from '../../src/lib/play.svelte';
import { wpm } from '../../src/lib/voice.svelte';
import type { Script } from '../../src/lib/script';

const RATE = 8000;

// A recording made of parts: [seconds, loudness] (0 is silence, with a little hiss), as a tone.
function sound(parts: [number, number][]): Float32Array {
  const out: number[] = [];
  for (const [seconds, level] of parts)
    for (let i = 0; i < seconds * RATE; i++) out.push(level * Math.sin(i / 3) + (Math.random() - 0.5) * 0.0004);
  return Float32Array.from(out);
}

describe('measure', () => {
  it('finds the speech, keeping a quarter second either side', () => {
    const m = measure(sound([[1, 0], [2, 0.3], [1.5, 0]]), RATE)!;
    expect(m.from).toBeCloseTo(0.75, 1);
    expect(m.to).toBeCloseTo(3.25, 1);
  });

  it('keeps pauses in the middle and never cuts past the ends', () => {
    const m = measure(sound([[0.1, 0], [1, 0.3], [1.2, 0], [1, 0.3], [0.1, 0]]), RATE)!;
    expect(m.from).toBe(0);
    expect(m.to).toBeCloseTo(3.4, 1);
  });

  it('drops a mouse click at the end', () => {
    const m = measure(sound([[0.5, 0], [1, 0.3], [1, 0], [0.02, 0.6], [0.3, 0]]), RATE)!;
    expect(m.to).toBeCloseTo(1.75, 1);
  });

  it('makes a quiet take louder and a loud one quieter, without clipping', () => {
    const quiet = measure(sound([[0.5, 0], [1, 0.02], [0.5, 0]]), RATE)!;
    const loud = measure(sound([[0.5, 0], [1, 0.8], [0.5, 0]]), RATE)!;
    expect(quiet.gain).toBeGreaterThan(1);
    expect(loud.gain).toBeLessThan(1);
    expect(quiet.gain * 0.02).toBeLessThanOrEqual(0.9);
  });

  it('crops in a noisy room: hiss, a breath and rustles before the first word are not speech', () => {
    const noisy = (parts: [number, number][]) => sound(parts).map((v) => v + (Math.random() - 0.5) * 0.03);
    const m = measure(noisy([[0.6, 0], [0.12, 0.05], [0.5, 0], [0.3, 0.02], [0.4, 0], [1.5, 0.3], [0.8, 0], [0.1, 0.04], [0.4, 0]]), RATE)!;
    expect(m.from).toBeCloseTo(1.65, 1);
    expect(m.to).toBeCloseTo(3.65, 1);
  });

  it('finds nothing in silence', () => {
    expect(measure(sound([[1, 0]]), RATE)).toBeNull();
    expect(measure(new Float32Array(0), RATE)).toBeNull();
  });
});

describe('span', () => {
  const take = { seconds: 5, from: 1, to: 3.5, gain: 2 };
  const all = { crop: true, noise: true, level: true };

  it('plays the measured part at its gain', () => {
    expect(span(take, all)).toEqual({ from: 1, to: 3.5, gain: 2, seconds: 2.5, cut: 2.5 });
  });

  it('plays the whole take with the switches off, or a take that was never measured', () => {
    expect(span(take, { ...all, crop: false, level: false })).toEqual({ from: 0, to: null, gain: 1, seconds: 5, cut: 0 });
    expect(span({ seconds: 5 }, all)).toEqual({ from: 0, to: null, gain: 1, seconds: 5, cut: 0 });
  });

  it('times the take, its words a minute and Play the script by the cropped part', () => {
    const t = { by: 'Sam', at: 0, seconds: 6, text: 'one two three four five', from: 0.5, to: 2.5, gain: 1 };
    expect(wpm(t, '')).toBe(150); // 5 words in 2 s
    const script: Script = { front: null, intro: '', blocks: [{ type: 'row', id: 'a', dialogue: 'one two three four five', onScreen: '', files: [], note: '' }] };
    expect(plan(script, { a: t }, 150)[0].seconds).toBe(2);
  });
});

describe('cleaned', () => {
  it('cuts the samples and applies the gain, as the joined WAV does', () => {
    const samples = Float32Array.from({ length: 40 }, () => 0.1);
    const out = cleaned(samples, { seconds: 4, from: 1, to: 3, gain: 2 }, 10);
    expect(out.length).toBe(20);
    expect(out[0]).toBeCloseTo(0.2);
  });
});
