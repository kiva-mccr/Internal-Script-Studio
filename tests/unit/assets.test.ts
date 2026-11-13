import { describe, expect, it } from 'vitest';
import example from '../../docs/example/Episode 03 - How Photosynthesis Works/script.md?raw';
import { assetList, assetRows } from '../../src/lib/assets';
import { parseScript } from '../../src/lib/script';

describe('assetRows', () => {
  it('gives each row its section and its files, links and notes', () => {
    const rows = assetRows(parseScript(example));
    expect(rows.map((r) => [r.n, r.section, r.assets.map((a) => a.kind)])).toEqual([
      [1, 'Intro', ['path', 'path']], [2, 'Intro', ['path', 'path']], [3, 'Inside the leaf', ['link', 'path', 'path']],
      [4, 'Inside the leaf', ['path', 'path']], [5, 'Wrap-up', ['words', 'path', 'path']],
    ]);
  });
  it('lists an asset used twice once, with both rows', () => {
    const script = parseScript('# A\n\n## 1 <!-- id: a1 -->\nFiles:\n- assets/x.png\n\n## 2 <!-- id: a2 -->\nFiles:\n- assets/x.png\n- B-roll\n- b-roll\n');
    const list = assetList(script);
    expect(list.map((a) => [a.label, a.rows])).toEqual([['x.png', [1, 2]], ['B-roll', [2]]]);
  });
});
