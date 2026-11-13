import { describe, expect, it } from 'vitest';
import example from '../../docs/example/Episode 03 - How Photosynthesis Works/script.md?raw';
import { ancestor, backNote, changes, describe as say, heads, holdEnds, officialNumber, officialNumbers, reviewEnd, reviewNote, sameScript, sendVersion, sinceReview, summary, type Version } from '../../src/lib/history';
import { parseScript } from '../../src/lib/script';

const edit = (from: string, to: string) => example.replace(from, to);
const version = (text: string, extra: Partial<Version> = {}): Version => ({
  v: 1, id: 'aaaaaaaa', parents: [], who: 'Sam', when: '2026-11-09T14:41:00Z', kind: 'edit', note: '', sha256: '', text, ...extra,
});

describe('describe', () => {
  it('names the rows that changed', () => {
    const after = edit('Slow push-in on a sunlit leaf.', 'Wide shot.').replace('They turn it into sugar', 'They make sugar');
    expect(say(parseScript(example), parseScript(after))).toBe('Edited rows 1 and 4');
  });
  it('names added and removed rows', () => {
    const removed = example.replace(/## 2 <!-- id: p8x2m -->[\s\S]*?(?=# Inside)/, '');
    expect(say(parseScript(example), parseScript(removed))).toBe('Removed row 2');
    expect(say(parseScript(removed), parseScript(example))).toBe('Added row 2');
  });
  it('falls back to the status, then moves', () => {
    expect(say(parseScript(example), parseScript(edit('status: in review', 'status: approved')))).toBe('Changed the status');
  });
});

describe('summary', () => {
  it('uses the note, the kind, or the changes', () => {
    expect(summary(version(example, { note: 'Restored the version from Nov 6, 9:12 am', kind: 'restore' }), undefined))
      .toBe('Restored the version from Nov 6, 9:12 am');
    expect(summary(version(example, { kind: 'outside' }), version(example))).toBe('Changed outside the app');
    expect(summary(version(example), undefined)).toBe('Created the script');
    expect(summary(version(edit('Wrap-up', 'The end')), version(example))).toBe('Changed the sections');
  });
});

describe('changes', () => {
  it('lists each changed field, old and new', () => {
    expect(changes(example, edit('Slow push-in on a sunlit leaf.', 'Wide shot.'))).toEqual([
      { where: 'Row 1 · On screen', old: 'Slow push-in on a sunlit leaf.', new: 'Wide shot.', row: 'k3f9a', field: 'on_screen' },
    ]);
    expect(changes(undefined, example)).toEqual([{ where: 'Script', old: '(new file)', new: 'How Photosynthesis Works' }]);
  });
});

describe('officialNumbers', () => {
  it('numbers official versions v1, v2 … in the order they were published', () => {
    const list = [
      version(example, { id: 'a' }),
      version(example, { id: 'b', kind: 'official', note: 'First draft' }),
      version(example, { id: 'c' }),
      version(example, { id: 'd', kind: 'official', note: 'Sent to the narrator' }),
    ];
    expect([...officialNumbers(list)]).toEqual([['b', 1], ['d', 2]]);
  });
});

describe('officialNumber', () => {
  it('is the newest official version, only while the script has not changed since', () => {
    const changed = edit('Slow push-in on a sunlit leaf.', 'Wide shot.');
    const list = [
      version(changed, { id: 'a', kind: 'official' }),
      version(example, { id: 'b', kind: 'official' }),
    ];
    expect(officialNumber(list, example)).toBe(2);
    expect(officialNumber(list, changed)).toBe(0);
    // A later save of the same script, or only the status changed: still v2.
    expect(officialNumber([...list, version(example, { id: 'c' })], edit('status: in review', 'status: approved'))).toBe(2);
    expect(officialNumber([], example)).toBe(0);
  });
  it('counts a send for review that made a version (RV-9)', () => {
    const list = [version(example, { id: 'a', kind: 'official' }), version(example, { id: 'b', kind: 'review', official: true })];
    expect([...officialNumbers(list)]).toEqual([['a', 1], ['b', 2]]);
    expect(officialNumber(list, example)).toBe(2);
  });
});

describe('sameScript', () => {
  it('leaves out the status and the authors, nothing else', () => {
    expect(sameScript(example, edit('status: in review', 'status: draft'))).toBe(true);
    expect(sameScript(example, example.replace(/^authors:.*$/m, 'authors: [Kiva, Sam, Ana]'))).toBe(true);
    expect(sameScript(example, edit('Slow push-in on a sunlit leaf.', 'Wide shot.'))).toBe(false);
    expect(sameScript(example, example.replace(/^title:.*$/m, 'title: Something else'))).toBe(false);
  });
});

describe('sendVersion', () => {
  const changed = edit('Slow push-in on a sunlit leaf.', 'Wide shot.');
  it('is the next version after changes, the first when there is none', () => {
    expect(sendVersion([], example)).toEqual({ n: 1, still: false });
    expect(sendVersion([version(example, { kind: 'official' })], changed)).toEqual({ n: 2, still: false });
  });
  it('keeps the version when nothing changed, however it was made (no duplicates)', () => {
    const byHand = [version(example, { id: 'a', kind: 'official' }), version(example, { id: 'b' })];
    expect(sendVersion(byHand, edit('status: in review', 'status: draft'))).toEqual({ n: 1, still: true });
    const bySend = [version(example, { id: 'a', kind: 'review', official: true })];
    expect(sendVersion(bySend, example)).toEqual({ n: 1, still: true });
  });
});

describe('heads and ancestor', () => {
  // a ── b ── c
  //       └── d        c and d were both made from b: two saves at the same time.
  const [a, b] = [version(example, { id: 'a' }), version(example, { id: 'b', parents: ['a'] })];
  const [c, d] = [version(example, { id: 'c', parents: ['b'] }), version(example, { id: 'd', parents: ['b'] })];
  it('finds the versions nothing was made from', () => {
    expect(heads([a, b]).map((v) => v.id)).toEqual(['b']);
    expect(heads([a, b, c, d]).map((v) => v.id)).toEqual(['c', 'd']);
  });
  it('is one again after a merge with both as parents', () => {
    const merged = version(example, { id: 'e', parents: ['c', 'd'], kind: 'merge' });
    expect(heads([a, b, c, d, merged]).map((v) => v.id)).toEqual(['e']);
  });
  it('finds the newest version both were made from', () => {
    expect(ancestor([a, b, c, d], c, d)?.id).toBe('b');
    expect(ancestor([a, d], a, d)).toBeUndefined();
  });
});

describe('reviewNote', () => {
  const sent = (id: string, message?: string) => version(example, { id, kind: 'review', note: 'Sent for review', message });
  it('is the note of the newest send for review, if it has one', () => {
    expect(reviewNote([sent('a', 'Look at row 2'), version(example, { id: 'b' })])?.message).toBe('Look at row 2');
    expect(reviewNote([sent('a', 'Look at row 2'), sent('b')])).toBeUndefined();
    expect(reviewNote([sent('a', 'Look at row 2'), version(example, { id: 'b', kind: 'review', note: 'Sent back to writer' })])).toBeUndefined();
    expect(reviewNote([])).toBeUndefined();
  });
});

describe('backNote (RV-13)', () => {
  it('is the newest review entry while it is a send back, with or without a note', () => {
    const back = (id: string, message?: string) => version(example, { id, kind: 'review', note: 'Sent back to writer', message });
    expect(backNote([back('a', 'Fix row 3'), version(example, { id: 'b' })])?.message).toBe('Fix row 3');
    expect(backNote([back('a')])?.id).toBe('a');
    expect(backNote([back('a', 'Fix row 3'), version(example, { id: 'b', kind: 'review', note: 'Sent for review' })])).toBeUndefined();
    expect(backNote([])).toBeUndefined();
  });
});

describe('since the last review (RV-4)', () => {
  it('finds when the last review ended: sent back or approved, not a send', () => {
    const list = [
      version(example, { id: 'a', kind: 'review', note: 'Approved, 2 still open' }),
      version(example, { id: 'b', kind: 'review', note: 'Sent back to writer' }),
      version(example, { id: 'c', kind: 'edit' }),
      version(example, { id: 'd', kind: 'review', note: 'Sent for review' }),
    ];
    expect(reviewEnd(list)?.id).toBe('b');
    expect(reviewEnd(list.slice(0, 1))?.id).toBe('a');
    expect(reviewEnd(list.slice(2))).toBeUndefined();
  });
  it('lists changed and new rows with their old selves, and removed rows with where they were', () => {
    const before = parseScript(example);
    const after = parseScript(
      edit('Slow push-in on a sunlit leaf.', 'Wide shot.')
        .replace(/## 2 <!-- id: p8x2m -->[\s\S]*?(?=# Inside)/, '')
        .replace('# Wrap-up', '## 6 <!-- id: new01 -->\nDialogue:\nA new line.\n\n# Wrap-up'),
    );
    const { changed, removed } = sinceReview(before, after);
    expect([...changed.keys()]).toEqual(['k3f9a', 'new01']);
    expect(changed.get('k3f9a')?.onScreen).toBe('Slow push-in on a sunlit leaf.');
    expect(changed.get('new01')).toBeNull();
    expect(removed.map((r) => [r.after, r.row.id])).toEqual([['k3f9a', 'p8x2m']]);
    expect(sinceReview(before, before)).toEqual({ changed: new Map(), removed: [] });
  });
});

describe('holdEnds (RV-19)', () => {
  it('lists the times of sends for review and official versions only', () => {
    const v = (id: string, kind: Version['kind'], note: string, official?: boolean): Version => ({
      v: 1, id, parents: [], who: 'Sam', when: `2026-11-09T14:0${id}:00Z`, kind, note, sha256: '', text: '', ...(official ? { official } : {}),
    });
    expect(holdEnds([v('1', 'edit', ''), v('2', 'review', 'Sent for review'), v('3', 'review', 'Sent back to writer'),
      v('4', 'official', 'v2'), v('5', 'review', 'Approved')])).toEqual(['2026-11-09T14:02:00Z', '2026-11-09T14:04:00Z']);
  });
});
