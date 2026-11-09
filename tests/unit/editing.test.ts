import { describe, expect, it } from 'vitest';
import { editingText, fileName, othersEditing, type Editing } from '../../src/lib/editing';

const entry = (who: string, seenMinutesAgo: number, now: number): Editing => ({
  v: 1, who, since: '', seen: new Date(now - seenMinutesAgo * 60000).toISOString(), last_written: '',
});

describe('editing', () => {
  const now = Date.parse('2026-11-09T15:00:00Z');
  it('names each file after its person', () => {
    expect(fileName('Sam')).toBe('sam.json');
    expect(fileName('Ana María López')).toBe('ana-maría-lópez.json');
  });
  it('shows only other people seen in the last 2 minutes', () => {
    expect(othersEditing([entry('Sam', 1, now), entry('Ana', 3, now), entry('Kiva', 0, now)], 'kiva', now)).toEqual(['Sam']);
  });
  it('reads like a sentence', () => {
    expect(editingText(['Sam'])).toBe('Sam is editing');
    expect(editingText(['Sam', 'Ana'])).toBe('Sam and Ana are editing');
    expect(editingText(['Sam', 'Ana', 'Lee'])).toBe('Sam, Ana and Lee are editing');
    expect(editingText([])).toBe('');
  });
});
