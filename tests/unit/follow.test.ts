import { describe, expect, it } from 'vitest';
import { addMark, follow, move, normal, voiceAt, wordsOf, type Mark } from '../../src/lib/follow';

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
    // "tiny" comes twice; "tiny parts called" only fits the second, "a tiny factory" only the first. (Three words heard
    // are enough near the marker; further than 6 words away it takes four, EX-12.)
    expect(follow(script, wordsOf('a tiny factory'), 7)).toBe(11);
    expect(follow(script, wordsOf('tiny parts called'), 22)).toBe(27);
  });
});

describe('repeated sentence structure (EX-12)', () => {
  // Every sentence starts "The …": a misheard word must not let a look-alike further on win (found by the user).
  const repeats = wordsOf(
    'The sun gives the energy. The leaf catches the light. The root drinks the water. The stem carries the water up. ' +
      'The cell makes the sugar. The plant grows tall.',
  );
  it('stays near when the same few words come again further on', () => {
    expect(follow(repeats, wordsOf('drinks the water the'), 13)).toBe(16);
    expect(follow(repeats, wordsOf('sinks the water the'), 13)).toBe(16); // misheard, still the near one
    expect(follow(repeats, wordsOf('um the water the stem'), 13)).toBe(17);
    expect(follow(repeats, wordsOf('carries the'), 12)).toBe(12); // two words fit too many places to jump on
  });
  it('still finds a skipped sentence when enough of it was heard', () => {
    expect(follow(repeats, wordsOf('the cell makes the sugar'), 13)).toBe(26);
  });
});

describe('between hearings (EX-12)', () => {
  // Hearings come about 4 times a second and each ends a word early or late.
  const steady: Mark[] = [[10, 0], [11, 250], [11, 500], [12, 750], [13, 1000], [14, 1250], [13, 1500], [15, 1750], [15, 2000]]
    .map(([at, time]) => ({ at, time }));
  it('reads the voice from the last few seconds together, not the last hearing alone', () => {
    const now = voiceAt(steady, 2000, 1);
    expect(now.speed).toBeGreaterThan(2);
    expect(now.speed).toBeLessThan(3);
    expect(now.at).toBeGreaterThan(14);
    expect(now.at).toBeLessThan(16);
  });
  it('goes on at the pace set until the hearings span 1.5 s, and stops 3 words past the last place heard', () => {
    expect(voiceAt(steady.slice(0, 3), 1000, 2)).toEqual({ at: 12, speed: 2 });
    expect(voiceAt(steady.slice(0, 3), 5000, 2)).toEqual({ at: 14, speed: 0 }); // a pause
    expect(voiceAt(steady, 9000, 1)).toEqual({ at: 18, speed: 0 });
    expect(voiceAt([], 0, 2)).toEqual({ at: 0, speed: 0 });
  });
  it('keeps a few seconds of hearings, starting afresh on a line read again or skipped', () => {
    expect(addMark(steady, { at: 16, time: 5000 })).toHaveLength(6); // only the last 4 s
    expect(addMark(steady, { at: 14, time: 2250 })).toHaveLength(10); // a word back is only a hearing ending early
    expect(addMark(steady, { at: 5, time: 2250 })).toEqual([{ at: 5, time: 2250 }]);
    expect(addMark(steady, { at: 30, time: 2250 })).toEqual([{ at: 30, time: 2250 }]);
  });
  it('moves smoothly: at the voice speed, faster when behind, slower when ahead, never snapping', () => {
    expect(move(10, 10, 2, 0.1)).toBeCloseTo(10.2);
    expect(move(10, 11, 2, 0.1)).toBeCloseTo(10.35); // behind: catches up gently
    expect(move(10, 9, 2, 0.1)).toBeCloseTo(10.05); // a word ahead: slows down
    expect(move(10, 8, 2, 0.1)).toBe(10); // further ahead: waits, doesn't step back
    expect(move(10, 4, 2, 0.1)).toBeCloseTo(8.2); // a line read again: goes back
    expect(move(10, 30, 2, 0.1)).toBeCloseTo(16); // a skipped line: glides there within about a second
    expect(move(10, 10.02, 0, 0.1)).toBe(10.02); // arrived
  });
});
