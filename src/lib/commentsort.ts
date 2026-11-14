import { fieldText, type Field, type Thread } from './comments';
import type { Row } from './script';

// How the comment lists are sorted (RV-16, board 55): in line order by default, or by time, or by type.
export type Sort = 'line' | 'time' | 'type';
export const SORTS: [Sort, string][] = [['line', 'Line'], ['time', 'Time'], ['type', 'Type']];
export const SORT_KEY = 'comment-sort'; // remembered per computer, one choice for Review and Write
export const toSort = (value: string): Sort => (value === 'time' || value === 'type' ? value : 'line');

const FIELDS: Field[] = ['dialogue', 'on_screen', 'files'];
const TYPES = ['Suggestions', 'On words', 'On a whole row'];

// 0 a suggestion, 1 a comment on words, 2 a comment on a whole row (the user's order).
export function typeOf(t: Thread): number {
  return t.comment.kind === 'suggestion' ? 0 : t.comment.quote ? 1 : 2;
}

// Sorts `list` (newest first, as threads() gives it). Line: by row; in a row the whole-row comment first, then words by
// column and where they stand in the text; a deleted row last. Time: newest first. Type: by typeOf, then line order.
// Ties keep the newest first.
export function sortThreads(list: Thread[], how: Sort, rows: Row[]): Thread[] {
  if (how === 'time') return list;
  const index = new Map(rows.map((row, i) => [row.id, i]));
  const byId = new Map(rows.map((row) => [row.id, row]));
  const place = (t: Thread): number[] => {
    const c = t.comment;
    const row = byId.get(c.row ?? '');
    if (!row) return [rows.length, 0, 0];
    if (!c.quote) return [index.get(row.id)!, -1, 0];
    const field = c.field ?? 'dialogue';
    const at = fieldText(row, field).indexOf(c.quote);
    return [index.get(row.id)!, FIELDS.indexOf(field), at < 0 ? Infinity : at];
  };
  const keyed = list.map((t) => ({ t, key: how === 'type' ? [typeOf(t), ...place(t)] : place(t) }));
  keyed.sort((a, b) => {
    for (let i = 0; i < a.key.length; i++) if (a.key[i] !== b.key[i]) return a.key[i] - b.key[i];
    return 0;
  });
  return keyed.map((k) => k.t);
}

// By type, the heading with its count that starts each kind in the open list `list`, at its `i`th card; else ''.
export function heading(list: Thread[], i: number, how: Sort): string {
  if (how !== 'type') return '';
  const k = typeOf(list[i]);
  if (i > 0 && typeOf(list[i - 1]) === k) return '';
  return `${TYPES[k]} · ${list.filter((t) => typeOf(t) === k).length}`;
}
