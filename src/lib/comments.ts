// Review: comments, suggestions, replies, resolving and accepting, one file each in .studio/comments/ (docs/studio-folder.md), written once
// and never changed. What happens to one later (resolve, accept, reject, reopen) is a new file; the newest counts.
// Editing your own (RV-7) is the same: an `edit` (new text or replace) or a `delete` / `undelete` about one; only the
// author's count, and the newest counts.
// Flags on rows (AP-9) live there too: a `flag` (with its note) or an `unflag`; the newest about a row counts.

export type Field = 'dialogue' | 'on_screen' | 'files';
export type Note = {
  v: 1;
  id: string;
  kind:
    | 'comment' | 'reply' | 'resolve' | 'reopen' | 'suggestion' | 'accept' | 'reject' | 'flag' | 'unflag'
    | 'edit' | 'delete' | 'undelete';
  who: string;
  when: string; // 2026-11-09T14:30:00.123Z
  row?: string;
  field?: Field;
  quote?: string; // the selected text; empty for a comment on the whole field
  text?: string; // a comment's words, or a flag's note (may be empty)
  replace?: string; // a suggestion's new text for `quote`
  about?: string; // the comment a reply, resolve, reopen, edit or delete is about
  // Worked out by threads(), never written: when its author last edited it, and whether it is deleted.
  edited?: string;
  deleted?: boolean;
};
// resolved: done with (a resolved comment, or an accepted or rejected suggestion).
export type Thread = { comment: Note; replies: Note[]; resolved: boolean; decision?: 'accepted' | 'rejected'; deleted?: boolean };
export type Flag = { row: string; text: string; who: string; when: string };

// Every note, oldest first. Files that can't be read (half-synced) are skipped.
export async function listNotes(dir: FileSystemDirectoryHandle): Promise<Note[]> {
  const folder = await commentsFolder(dir, false);
  if (!folder) return [];
  const names: string[] = [];
  for await (const name of folder.keys()) if (name.endsWith('.json')) names.push(name);
  const notes: Note[] = [];
  for (const name of names.sort()) {
    try {
      const note = JSON.parse(await (await (await folder.getFileHandle(name)).getFile()).text());
      if (note.v === 1 && note.id && note.kind) notes.push(note);
    } catch {
      // Skipped: OneDrive may still be bringing it in.
    }
  }
  return notes;
}

export async function addNote(
  dir: FileSystemDirectoryHandle,
  entry: Omit<Note, 'v' | 'id' | 'when'>,
  now = new Date(),
): Promise<Note> {
  // Kept to the millisecond, so a resolve and a reopen in the same second still come in order. Names keep seconds.
  const when = now.toISOString();
  const note: Note = { v: 1, id: randomId(), ...entry, when };
  const folder = (await commentsFolder(dir, true))!;
  const name = `${when.replace(/\.\d+Z$/, 'Z').replace(/[-:]/g, '')}_${note.id}.json`;
  const writable = await (await folder.getFileHandle(name, { create: true })).createWritable();
  await writable.write(JSON.stringify(note, null, 2) + '\n');
  await writable.close();
  return note;
}

// Comments and suggestions with their replies, newest first; the newest resolve, accept, reject or reopen about
// each says where it stands. Edits by the author change the text; deleted ones (and a deleted comment's replies) are
// left out, unless `withDeleted` (Review keeps them for Undo, marked `deleted`).
export function threads(notes: Note[], withDeleted = false): Thread[] {
  const list: Thread[] = notes
    .filter((n) => n.kind === 'comment' || n.kind === 'suggestion')
    .map((comment) => ({ comment: { ...comment }, replies: [], resolved: false }));
  const byId = new Map(list.map((t) => [t.comment.id, t]));
  const own = new Map<string, Note>(list.map((t) => [t.comment.id, t.comment])); // comments, suggestions and replies
  for (const note of byTime(notes)) {
    if (note.kind === 'edit' || note.kind === 'delete' || note.kind === 'undelete') {
      const target = own.get(note.about ?? '');
      if (!target || target.who !== note.who) continue; // only the author may change it
      if (note.kind === 'edit') {
        if (note.text !== undefined) target.text = note.text;
        if (note.replace !== undefined) target.replace = note.replace;
        target.edited = note.when;
      } else target.deleted = note.kind === 'delete';
      continue;
    }
    const thread = note.about ? byId.get(note.about) : undefined;
    if (!thread) continue;
    if (note.kind === 'reply') {
      const reply = { ...note };
      thread.replies.push(reply);
      own.set(reply.id, reply);
    } else if (note.kind === 'reopen') (thread.resolved = false), (thread.decision = undefined);
    else if (note.kind === 'resolve') thread.resolved = true;
    else if (note.kind === 'accept' || note.kind === 'reject') {
      thread.resolved = true;
      thread.decision = note.kind === 'accept' ? 'accepted' : 'rejected';
    }
  }
  for (const t of list) {
    t.deleted = !!t.comment.deleted;
    if (!withDeleted) t.replies = t.replies.filter((r) => !r.deleted);
  }
  return (withDeleted ? list : list.filter((t) => !t.deleted)).reverse();
}

// The flagged rows among `rows` (the script's row ids, in order), in that order: the newest flag or unflag about
// each row decides. A flag on a row no longer in the script is left out (Undo of a delete brings it back).
export function flags(notes: Note[], rows: string[]): Map<string, Flag> {
  const newest = new Map<string, Note>();
  for (const note of byTime(notes)) if ((note.kind === 'flag' || note.kind === 'unflag') && note.row) newest.set(note.row, note);
  const found = new Map<string, Flag>();
  for (const row of rows) {
    const note = newest.get(row);
    if (note?.kind === 'flag') found.set(row, { row, text: note.text ?? '', who: note.who, when: note.when });
  }
  return found;
}

const byTime = (notes: Note[]) => [...notes].sort((a, b) => (a.when < b.when ? -1 : a.when > b.when ? 1 : 0));

async function commentsFolder(dir: FileSystemDirectoryHandle, create: boolean): Promise<FileSystemDirectoryHandle | null> {
  try {
    return await (await dir.getDirectoryHandle('.studio', { create })).getDirectoryHandle('comments', { create });
  } catch {
    return null;
  }
}

function randomId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => chars[b % 36]).join('');
}
