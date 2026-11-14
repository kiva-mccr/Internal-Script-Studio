import { describe, expect, it } from 'vitest';
import { hash, length, type Counts } from '../../src/lib/scriptlist.svelte';

const counts = (takeSeconds: number, words: number): Counts => ({
  missing: 0, flagged: 0, mine: { review: false, replies: 0, back: false }, takeSeconds, words, dirs: [],
});

describe('length', () => {
  it('adds the takes to the read time of rows with none', () => {
    expect(length(counts(30, 150), 150)).toEqual({ seconds: 90, recorded: false });
  });
  it('is recorded once no dialogue is left without a take', () => {
    expect(length(counts(42, 0), 150)).toEqual({ seconds: 42, recorded: true });
  });
  it('is nothing for a script with no dialogue and no takes', () => {
    expect(length(counts(0, 0), 150)).toBeNull();
  });
});

describe('hash', () => {
  it('is the same for the same files and differs when one changes', () => {
    const a = 'me\n120:1700000000000\nv1.json/v2.json\nc1.json\n-';
    expect(hash(a)).toBe(hash(a));
    expect(hash(a)).not.toBe(hash(a.replace('v2', 'v3')));
    expect(hash(a)).not.toBe(hash(a + '/c2.json'));
  });
});
