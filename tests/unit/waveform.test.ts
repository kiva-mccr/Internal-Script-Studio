import { describe, expect, it } from 'vitest';
import { peaksOf, wavePath } from '../../src/lib/waveform';

describe('waveform', () => {
  it('takes the loudest sample of each part, the loudest part as 1', () => {
    const samples = new Float32Array([0.1, -0.2, 0.4, -0.1, 0, 0.05, -0.8, 0.2]);
    expect(peaksOf(samples, 4).map((p) => +p.toFixed(3))).toEqual([0.25, 0.5, 0.063, 1]);
  });

  it('never makes more bars than samples', () => {
    expect(peaksOf(new Float32Array([0.5, 0.5]), 200)).toHaveLength(2);
  });

  it('draws one bar per peak around the middle', () => {
    expect(wavePath([1, 0])).toBe('M25.00 2.0V38.0M75.00 19.4V20.6');
  });
});
