import { describe, expect, it } from 'vitest';
import { combinePlans } from '../../src/lib/planning';
import { continueList, showLists, toggleList } from '../../src/lib/format';

describe('combinePlans', () => {
  it('keeps yours when they did not change it, and takes theirs when you did not', () => {
    expect(combinePlans('a', 'b', 'a')).toBe('b');
    expect(combinePlans('a', 'a', 'c')).toBe('c');
    expect(combinePlans('a', 'b', 'b')).toBe('b');
  });

  it('adds the lines they added at the same time after yours', () => {
    expect(combinePlans('Goals\n', 'Goals\n- mine\n', 'Goals\n- theirs\n')).toBe('Goals\n- mine\n\n- theirs\n');
  });

  it('adds nothing when they only deleted', () => {
    expect(combinePlans('a\nb\n', 'a\nb\nc\n', 'a\n')).toBe('a\nb\nc\n');
  });
});

describe('lists', () => {
  it('shows bullets, tick boxes and numbers', () => {
    expect(showLists('- one\n- [ ] two\n- [x] three\n1. four')).toBe('• one\n☐ two\n☑ three\n1. four');
  });

  it('makes the lines a selection touches into a list, and back', () => {
    const made = toggleList('one\ntwo\nthree', 1, 6, 'bullet');
    expect(made.text).toBe('- one\n- two\nthree');
    expect(toggleList(made.text, 0, 11, 'bullet').text).toBe('one\ntwo\nthree');
    expect(toggleList('a\nb', 0, 3, 'number').text).toBe('1. a\n2. b');
    expect(toggleList('- a', 0, 0, 'number').text).toBe('1. a');
  });

  it('adds a tick box, then ticks and unticks it', () => {
    const box = toggleList('Name the parts', 3, 3, 'tick').text;
    expect(box).toBe('- [ ] Name the parts');
    expect(toggleList(box, 0, 0, 'tick').text).toBe('- [x] Name the parts');
    expect(toggleList('- [x] a', 0, 0, 'tick').text).toBe('- [ ] a');
  });

  it('carries a list on with Enter, and ends it on an empty item', () => {
    expect(continueList('- one', 5)).toEqual({ text: '- one\n- ', at: 8 });
    expect(continueList('1. one', 6)).toEqual({ text: '1. one\n2. ', at: 10 });
    expect(continueList('- [x] done', 10)).toEqual({ text: '- [x] done\n- [ ] ', at: 17 });
    expect(continueList('- one\n- ', 8)).toEqual({ text: '- one\n', at: 6 });
    expect(continueList('plain', 5)).toBeNull();
    expect(continueList('- one', 2)).toBeNull();
  });
});
