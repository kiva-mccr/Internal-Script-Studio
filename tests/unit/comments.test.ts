import { describe, expect, it } from 'vitest';
import { flags, threads, type Note } from '../../src/lib/comments';

const note = (id: string, kind: Note['kind'], when: string, extra: Partial<Note> = {}): Note => ({
  v: 1, id, kind, who: 'Ana', when: `2026-11-09T14:${when}Z`, ...extra,
});

describe('threads', () => {
  it('gathers replies, and the newest resolve or reopen counts', () => {
    const list = threads([
      note('a', 'comment', '00:00', { text: 'First' }),
      note('b', 'comment', '01:00', { text: 'Second' }),
      note('r', 'reply', '02:00', { about: 'a', text: 'Agreed' }),
      note('x', 'resolve', '03:00', { about: 'a' }),
      note('y', 'resolve', '03:00', { about: 'b' }),
      note('z', 'reopen', '04:00', { about: 'b' }),
    ]);
    expect(list.map((t) => [t.comment.id, t.resolved, t.replies.map((r) => r.text)])).toEqual([
      ['b', false, []],
      ['a', true, ['Agreed']],
    ]);
  });
});

describe('suggestions', () => {
  it('are accepted or rejected by the newest decision, and reopened by Undo', () => {
    const list = threads([
      note('s', 'suggestion', '00:00', { quote: 'catch', replace: 'absorb' }),
      note('t', 'suggestion', '01:00', { quote: 'slide', replace: 'pop' }),
      note('a', 'accept', '02:00', { about: 's' }),
      note('r', 'reject', '02:00', { about: 't' }),
      note('u', 'reopen', '03:00', { about: 't' }),
    ]);
    expect(list.map((t) => [t.comment.id, t.resolved, t.decision])).toEqual([
      ['t', false, undefined],
      ['s', true, 'accepted'],
    ]);
  });
});

describe('flags', () => {
  it('the newest flag or unflag about a row counts, in row order, and only for rows still in the script', () => {
    const found = flags([
      note('a', 'flag', '00:00', { row: 'r2', text: '' }),
      note('b', 'flag', '01:00', { row: 'r2', text: 'Check this fact', who: 'Sam' }),
      note('c', 'flag', '00:30', { row: 'r1', text: 'Needs a source' }),
      note('d', 'unflag', '02:00', { row: 'r3' }),
      note('e', 'flag', '01:30', { row: 'r3', text: 'gone' }),
      note('f', 'flag', '00:10', { row: 'deleted', text: 'x' }),
      note('g', 'comment', '00:20', { row: 'r1', text: 'Not a flag' }),
    ], ['r1', 'r2', 'r3']);
    expect([...found.values()]).toEqual([
      { row: 'r1', text: 'Needs a source', who: 'Ana', when: '2026-11-09T14:00:30Z' },
      { row: 'r2', text: 'Check this fact', who: 'Sam', when: '2026-11-09T14:01:00Z' },
    ]);
  });

  it('flags are not comments: they never show as threads', () => {
    expect(threads([note('a', 'flag', '00:00', { row: 'r1', text: 'x' })])).toEqual([]);
  });
});

describe('editing your own (RV-7)', () => {
  it('an edit by the author changes the text and marks it edited; one by anyone else is ignored', () => {
    const [t] = threads([
      note('c', 'comment', '00:00', { text: 'Frist' }),
      note('s', 'reply', '01:00', { about: 'c', text: 'Yse', who: 'Lee' }),
      note('e1', 'edit', '02:00', { about: 'c', text: 'First' }),
      note('e2', 'edit', '03:00', { about: 'c', text: 'Hijacked', who: 'Lee' }),
      note('e3', 'edit', '04:00', { about: 's', text: 'Yes', who: 'Lee' }),
    ]);
    expect([t.comment.text, t.comment.edited, t.replies[0].text, t.replies[0].edited]).toEqual([
      'First', '2026-11-09T14:02:00Z', 'Yes', '2026-11-09T14:04:00Z',
    ]);
  });

  it('an edited suggestion keeps its quote and gets the new replacement', () => {
    const [t] = threads([
      note('s', 'suggestion', '00:00', { quote: 'pop in', replace: 'fade' }),
      note('e', 'edit', '01:00', { about: 's', replace: 'fade in' }),
    ]);
    expect([t.comment.quote, t.comment.replace]).toEqual(['pop in', 'fade in']);
  });

  it('deleted comments and replies are left out, a deleted comment takes its replies, and undelete brings it back', () => {
    const notes = [
      note('a', 'comment', '00:00', { text: 'A' }),
      note('b', 'comment', '01:00', { text: 'B' }),
      note('r', 'reply', '02:00', { about: 'a', text: 'Reply' }),
      note('d1', 'delete', '03:00', { about: 'r' }),
      note('d2', 'delete', '04:00', { about: 'b' }),
    ];
    expect(threads(notes).map((t) => [t.comment.id, t.replies.length])).toEqual([['a', 0]]);
    expect(threads(notes, true).map((t) => [t.comment.id, t.deleted, t.replies.map((x) => x.deleted)])).toEqual([
      ['b', true, []],
      ['a', false, [true]],
    ]);
    expect(threads([...notes, note('u', 'undelete', '05:00', { about: 'b' })]).map((t) => t.comment.id)).toEqual(['b', 'a']);
  });

  it('a delete by someone other than the author is ignored', () => {
    expect(threads([note('a', 'comment', '00:00'), note('d', 'delete', '01:00', { about: 'a', who: 'Lee' })])).toHaveLength(1);
  });
});
