import { describe, expect, it } from 'vitest';
import { highlight, threads, type Note } from '../../src/lib/comments';

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

describe('highlight', () => {
  it('marks each quote where it is first found', () => {
    expect(highlight('Slow push-in on a sunlit leaf.', [{ id: 'a', quote: 'sunlit leaf' }])).toEqual([
      { text: 'Slow push-in on a ' }, { text: 'sunlit leaf', id: 'a' }, { text: '.' },
    ]);
  });
  it('leaves out quotes no longer in the text, and overlapping ones', () => {
    expect(highlight('abc def', [{ id: 'a', quote: 'gone' }, { id: 'b', quote: 'abc' }, { id: 'c', quote: 'bc d' }])).toEqual([
      { text: 'abc', id: 'b' }, { text: ' def' },
    ]);
    expect(highlight('', [])).toEqual([{ text: '' }]);
  });
});
