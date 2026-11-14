import { describe, expect, it } from 'vitest';
import { comboOf, show, stepComment } from '../../src/lib/shortcuts.svelte';

const press = (o: Partial<KeyboardEvent>) => ({ key: '', code: '', ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, preventDefault() {}, ...o }) as KeyboardEvent;

describe('shortcuts (AP-44)', () => {
  it('reads a key press as Ctrl+Alt+Shift+Key, with ⌘ as Ctrl and letters from their place', () => {
    expect(comboOf(press({ key: 'ArrowDown', code: 'ArrowDown', ctrlKey: true }))).toBe('Ctrl+ArrowDown');
    expect(comboOf(press({ key: 'Enter', code: 'Enter', metaKey: true, shiftKey: true }))).toBe('Ctrl+Shift+Enter');
    // Alt+N on a Mac types "˜", but it is still N.
    expect(comboOf(press({ key: '˜', code: 'KeyN', altKey: true }))).toBe('Alt+N');
  });

  it('shows arrows as arrows', () => {
    expect(show('Ctrl+ArrowUp')).toBe('Ctrl+↑');
  });

  it('steps through the comments, going round at the ends', () => {
    const ids = ['a', 'b', 'c'];
    const next = press({ key: 'n', code: 'KeyN', altKey: true });
    const prev = press({ key: 'p', code: 'KeyP', altKey: true });
    expect(stepComment(next, ids, '')).toBe('a');
    expect(stepComment(prev, ids, '')).toBe('c');
    expect(stepComment(next, ids, 'c')).toBe('a');
    expect(stepComment(prev, ids, 'a')).toBe('c');
    expect(stepComment(press({ key: 'n', code: 'KeyN' }), ids, 'a')).toBeUndefined();
    expect(stepComment(next, [], '')).toBeUndefined();
  });
});
