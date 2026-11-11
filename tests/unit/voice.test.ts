import { describe, expect, it } from 'vitest';
import { outdated, wpm } from '../../src/lib/voice.svelte';

describe('wpm', () => {
  const take = (text: string, seconds: number) => ({ by: 'Sam', at: 0, seconds, text });
  it('is the recorded words a minute over the take', () => {
    expect(wpm(take('one two three four five', 2), 'one two three four five')).toBe(150);
    expect(wpm(take('**Bold** words here', 1.2), '**Bold** words here')).toBe(150);
  });
  it('stays the same when the line is changed after the take', () => {
    expect(wpm(take('one two three four five', 2), 'one two three four five six seven eight nine ten')).toBe(150);
  });
  it('counts the line for a take saved without its text', () => {
    expect(wpm(take('', 2), 'one two three four five')).toBe(150);
  });
  it('is 0 with no words or no length', () => {
    expect(wpm(take('', 3), '')).toBe(0);
    expect(wpm(take('words', 0), 'words')).toBe(0);
  });
});

describe('outdated', () => {
  const take = { by: 'Sam', at: 0, seconds: 2, text: 'Every leaf.' };
  it('is false while the line reads as it did, spaces at the ends aside', () => {
    expect(outdated(take, ' Every leaf. ')).toBe(false);
  });
  it('is true once the line has changed', () => {
    expect(outdated(take, 'Every leaf you see.')).toBe(true);
  });
});
