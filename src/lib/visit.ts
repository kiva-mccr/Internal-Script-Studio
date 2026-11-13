// What changed since you last looked (RV-15, board 45): the rows other people changed since this person last
// opened the script on this computer, each with who changed it last and when. Worked out from History.

import { sinceReview, type Version } from './history';
import { parseScript, type Row, type Script } from './script';

export type By = { who: string; when: string };
export type Visit = {
  since: string; // when this person last opened the script here
  changed: Map<string, Row | null>; // row id → the row as it was (null: a new row)
  removed: { after: string; row: Row }[]; // as sinceReview gives them
  by: Map<string, By>; // row id (changed or removed) → who changed it last
};
// What Write and Review draw: the marks not yet ticked Seen, the row stepped to, Show the edits, and Seen itself.
export type Marks = Visit & { on: string; edits: boolean; onSeen: (id: string) => void };

// The browser remembers when each script was last opened (never in the shared folder).
export const visitKey = (folder: string, path: string[]) => `visit:${folder}/${path.join('/')}`;

// Rows changed since `since` by anyone but `me`, or null when there is nothing to show (first visit here, or
// nothing new). Each version after `since` is compared with its first parent to say who changed which row; a merge
// is skipped, since its changes were made in the versions it joins. A row whose last change was this person's own,
// or that no version accounts for, is left out.
export function sinceVisit(versions: Version[], current: Script, since: string, me: string): Visit | null {
  if (!since) return null;
  const base = versions.findLast((v) => v.when <= since);
  if (!base) return null;
  const byId = new Map(versions.map((v) => [v.id, v]));
  const last = new Map<string, By>();
  for (const v of versions) {
    if (v.when <= since || v.kind === 'merge') continue;
    const parent = byId.get(v.parents[0]);
    if (!parent) continue;
    const step = sinceReview(parseScript(parent.text), parseScript(v.text));
    const by = { who: v.who, when: v.when };
    for (const id of step.changed.keys()) last.set(id, by);
    for (const { row } of step.removed) last.set(row.id, by);
  }
  const all = sinceReview(parseScript(base.text), current);
  const others = (id: string) => {
    const by = last.get(id);
    return by && by.who !== me ? by : null;
  };
  const visit: Visit = { since, changed: new Map(), removed: [], by: new Map() };
  for (const [id, was] of all.changed) {
    const by = others(id);
    if (by) (visit.changed.set(id, was), visit.by.set(id, by));
  }
  for (const gone of all.removed) {
    const by = others(gone.row.id);
    if (by) (visit.removed.push(gone), visit.by.set(gone.row.id, by));
  }
  return visit.changed.size || visit.removed.length ? visit : null;
}

// "Ana", "Ana and Jo", "Ana, Jo and Sam".
export function names(list: string[]): string {
  const unique = [...new Set(list)];
  return unique.length < 2 ? (unique[0] ?? '') : `${unique.slice(0, -1).join(', ')} and ${unique.at(-1)}`;
}
