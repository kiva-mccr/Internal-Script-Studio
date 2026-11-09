// Review: comments, replies and resolving, one file each in .studio/comments/ (docs/studio-folder.md), written once
// and never changed. What happens to a comment later (resolve, reopen) is a new file; the newest one counts.

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
  about?: string; // the comment a reply, resolve or reopen is about
};
export type Thread = { comment: Note; replies: Note[]; resolved: boolean };

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

// Comments with their replies, newest comment first; resolved by the newest resolve or reopen about each.
export function threads(notes: Note[]): Thread[] {
  const list = notes.filter((n) => n.kind === 'comment').map((comment) => ({ comment, replies: [] as Note[], resolved: false }));
  const byId = new Map(list.map((t) => [t.comment.id, t]));
  for (const note of [...notes].sort((a, b) => (a.when < b.when ? -1 : a.when > b.when ? 1 : 0))) {
    const thread = note.about ? byId.get(note.about) : undefined;
    if (!thread) continue;
    if (note.kind === 'reply') thread.replies.push(note);
    else if (note.kind === 'resolve' || note.kind === 'reopen') thread.resolved = note.kind === 'resolve';
  }
  return list.reverse();
}

// A field's text cut into pieces, each quote marked where it is first found. Quotes no longer in the text, or
// overlapping one already marked, are left out.
export function highlight(text: string, marks: { id: string; quote: string }[]): { text: string; id?: string }[] {
  const found = marks
    .filter((m) => m.quote)
    .map((m) => ({ ...m, at: text.indexOf(m.quote) }))
    .filter((m) => m.at >= 0)
    .sort((a, b) => a.at - b.at);
  const parts: { text: string; id?: string }[] = [];
  let i = 0;
  for (const m of found) {
    if (m.at < i) continue;
    if (m.at > i) parts.push({ text: text.slice(i, m.at) });
    parts.push({ text: m.quote, id: m.id });
    i = m.at + m.quote.length;
  }
  if (i < text.length || !parts.length) parts.push({ text: text.slice(i) });
  return parts;
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
