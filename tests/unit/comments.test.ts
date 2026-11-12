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
