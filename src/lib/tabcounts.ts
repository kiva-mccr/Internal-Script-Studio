// Tab counts that show what's new for you (RV-21, board 57). Review counts the rows changed since the script was
// last sent back, once it is in review; Write counts the open comments and suggestions made since it was sent for
// review, once it is sent back. Each counts only what is new since this person last had that tab open here.

import type { Thread } from './comments';
import { backNote, reviewEnd, type Version } from './history';
import type { Script } from './script';
import { sinceVisit } from './visit';

export type Tab = 'write' | 'review';

// The browser remembers when each tab of each script was last open (never in the shared folder).
export const seenKey = (tab: Tab, folder: string, path: string[]) => `seen-${tab}:${folder}/${path.join('/')}`;

// Now, as History writes times (whole seconds), so it compares with versions' times as text.
export const stamp = () => new Date().toISOString().replace(/\.\d+Z$/, 'Z');

const later = (a: string, b: string) => (a > b ? a : b);

// Rows others changed since the last send back (or since Review was last open here, if later). 0 unless in
// review, and on a first review (nothing was sent back yet). The same rows Review's "What's changed" marks (RV-4).
export function reviewCount(versions: Version[], current: Script, status: string, me: string, seen: string): number {
  const end = status === 'in review' ? reviewEnd(versions) : undefined;
  if (!end) return 0;
  const visit = sinceVisit(versions, current, later(end.when, seen), me);
  return visit ? visit.changed.size + visit.removed.length : 0;
}

// Others' open comments and suggestions made since the last send for review (or since Write was last open here,
// if later). 0 unless the newest review entry is a send back and it is a draft again. Replies don't count.
export function writeCount(versions: Version[], list: Thread[], status: string, me: string, seen: string): number {
  const back = status === 'draft' ? backNote(versions) : undefined;
  if (!back) return 0;
  const sent = versions.findLast((v) => v.kind === 'review' && v.note === 'Sent for review' && v.when <= back.when);
  const from = Math.max(sent ? Date.parse(sent.when) : 0, seen ? Date.parse(seen) : 0);
  return list.filter((t) => !t.resolved && !t.held && !t.deleted && t.comment.who !== me && Date.parse(t.comment.when) > from).length;
}
