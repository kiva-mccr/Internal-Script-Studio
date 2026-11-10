import { describe, expect, it } from 'vitest';
import { threads, type Note } from '../../src/lib/comments';

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
