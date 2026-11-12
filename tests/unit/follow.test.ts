import { describe, expect, it } from 'vitest';
import { aim, follow, normal, paceFrom, wordsOf } from '../../src/lib/follow';

const script = wordsOf(
  'Every leaf you have ever seen is running a tiny factory. It needs three simple ingredients: sunlight, water, ' +
    'and carbon dioxide. Inside each cell, tiny parts called chloroplasts catch the light.',
);

describe('normal', () => {
  it('ignores case and punctuation', () => {
    expect(normal('Factory.')).toBe('factory');
    expect(normal('CO₂')).toBe('co2');
  });
});

describe('follow', () => {
  it('moves to just after the words heard', () => {
    expect(follow(script, wordsOf('every leaf you have ever'), 0)).toBe(5);
    expect(follow(script, wordsOf('running a tiny factory'), 5)).toBe(11);
  });
  it('copes with a misheard or extra word', () => {
    expect(follow(script, wordsOf('it needs three simple ingredience sunlight'), 11)).toBe(17);
    expect(follow(script, wordsOf('it needs um three simple ingredients'), 11)).toBe(16);
  });
  it('finds its place after a skipped sentence', () => {
    expect(follow(script, wordsOf('inside each cell tiny parts'), 11)).toBe(26);
  });
  it('stays put when nothing matches, or only a word or two', () => {
    expect(follow(script, wordsOf('sorry can we start again'), 5)).toBe(5);
    expect(follow(script, wordsOf('tiny'), 5)).toBe(5);
    expect(follow(script, [], 5)).toBe(5);
  });
  it('takes the nearest of two places that read the same', () => {
    // "tiny" comes twice; "tiny parts called" only fits the second, "a tiny factory" only the first.
    expect(follow(script, wordsOf('a tiny factory'), 3)).toBe(11);
    expect(follow(script, wordsOf('tiny parts called'), 20)).toBe(27);
  });
});

describe('between hearings (EX-12)', () => {
  it('goes on at the reading pace, at most 4 words past the word heard, never past the end', () => {
    expect(aim(10, 1, 2.5, 100)).toBe(12.5);
    expect(aim(10, 10, 2.5, 100)).toBe(14);
    expect(aim(10, -Infinity, 2.5, 100)).toBe(10); // nothing heard yet: it waits
    expect(aim(98, 1, 2.5, 100)).toBe(100);
  });
  it('learns the pace from the voice, but not from a long pause or a step back', () => {
    expect(paceFrom(2, 6, 2)).toBeCloseTo(2.3);
    expect(paceFrom(2, 6, 10)).toBe(2);
    expect(paceFrom(2, -5, 1)).toBe(2);
    expect(paceFrom(2, 100, 1)).toBeCloseTo(3.2); // a skipped line counts as fast reading, not 100 words a second
  });
});
