import { describe, expect, it } from 'vitest';
import { resample } from '../../src/lib/listen';

describe('resample', () => {
  it('brings 48 kHz down to 16 kHz, keeping its place across pieces', () => {
    const ramp = (from: number, n: number) => Float32Array.from({ length: n }, (_, i) => from + i);
    const [a, carry] = resample(ramp(0, 128), 3, 0);
    expect(a.length).toBe(43);
    expect(a[1]).toBe(3);
    expect(carry).toBe(1); // sample 43 falls at 129, the second of the next piece
    const [b] = resample(ramp(128, 128), 3, carry);
    expect(b[0]).toBe(129);
  });
  it('interpolates between samples at 44.1 kHz', () => {
    const [out] = resample(Float32Array.from([0, 10, 20, 30]), 2.75625, 0);
    expect(out[1]).toBeCloseTo(27.5625, 3);
  });
});
