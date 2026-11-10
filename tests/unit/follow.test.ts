import { describe, expect, it } from 'vitest';
import { follow, normal, wordsOf } from '../../src/lib/follow';

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
