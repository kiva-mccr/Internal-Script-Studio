import { describe, expect, it } from 'vitest';
import { combinePlans } from '../../src/lib/planning';
import { changed, continueList, renumber, showLists, toggleList, unlist } from '../../src/lib/format';

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
    expect(continueList('- one', 1)).toBeNull();
    expect(continueList('- one', 2)).toEqual({ text: '- \n- one', at: 5 });
  });

  it('splits a list line in two with Enter in the middle, renumbering the rest (AP-29)', () => {
    expect(continueList('1. Hook: the leaf\n2. Ingredients', 8)).toEqual({ text: '1. Hook:\n2. the leaf\n3. Ingredients', at: 12 });
    expect(continueList('1. a\n2. b\n3. c', 4)).toEqual({ text: '1. a\n2. \n3. b\n4. c', at: 8 });
    expect(continueList('- one two', 5)).toEqual({ text: '- one\n- two', at: 8 });
  });
});

describe('renumber (AP-29)', () => {
  it('counts touching numbered lines on from the first one', () => {
    expect(renumber('1. a\n3. b\n4. c')).toBe('1. a\n2. b\n3. c');
    expect(renumber('4. d\n1. a\n2. b')).toBe('4. d\n5. a\n6. b');
    expect(renumber('9. a\n9. b')).toBe('9. a\n10. b');
  });

  it('starts again after a blank or plain line, and leaves other text alone', () => {
    expect(renumber('Outline\n1. a\n1. b\n\n5. c\n2. d\nNotes\n3. e')).toBe('Outline\n1. a\n2. b\n\n5. c\n6. d\nNotes\n3. e');
    expect(renumber('In 2026. we\n- 1. not a list')).toBe('In 2026. we\n- 1. not a list');
  });

  it('renumbers when the list button joins lines to a list', () => {
    expect(toggleList('1. a\nb\n3. c', 5, 5, 'number').text).toBe('1. a\n2. b\n3. c');
  });
});

describe('unlist (AP-29)', () => {
  it('takes the mark off with Backspace just after it, and renumbers', () => {
    expect(unlist('1. a\n2. b\n3. c', 8)).toEqual({ text: '1. a\nb\n3. c', at: 5 });
    expect(unlist('- [ ] tick', 6)).toEqual({ text: 'tick', at: 0 });
    expect(unlist('1. a', 4)).toBeNull();
    expect(unlist('plain', 2)).toBeNull();
  });
});

describe('changed', () => {
  it('finds the smallest stretch that differs', () => {
    expect(changed('1. a\n3. b', '1. a\n2. b')).toEqual({ start: 5, old: 1, added: '2' });
    expect(changed('abc', 'abc')).toEqual({ start: 3, old: 0, added: '' });
  });
});
