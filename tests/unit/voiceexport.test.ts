import { describe, expect, it } from 'vitest';
import { join, wav } from '../../src/lib/voiceexport';

describe('join', () => {
  const clips = [{ row: 1, samples: new Float32Array([0.1, 0.2]) }, { row: 3, samples: new Float32Array([0.3]) }];
  it('puts the clips one after another', () => {
    expect([...join(clips, 4, 0)].map((v) => +v.toFixed(1))).toEqual([0.1, 0.2, 0.3]);
  });
  it('leaves a silence between clips, not after the last', () => {
    expect([...join(clips, 4, 0.5)].map((v) => +v.toFixed(1))).toEqual([0.1, 0.2, 0, 0, 0.3]);
  });
});

describe('wav', () => {
  it('is a mono 16-bit WAV at the rate, clipped to full scale', () => {
    const bytes = wav(new Float32Array([0, 1, -1, 2]), 48000);
    const view = new DataView(bytes.buffer);
    expect(String.fromCharCode(...bytes.subarray(0, 4), ...bytes.subarray(8, 12))).toBe('RIFFWAVE');
    expect([view.getUint16(22, true), view.getUint32(24, true), view.getUint16(34, true), view.getUint32(40, true)]).toEqual([1, 48000, 16, 8]);
    expect([0, 1, 2, 3].map((i) => view.getInt16(44 + i * 2, true))).toEqual([0, 32767, -32768, 32767]);
  });
});
