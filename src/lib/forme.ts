// What in a script waits for you (RV-14), for the "For me" filter on the script list: your review, answered
// comments, and a script of yours sent back. Worked out from the script's History and comment files, so it is the
// same on every computer; nothing is stored per person.

import { threads, type Note } from './comments';
import type { Version } from './history';

export type ForMe = { review: boolean; replies: number; back: boolean };

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const isSend = (v: Version) => v.kind === 'review' && v.note === 'Sent for review';

// `versions` oldest first, `notes` as listScripts and listNotes give them.
export function forMe(me: string, status: string, versions: Version[], notes: Note[]): ForMe {
  if (!me.trim()) return { review: false, replies: 0, back: false };
  const reviews = versions.filter((v) => v.kind === 'review');
  const newest = reviews.at(-1);
  const send = reviews.findLast(isSend);
  // In review and someone else sent it (no reviewers are assigned). With no send in History, nobody is known to
  // have sent it, so it waits for everyone.
  const review = status === 'in review' && !(send && same(send.who, me));
  // A draft whose newest review change is a send back, of a send that was yours.
  const back = status === 'draft' && !!newest?.note.startsWith('Sent back') && !!send && same(send.who, me);
  // Open comments you wrote in where the newest word is someone else's.
  const replies = threads(notes).filter((t) => {
    if (t.resolved) return false;
    const said = [t.comment, ...t.replies];
    return said.some((n) => same(n.who, me)) && !same(said.at(-1)!.who, me);
  }).length;
  return { review, replies, back };
}

export const waiting = (f: ForMe | undefined) => !!f && (f.review || f.back || f.replies > 0);
