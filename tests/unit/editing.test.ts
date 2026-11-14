import { describe, expect, it } from 'vitest';
import { editingText, fileName, lastHereText, othersEditing, seenWhen, whoWasHere, type Editing } from '../../src/lib/editing';

const entry = (who: string, seenMinutesAgo: number, now: number, left = false): Editing => {
  const seen = new Date(now - seenMinutesAgo * 60000).toISOString();
  return { v: 1, who, since: '', seen, last_written: '', ...(left ? { left: seen } : {}) };
};

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
  it('never counts someone who left as editing, however recent', () => {
    expect(othersEditing([entry('Sam', 0, now, true)], 'kiva', now)).toEqual([]);
  });
  it('lists who has been here, newest first, without you or anyone over 30 days ago (AP-37)', () => {
    const seen = whoWasHere([entry('Lee', 180, now, true), entry('Sam', 1, now), entry('Kiva', 0, now), entry('Ana', 31 * 24 * 60, now, true), entry('Priya', 5, now)], 'Kiva', now);
    expect(seen.map((s) => [s.who, s.state])).toEqual([['Sam', 'editing'], ['Priya', 'quiet'], ['Lee', 'here']]);
  });
  it('is quiet (gone without leaving) for 2 hours, then just "was here"', () => {
    expect(whoWasHere([entry('Sam', 119, now)], 'kiva', now)[0].state).toBe('quiet');
    expect(whoWasHere([entry('Sam', 121, now)], 'kiva', now)[0].state).toBe('here');
  });
  it('names the last person here in the bar, up to 7 days back', () => {
    const text = (e: Editing) => lastHereText(whoWasHere([e], 'kiva', now), now);
    expect(text(entry('Sam', 1, now, true))).toBe('Sam was here 1 min ago');
    expect(text(entry('Sam', 3, now))).toBe('Sam last seen 3 min ago');
    expect(text(entry('Sam', 24 * 60 + 5, now, true))).toBe('Sam was here yesterday');
    expect(text(entry('Sam', 8 * 24 * 60, now, true))).toBe('');
    expect(text(entry('Sam', 0, now))).toBe(''); // editing: "Sam is editing" instead
  });
  it('says when, in the list', () => {
    const when = (e: Editing) => seenWhen(whoWasHere([e], 'kiva', now)[0], now);
    expect(when(entry('Sam', 0, now))).toBe('editing now');
    expect(when(entry('Sam', 3, now))).toBe('last seen 3 min ago');
    expect(when(entry('Sam', 180, now, true))).toBe('3 h ago');
    expect(when(entry('Sam', 2 * 24 * 60, now, true))).toMatch(/^Nov 7, /);
  });
});
