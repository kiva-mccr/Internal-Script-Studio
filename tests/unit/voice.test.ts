import { describe, expect, it } from 'vitest';
import { outdated, wpm } from '../../src/lib/voice.svelte';

describe('wpm', () => {
  it('is the dialogue’s words a minute over the take', () => {
    expect(wpm('one two three four five', 2)).toBe(150);
    expect(wpm('**Bold** words here', 1.2)).toBe(150);
  });
  it('is 0 with no words or no length', () => {
    expect(wpm('', 3)).toBe(0);
    expect(wpm('words', 0)).toBe(0);
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
