import { describe, expect, it } from 'vitest';
import example from '../../docs/example/Episode 03 - How Photosynthesis Works/script.md?raw';
import { changes, describe as say, summary, type Version } from '../../src/lib/history';
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
      { where: 'Row 1 · On screen', old: 'Slow push-in on a sunlit leaf.', new: 'Wide shot.' },
    ]);
    expect(changes(undefined, example)).toEqual([{ where: 'Script', old: '(new file)', new: 'How Photosynthesis Works' }]);
  });
});
