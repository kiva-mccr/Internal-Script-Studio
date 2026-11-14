import { describe, expect, it } from 'vitest';
import example from '../../docs/example/Episode 03 - How Photosynthesis Works/script.md?raw';
import { diff, fold } from '../../src/lib/changes';
import { parseScript, rows, writeScript } from '../../src/lib/script';

const swap = (text: string, from: string, to: string) => {
  if (!text.includes(from)) throw new Error(`not found: ${from}`);
  return text.replace(from, to);
};
const leaf = 'Slow push-in on a sunlit leaf.';
const sugar = 'They turn it into sugar the plant uses to grow.';
const edit = (text: string, change: (s: ReturnType<typeof parseScript>) => void) => {
  const s = parseScript(text);
  change(s);
  return writeScript(s);
};

describe('diff', () => {
  it('holds only the rows that changed, before and after', () => {
    const delta = diff(example, swap(example, leaf, 'Theirs.'))!;
    expect(Object.keys(delta.rows)).toEqual(['k3f9a']);
    expect(delta.rows.k3f9a[0]!.onScreen).toBe(leaf);
    expect(delta.rows.k3f9a[1]!.onScreen).toBe('Theirs.');
    expect(delta.layout).toBeUndefined();
    expect(delta.front).toBeUndefined();
  });

  it('is null when nothing changed', () => {
    expect(diff(example, example)).toBeNull();
  });
});

describe('fold', () => {
  it('takes their change into a copy that has changes of its own', () => {
    const mine = swap(example, sugar, 'Mine.');
    const result = fold(diff(example, swap(example, leaf, 'Theirs.'))!, mine);
    expect(result.clashes).toEqual([]);
    expect(result.text({})).toBe(swap(swap(example, sugar, 'Mine.'), leaf, 'Theirs.'));
  });

  it('asks about a field both changed', () => {
    const result = fold(diff(example, swap(example, leaf, 'Theirs.'))!, swap(example, leaf, 'Mine.'));
    expect(result.clashes.map((c) => [c.key, c.mine, c.theirs])).toEqual([['k3f9a:onScreen', 'Mine.', 'Theirs.']]);
    expect(result.text({ 'k3f9a:onScreen': 'theirs' })).toBe(swap(example, leaf, 'Theirs.'));
  });

  it('does nothing when the change is already in', () => {
    const theirs = swap(example, leaf, 'Theirs.');
    const result = fold(diff(example, theirs)!, theirs);
    expect(result.clashes).toEqual([]);
    expect(result.text({})).toBe(theirs);
  });

  it('adds, deletes and moves rows, and keeps rows added here where they were', () => {
    const theirs = edit(example, (s) => {
      const [first] = s.blocks.splice(1, 1); // row 1 moved after row 2
      s.blocks.splice(2, 0, first);
      s.blocks.push({ type: 'row', id: 'zzzzz', dialogue: 'Their new row.', onScreen: '', files: [], timeline: '', note: '' });
      const last = rows(s).at(-2)!;
      s.blocks.splice(s.blocks.indexOf(last), 1); // the last of the example's rows deleted
    });
    const mine = edit(example, (s) => {
      s.blocks.splice(1, 0, { type: 'row', id: 'mmmmm', dialogue: 'My new row.', onScreen: '', files: [], timeline: '', note: '' });
    });
    const result = fold(diff(example, theirs)!, mine);
    expect(result.clashes).toEqual([]);
    const ids = rows(parseScript(result.text({}))).map((r) => r.id);
    const theirIds = rows(parseScript(theirs)).map((r) => r.id);
    expect(ids.filter((id) => id !== 'mmmmm')).toEqual(theirIds);
    expect(ids).toContain('mmmmm');
    expect(ids).toContain('zzzzz');
  });

  it('keeps a row they deleted that was changed here', () => {
    const firstId = rows(parseScript(example))[0].id;
    const theirs = edit(example, (s) => s.blocks.splice(s.blocks.findIndex((b) => b.type === 'row' && b.id === firstId), 1));
    const result = fold(diff(example, theirs)!, swap(example, leaf, 'Mine.'));
    expect(result.text({})).toContain('Mine.');
  });

  it('takes a status change in the front matter', () => {
    const theirs = swap(example, 'status: in review', 'status: approved');
    const result = fold(diff(example, theirs)!, swap(example, leaf, 'Mine.'));
    expect(result.text({})).toContain('status: approved');
    expect(result.text({})).toContain('Mine.');
  });
});
