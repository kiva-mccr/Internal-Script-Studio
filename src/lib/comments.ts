// Review: comments, suggestions, replies, resolving and accepting, one file each in .studio/comments/ (docs/studio-folder.md), written once
// and never changed. What happens to one later (resolve, accept, reject, reopen) is a new file; the newest counts.

export type Field = 'dialogue' | 'on_screen' | 'files';
export type Note = {
  v: 1;
  id: string;
  kind: 'comment' | 'reply' | 'resolve' | 'reopen' | 'suggestion' | 'accept' | 'reject';
  who: string;
  when: string; // 2026-11-09T14:30:00.123Z
  row?: string;
  field?: Field;
  quote?: string; // the selected text; empty for a comment on the whole field
  text?: string;
  replace?: string; // a suggestion's new text for `quote`
  about?: string; // the comment a reply, resolve or reopen is about
};
// resolved: done with (a resolved comment, or an accepted or rejected suggestion).
export type Thread = { comment: Note; replies: Note[]; resolved: boolean; decision?: 'accepted' | 'rejected' };

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
// each says where it stands.
export function threads(notes: Note[]): Thread[] {
  const list: Thread[] = notes
    .filter((n) => n.kind === 'comment' || n.kind === 'suggestion')
    .map((comment) => ({ comment, replies: [], resolved: false }));
  const byId = new Map(list.map((t) => [t.comment.id, t]));
  for (const note of [...notes].sort((a, b) => (a.when < b.when ? -1 : a.when > b.when ? 1 : 0))) {
    const thread = note.about ? byId.get(note.about) : undefined;
    if (!thread) continue;
    if (note.kind === 'reply') thread.replies.push(note);
    else if (note.kind === 'reopen') (thread.resolved = false), (thread.decision = undefined);
    else if (note.kind === 'resolve') thread.resolved = true;
    else if (note.kind === 'accept' || note.kind === 'reject') {
      thread.resolved = true;
      thread.decision = note.kind === 'accept' ? 'accepted' : 'rejected';
    }
  }
  return list.reverse();
}

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
