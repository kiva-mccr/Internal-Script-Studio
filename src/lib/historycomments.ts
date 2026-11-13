// Comments in History (RV-6, board 48): each comment or suggestion is placed once, on the version that changed the
// cell it is about (the first one made after it), so a change shows why it was made. One that nothing has changed
// for yet stays on the version that was current when it was made.

import { fieldText, type Field, type Thread } from './comments';
import type { Version } from './history';
import { parseScript, rows, type Row } from './script';

// A version's comments: `changed` under the cell they led to (key `row:field`), `open` the rest.
export type Placed = { changed: Map<string, Thread[]>; open: Thread[] };

const FIELDS: Field[] = ['dialogue', 'on_screen', 'files'];
export const cellKey = (row: string, field: Field) => `${row}:${field}`;

// versions oldest first; list as threads() gives them (deleted ones already left out). Keyed by version id.
export function placeComments(versions: Version[], list: Thread[]): Map<string, Placed> {
  const placed = new Map<string, Placed>(versions.map((v) => [v.id, { changed: new Map(), open: [] }]));
  if (!versions.length) return placed;
  const byId = new Map(versions.map((v) => [v.id, v]));
  const cells = new Map<string, Map<string, Row>>();
  const rowsOf = (v: Version) => {
    if (!cells.has(v.id)) cells.set(v.id, new Map(rows(parseScript(v.text)).map((r) => [r.id, r])));
    return cells.get(v.id)!;
  };
  // The cells each version changed, compared with the version it was made from (else the one before it).
  const touched = versions.map((v, i) => {
    const before = byId.get(v.parents[0] ?? '') ?? versions[i - 1];
    const keys = new Set<string>();
    if (!before) return keys;
    const was = rowsOf(before), now = rowsOf(v);
    for (const id of new Set([...was.keys(), ...now.keys()])) {
      for (const field of FIELDS) {
        const a = was.get(id), b = now.get(id);
        if (!a || !b || fieldText(a, field) !== fieldText(b, field)) keys.add(cellKey(id, field));
      }
    }
    return keys;
  });
  const times = versions.map((v) => Date.parse(v.when));
  for (const t of [...list].reverse()) {
    const at = Date.parse(t.comment.when);
    const key = t.comment.row ? cellKey(t.comment.row, t.comment.field ?? 'dialogue') : '';
    const i = key ? versions.findIndex((_, j) => times[j] > at && touched[j].has(key)) : -1;
    if (i >= 0) {
      const changed = placed.get(versions[i].id)!.changed;
      changed.set(key, [...(changed.get(key) ?? []), t]);
    } else {
      const current = Math.max(times.findLastIndex((time) => time <= at), 0);
      placed.get(versions[current].id)!.open.push(t);
    }
  }
  return placed;
}

// What History shows for a thread's state.
export function stateText(t: Thread): string {
  if (t.decision) return `${t.decision === 'accepted' ? 'Accepted' : 'Rejected'}${t.by ? ` by ${t.by}` : ''}`;
  if (t.held) return `On hold by ${t.held.who}`;
  return t.resolved ? `Resolved${t.by ? ` by ${t.by}` : ''}` : 'Open';
}
