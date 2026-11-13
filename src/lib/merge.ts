// Combines two saves made from the same starting text, row by row (docs/studio-folder.md, Conflicts). Rows are
// matched by id. What only one side changed is taken without asking; a field both changed differently is a clash
// the person picks for.

import { frontList, frontValue, parseScript, setFrontValue, writeScript, type Block, type Row, type Script } from './script';
import { mergeCredits, readCredits, writeCredits } from './people';

export type Side = 'mine' | 'theirs';
export type Clash = { key: string; where: string; mine: string; theirs: string };
export type Merged = {
  clashes: Clash[];
  onlyMine: number[]; // rows only "mine" changed, by number in the result
  onlyTheirs: number[];
  // The combined text, each clash taken from the side picked for it.
  text: (picks: Record<string, Side>) => string;
};

const FIELDS = [
  ['dialogue', 'Dialogue'],
  ['onScreen', 'On screen'],
  ['files', 'Images & files'],
] as const;
type Field = (typeof FIELDS)[number][0];

export function merge(baseText: string, mineText: string, theirsText: string): Merged {
  const base = parseScript(baseText);
  const mine = parseScript(mineText);
  const theirs = parseScript(theirsText);
  const baseRows = byId(base);
  const mineRows = byId(mine);
  const theirRows = byId(theirs);

  // Lay out the result on whichever side moved rows; otherwise on theirs.
  const moved = (s: Script) => order(s, baseRows) !== order(base, baseRows);
  const [first, second, firstRows, secondRows] = moved(mine) && !moved(theirs)
    ? [mine, theirs, mineRows, theirRows]
    : [theirs, mine, theirRows, mineRows];

  const blocks: Block[] = [];
  for (const block of first.blocks) {
    if (block.type !== 'row') blocks.push({ ...block });
    else if (secondRows.has(block.id) || !baseRows.has(block.id) || changedRow(baseRows.get(block.id)!, block)) {
      blocks.push({ ...block, files: [...block.files] }); // kept: in both, new, or changed by the side that kept it
    }
  }
  // Rows the other side added, or kept and changed after this side deleted them, go after the row before them.
  second.blocks.forEach((block, i) => {
    if (block.type !== 'row' || firstRows.has(block.id)) return;
    if (baseRows.has(block.id) && !changedRow(baseRows.get(block.id)!, block)) return; // deleted by the first side
    let at = 0;
    for (let j = i - 1; j >= 0; j--) {
      const before = second.blocks[j];
      const found = blocks.findIndex((b) => (before.type === 'row' ? b.type === 'row' && b.id === before.id : b.type === 'section' && b.title === before.title));
      if (found >= 0) {
        at = found + 1;
        break;
      }
    }
    blocks.splice(at, 0, { ...block, files: [...block.files] });
  });

  // Fields both sides have: three-way, field by field.
  const clashes: Clash[] = [];
  const decide: { row: Row; field: Field; key: string }[] = [];
  const onlyMine = new Set<number>();
  const onlyTheirs = new Set<number>();
  let n = 0;
  for (const block of blocks) {
    if (block.type !== 'row') continue;
    n++;
    const b = baseRows.get(block.id);
    const m = mineRows.get(block.id);
    const t = theirRows.get(block.id);
    if (!m || !t) {
      (m ? onlyMine : onlyTheirs).add(n);
      continue;
    }
    for (const [field, label] of FIELDS) {
      const was = b ? text(b, field) : '';
      const mv = text(m, field);
      const tv = text(t, field);
      if (mv === tv) set(block, field, mv);
      else if (mv === was) (set(block, field, tv), onlyTheirs.add(n));
      else if (tv === was) (set(block, field, mv), onlyMine.add(n));
      else {
        const key = `${block.id}:${field}`;
        clashes.push({ key, where: `Row ${n} · ${label}`, mine: mv || '(empty)', theirs: tv || '(empty)' });
        decide.push({ row: block, field, key });
        onlyMine.delete(n);
        onlyTheirs.delete(n);
      }
    }
  }
  for (const n of [...onlyMine]) if (onlyTheirs.has(n)) (onlyMine.delete(n), onlyTheirs.delete(n));

  // Front matter: title and status three-way (a clash if both changed), authors from both.
  let front = first.front;
  for (const key of ['title', 'status']) {
    const was = frontValue(base.front, key);
    const mv = frontValue(mine.front, key);
    const tv = frontValue(theirs.front, key);
    if (mv !== tv && mv !== was && tv !== was) {
      clashes.push({ key: `front:${key}`, where: key === 'title' ? 'Title' : 'Status', mine: mv, theirs: tv });
      continue;
    }
    const value = mv === was ? tv : mv;
    if (value !== frontValue(front, key)) front = setFrontValue(front, key, value);
  }
  const authors = [...new Set([...frontList(theirs.front, 'authors'), ...frontList(mine.front, 'authors')])];
  if (authors.length) front = setFrontValue(front, 'authors', `[${authors.join(', ')}]`);
  // Credits (AP-31): combined person by person, never a clash.
  const credits = mergeCredits(readCredits(base.front), readCredits(mine.front), readCredits(theirs.front));
  if (JSON.stringify(credits) !== JSON.stringify(readCredits(front))) front = writeCredits(front, credits);

  return {
    clashes,
    onlyMine: [...onlyMine],
    onlyTheirs: [...onlyTheirs],
    text(picks) {
      let f = front;
      for (const clash of clashes.filter((c) => c.key.startsWith('front:'))) {
        const key = clash.key.slice(6);
        f = setFrontValue(f, key, picks[clash.key] === 'theirs' ? clash.theirs : clash.mine);
      }
      for (const { row, field, key } of decide) {
        set(row, field, text((picks[key] === 'theirs' ? theirRows : mineRows).get(row.id)!, field));
      }
      return writeScript({ front: f, intro: mine.intro === base.intro ? theirs.intro : mine.intro, blocks });
    },
  };
}

function byId(script: Script): Map<string, Row> {
  return new Map(script.blocks.filter((b): b is Row => b.type === 'row').map((row) => [row.id, row]));
}

function order(script: Script, keep: Map<string, Row>): string {
  return script.blocks.flatMap((b) => (b.type === 'row' && keep.has(b.id) ? [b.id] : [])).join();
}

function changedRow(a: Row, b: Row): boolean {
  return FIELDS.some(([field]) => text(a, field) !== text(b, field));
}

function text(row: Row, field: Field): string {
  return field === 'files' ? row.files.join('\n') : row[field];
}

function set(row: Row, field: Field, value: string) {
  if (field === 'files') row.files = value ? value.split('\n') : [];
  else row[field] = value;
}
