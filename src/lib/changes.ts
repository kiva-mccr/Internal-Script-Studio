// One person's change to a script, as written in a change file (FX-2, docs/studio-folder.md): only what changed,
// each part before and after, so anyone can fold it into their own copy row by row, whatever else they have.

import { merge, type Merged } from './merge';
import { parseScript, writeScript, type Block, type Row, type Script } from './script';

type RowData = Omit<Row, 'type' | 'id'>;
export type Delta = {
  front?: [string | null, string | null];
  intro?: [string, string];
  rows: Record<string, [RowData | null, RowData | null]>; // by row id: before (null: added), after (null: deleted)
  layout?: [string[], string[]]; // the blocks in order (`key`), when rows were added, deleted or moved, or sections changed
};

// What changed from `before` to `after`, or null if nothing did.
export function diff(beforeText: string, afterText: string): Delta | null {
  const before = parseScript(beforeText);
  const after = parseScript(afterText);
  const [b, a] = [byId(before), byId(after)];
  const delta: Delta = { rows: {} };
  for (const id of new Set([...b.keys(), ...a.keys()])) {
    const [was, now] = [b.get(id), a.get(id)];
    if (!was || !now || same(was, now) === false) delta.rows[id] = [was ? data(was) : null, now ? data(now) : null];
  }
  if (before.front !== after.front) delta.front = [before.front, after.front];
  if (before.intro !== after.intro) delta.intro = [before.intro, after.intro];
  const [lb, la] = [before.blocks.map(key), after.blocks.map(key)];
  if (lb.join('\n') !== la.join('\n')) delta.layout = [lb, la];
  return delta.front || delta.intro || delta.layout || Object.keys(delta.rows).length ? delta : null;
}

// Folds someone's change into `mine` (which may have changes of its own): the same row-by-row combination as two
// saves at once (`lib/merge.ts`), so a field both changed is a clash to pick, and anything else is taken.
export function fold(delta: Delta, mineText: string): Merged {
  const mine = parseScript(mineText);
  return merge(writeScript(side(delta, mine, 0)), mineText, writeScript(side(delta, mine, 1)));
}

// `mine` as it was before the change (0) or after it (1): the changed parts replaced, the rest as `mine` has it.
function side(delta: Delta, mine: Script, at: 0 | 1): Script {
  const rows = byId(mine);
  for (const [id, pair] of Object.entries(delta.rows)) {
    if (pair[at]) rows.set(id, { type: 'row', id, ...clone(pair[at]!) });
    else rows.delete(id);
  }
  let blocks: Block[];
  if (delta.layout) {
    const keys = delta.layout[at];
    blocks = keys.flatMap((k): Block[] => {
      if (k.startsWith('s:')) {
        const [title, note] = k.slice(2).split('\u0000');
        return [{ type: 'section', title, note: note ?? '' }];
      }
      const row = rows.get(k.slice(2));
      return row ? [row] : [];
    });
    // Rows of mine the change doesn't know of (added here): after the block before them in mine.
    const placed = new Set(blocks.map(key));
    mine.blocks.forEach((block, i) => {
      if (block.type !== 'row' || placed.has(key(block)) || !rows.has(block.id)) return;
      const before = i > 0 ? key(mine.blocks[i - 1]) : '';
      const at = blocks.findIndex((b) => key(b) === before);
      blocks.splice(at + 1, 0, rows.get(block.id)!);
      placed.add(key(block));
    });
  } else {
    blocks = mine.blocks.flatMap((b): Block[] => (b.type === 'row' ? (rows.has(b.id) ? [rows.get(b.id)!] : []) : [{ ...b }]));
    // A row the change has but mine doesn't (deleted here): at the end, where it is only compared.
    const present = new Set(blocks.map(key));
    for (const [id, row] of rows) if (!present.has(`r:${id}`)) blocks.push(row);
  }
  return {
    front: delta.front ? delta.front[at] : mine.front,
    intro: delta.intro ? delta.intro[at] : mine.intro,
    blocks,
  };
}

const key = (b: Block) => (b.type === 'row' ? `r:${b.id}` : `s:${b.title}\u0000${b.note}`);
const data = ({ dialogue, onScreen, files, timeline, note }: Row): RowData => ({ dialogue, onScreen, files: [...files], timeline, note });
const clone = (d: RowData): RowData => ({ ...d, files: [...d.files], timeline: d.timeline ?? '' }); // change files from before SB-1 have no timeline
const same = (a: Row, b: Row) =>
  a.dialogue === b.dialogue && a.onScreen === b.onScreen && a.note === b.note && a.timeline === b.timeline && a.files.join('\n') === b.files.join('\n');

function byId(script: Script): Map<string, Row> {
  return new Map(script.blocks.filter((b): b is Row => b.type === 'row').map((row) => [row.id, { ...row, files: [...row.files] }]));
}
