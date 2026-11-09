import { describe, expect, it } from 'vitest';
import example from '../../docs/example/Episode 03 - How Photosynthesis Works/script.md?raw';
import { merge } from '../../src/lib/merge';
import { parseScript, rows } from '../../src/lib/script';

const swap = (text: string, from: string, to: string) => {
  if (!text.includes(from)) throw new Error(`not found: ${from}`);
  return text.replace(from, to);
};
const leaf = 'Slow push-in on a sunlit leaf.';
const sugar = 'They turn it into sugar the plant uses to grow.';

describe('merge', () => {
  it('takes what only one side changed, without asking', () => {
    const mine = swap(example, leaf, 'Mine.');
    const theirs = swap(example, sugar, 'Theirs.');
    const result = merge(example, mine, theirs);
    expect(result.clashes).toEqual([]);
    expect(result.onlyMine).toEqual([1]);
    expect(result.onlyTheirs).toEqual([4]);
    expect(result.text({})).toBe(swap(swap(example, leaf, 'Mine.'), sugar, 'Theirs.'));
  });

  it('asks about a field both changed, and uses the side picked', () => {
    const result = merge(example, swap(example, leaf, 'Mine.'), swap(example, leaf, 'Theirs.'));
    expect(result.clashes).toEqual([{ key: 'k3f9a:onScreen', where: 'Row 1 · On screen', mine: 'Mine.', theirs: 'Theirs.' }]);
    expect(result.text({ 'k3f9a:onScreen': 'theirs' })).toBe(swap(example, leaf, 'Theirs.'));
    expect(result.text({ 'k3f9a:onScreen': 'mine' })).toBe(swap(example, leaf, 'Mine.'));
  });

  it('keeps rows either side added, where they were added', () => {
    const added = (text: string, id: string, words: string) =>
      swap(text, '# Inside the leaf', `## 9 <!-- id: ${id} -->\nDialogue:\n${words}\n\nOn screen:\n\nFiles:\n\n# Inside the leaf`);
    const result = merge(example, added(example, 'mmmmm', 'Mine'), swap(example, '# Wrap-up', '# Wrap-up\n\n## 9 <!-- id: ttttt -->\nDialogue:\nTheirs\n\nOn screen:\n\nFiles:'));
    expect(result.clashes).toEqual([]);
    const ids = rows(parseScript(result.text({}))).map((r) => r.id);
    expect(ids).toEqual(['k3f9a', 'p8x2m', 'mmmmm', 't1q7c', 'b6n0w', 'ttttt', 'z4r5e']);
  });

  it('a row one side deleted stays deleted, unless the other side changed it', () => {
    const without = example.replace(/## 4 <!-- id: b6n0w -->[\s\S]*?(?=# Wrap-up)/, '');
    expect(rows(parseScript(merge(example, without, example).text({}))).map((r) => r.id)).not.toContain('b6n0w');
    const edited = swap(example, sugar, 'Changed.');
    expect(merge(example, without, edited).text({})).toContain('Changed.');
  });

  it('keeps a move by one side and an edit by the other', () => {
    const [a, b] = [example.indexOf('## 1 <!--'), example.indexOf('## 2 <!--')];
    const c = example.indexOf('# Inside');
    const moved = example.slice(0, a) + example.slice(b, c) + example.slice(a, b) + example.slice(c);
    const text = merge(example, moved, swap(example, leaf, 'Theirs.')).text({});
    expect(rows(parseScript(text)).map((r) => r.id).slice(0, 2)).toEqual(['p8x2m', 'k3f9a']);
    expect(text).toContain('Theirs.');
  });

  it('joins the authors and asks about a status both changed', () => {
    const mine = swap(swap(example, 'authors: [Kiva, Sam]', 'authors: [Kiva, Sam, Ana]'), 'status: in review', 'status: approved');
    const theirs = swap(example, 'status: in review', 'status: draft');
    const result = merge(example, mine, theirs);
    expect(result.clashes.map((c) => c.where)).toEqual(['Status']);
    const text = result.text({ 'front:status': 'mine' });
    expect(text).toContain('status: approved');
    expect(text).toContain('authors: [Kiva, Sam, Ana]');
  });
});
