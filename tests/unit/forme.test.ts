import { describe, expect, it } from 'vitest';
import type { Note } from '../../src/lib/comments';
import { forMe, waiting } from '../../src/lib/forme';
import type { Version } from '../../src/lib/history';

const version = (who: string, note: string, kind: Version['kind'] = 'review'): Version => ({
  v: 1, id: who + note, parents: [], who, when: '2026-11-09T14:00:00Z', kind, note, sha256: '', text: '',
});
const note = (id: string, who: string, kind: Note['kind'], minute: number, about?: string): Note => ({
  v: 1, id, kind, who, when: `2026-11-09T14:${String(minute).padStart(2, '0')}:00.000Z`, ...(about ? { about } : {}),
});

describe('forMe', () => {
  it('a script in review waits for everyone but the one who sent it', () => {
    const versions = [version('Sam', '', 'edit'), version('Sam', 'Sent for review')];
    expect(forMe('Kiva', 'in review', versions, []).review).toBe(true);
    expect(forMe('sam ', 'in review', versions, []).review).toBe(false);
    expect(forMe('Kiva', 'approved', versions, []).review).toBe(false);
    expect(forMe('Kiva', 'in review', [], []).review).toBe(true); // status typed by hand: nobody known sent it
  });

  it('a draft sent back waits for the one who sent it for review', () => {
    const versions = [version('Ana', 'Sent for review'), version('Kiva', 'Sent back to writer')];
    expect(forMe('Ana', 'draft', versions, []).back).toBe(true);
    expect(forMe('Kiva', 'draft', versions, []).back).toBe(false);
    expect(forMe('Ana', 'draft', [...versions, version('Ana', 'Sent for review')], []).back).toBe(false);
    expect(forMe('Ana', 'draft', [version('Ana', 'Sent for review'), version('Kiva', 'Approved')], []).back).toBe(false);
  });

  it('counts open comments you wrote in whose newest word is someone else’s', () => {
    const notes = [
      note('a', 'Kiva', 'comment', 0), note('a1', 'Sam', 'reply', 1, 'a'), // answered: waits for Kiva
      note('b', 'Sam', 'comment', 2), note('b1', 'Kiva', 'reply', 3, 'b'), note('b2', 'Sam', 'reply', 4, 'b'), // answered
      note('c', 'Kiva', 'comment', 5), note('c1', 'Sam', 'reply', 6, 'c'), note('c2', 'Kiva', 'reply', 7, 'c'), // Kiva had the last word
      note('d', 'Kiva', 'comment', 8), note('d1', 'Sam', 'reply', 9, 'd'), note('dx', 'Sam', 'resolve', 10, 'd'), // resolved
      note('e', 'Ana', 'comment', 11), note('e1', 'Sam', 'reply', 12, 'e'), // not Kiva's
      note('f', 'Kiva', 'comment', 13), // nobody answered yet
    ];
    expect(forMe('Kiva', 'draft', [], notes).replies).toBe(2);
    expect(forMe('Ana', 'draft', [], notes).replies).toBe(1);
    expect(forMe('Sam', 'draft', [], notes).replies).toBe(1); // c
  });

  it('leaves out comments on hold until a send or a version brings them back (RV-19)', () => {
    const notes = [note('a', 'Kiva', 'comment', 0), note('a1', 'Sam', 'reply', 1, 'a'), note('ah', 'Sam', 'hold', 2, 'a')];
    expect(forMe('Kiva', 'draft', [], notes).replies).toBe(0);
    const sent = { ...version('Sam', 'Sent for review'), when: '2026-11-09T14:05:00Z' };
    expect(forMe('Kiva', 'in review', [sent], notes).replies).toBe(1);
  });

  it('with no name, nothing waits', () => {
    const f = forMe('', 'in review', [], []);
    expect(waiting(f)).toBe(false);
    expect(waiting(forMe('Kiva', 'in review', [], []))).toBe(true);
  });
});
