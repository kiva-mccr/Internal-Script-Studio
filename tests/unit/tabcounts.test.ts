import { describe, expect, it } from 'vitest';
import example from '../../docs/example/Episode 03 - How Photosynthesis Works/script.md?raw';
import type { Note, Thread } from '../../src/lib/comments';
import type { Version } from '../../src/lib/history';
import { parseScript } from '../../src/lib/script';
import { reviewCount, seenKey, writeCount } from '../../src/lib/tabcounts';

const version = (id: string, parent: string, who: string, when: string, text: string, kind: Version['kind'] = 'edit', note = ''): Version => ({
  v: 1, id, parents: parent ? [parent] : [], who, when, kind, note, sha256: '', text,
});
const leaf = example.replace('Slow push-in on a sunlit leaf.', 'Wide shot of a leaf.');
const sugar = leaf.replace('They turn it into sugar', 'They make sugar');
const thread = (who: string, when: string, more: Partial<Thread> = {}): Thread => ({
  comment: { v: 1, id: `${who}${when}`, kind: 'comment', who, when } as Note, replies: [], resolved: false, ...more,
});

describe('reviewCount', () => {
  // Ana sent it back, Jo changed two rows, then sent it for review.
  const versions = [
    version('a', '', 'Sam', '2026-11-10T09:00:00Z', example),
    version('b', 'a', 'Ana', '2026-11-10T10:00:00Z', example, 'review', 'Sent back to writer'),
    version('c', 'b', 'Jo', '2026-11-11T09:00:00Z', leaf),
    version('d', 'c', 'Jo', '2026-11-11T10:00:00Z', sugar),
    version('e', 'd', 'Jo', '2026-11-11T11:00:00Z', sugar, 'review', 'Sent for review'),
  ];
  it('counts the rows others changed since the send back, once in review', () => {
    expect(reviewCount(versions, parseScript(sugar), 'in review', 'Sam', '')).toBe(2);
    expect(reviewCount(versions, parseScript(sugar), 'draft', 'Sam', '')).toBe(0);
  });
  it('counts only what is new since Review was last open here, and never your own', () => {
    expect(reviewCount(versions, parseScript(sugar), 'in review', 'Sam', '2026-11-11T09:30:00Z')).toBe(1);
    expect(reviewCount(versions, parseScript(sugar), 'in review', 'Sam', '2026-11-11T12:00:00Z')).toBe(0);
    expect(reviewCount(versions, parseScript(sugar), 'in review', 'Jo', '')).toBe(0);
  });
  it('shows nothing on a first review', () => {
    expect(reviewCount([versions[0], versions[2], versions[3], versions[4]], parseScript(sugar), 'in review', 'Sam', '')).toBe(0);
  });
});

describe('writeCount', () => {
  const versions = [
    version('a', '', 'Sam', '2026-11-10T09:00:00Z', example),
    version('b', 'a', 'Sam', '2026-11-10T10:00:00Z', example, 'review', 'Sent for review'),
    version('c', 'b', 'Ana', '2026-11-11T10:00:00Z', example, 'review', 'Sent back to writer'),
  ];
  const list = [
    thread('Ana', '2026-11-09T12:00:00.000Z'), // before the send for review
    thread('Ana', '2026-11-10T11:00:00.000Z'),
    thread('Jo', '2026-11-10T12:00:00.000Z'),
    thread('Ana', '2026-11-10T13:00:00.000Z', { resolved: true }),
    thread('Ana', '2026-11-10T14:00:00.000Z', { held: { who: 'Ana', when: '2026-11-10T14:01:00Z' } }),
    thread('Sam', '2026-11-10T15:00:00.000Z'), // your own
  ];
  it("counts others' open comments made since the send for review, once sent back", () => {
    expect(writeCount(versions, list, 'draft', 'Sam', '')).toBe(2);
    expect(writeCount(versions, list, 'in review', 'Sam', '')).toBe(0);
    expect(writeCount(versions.slice(0, 2), list, 'draft', 'Sam', '')).toBe(0); // not sent back
  });
  it('counts only what is new since Write was last open here', () => {
    expect(writeCount(versions, list, 'draft', 'Sam', '2026-11-10T11:30:00Z')).toBe(1);
    expect(writeCount(versions, list, 'draft', 'Sam', '2026-11-11T11:00:00Z')).toBe(0);
  });
  it('keeps each tab of each script apart', () => {
    expect(seenKey('review', 'Video Scripts', ['Episode 3'])).toBe('seen-review:Video Scripts/Episode 3');
  });
});
