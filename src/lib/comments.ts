// Review: comments, suggestions, replies, resolving and accepting, one file each in .studio/comments/ (docs/studio-folder.md), written once
// and never changed. What happens to one later (resolve, accept, reject, reopen) is a new file; the newest counts.
// Editing your own (RV-7) is the same: an `edit` (new text or replace) or a `delete` / `undelete` about one; only the
// author's count, and the newest counts.
// Flags on rows (AP-9) live there too: a `flag` (with its note) or an `unflag`; the newest about a row counts.
// On hold (RV-19): a `hold` about a comment or suggestion shelves it; a `reopen` takes it off hold. A hold lasts
// until the next send for review or official version after it (`ends`), then the comment is open again, marked `back`.
// Files on comments (RV-11): a comment's or reply's attached files are kept in .studio/files/<its id>/, written once;
// an edit lists the files it keeps and adds its own new ones under its own id.

import { safeName } from './folder';
import { plain } from './format';
import { readFileRef, type Row } from './script';

export type Field = 'dialogue' | 'on_screen' | 'files';
// An attached file (RV-11): `path` is inside the script's folder, `.studio/files/<note id>/<name>`.
export type Attachment = { name: string; path: string; size: number };
export const MAX_FILE = 50 * 1024 * 1024; // 50 MB: bigger things go in OneDrive, as a link in the text
export type Note = {
  v: 1;
  id: string;
  kind:
    | 'comment' | 'reply' | 'resolve' | 'reopen' | 'suggestion' | 'accept' | 'reject' | 'flag' | 'unflag'
    | 'edit' | 'delete' | 'undelete' | 'hold';
  who: string;
  when: string; // 2026-11-09T14:30:00.123Z
  row?: string;
  field?: Field;
  quote?: string; // the selected text; empty for a comment on the whole field
  text?: string; // a comment's words, or a flag's note (may be empty)
  replace?: string; // a suggestion's new text for `quote`
  about?: string; // the comment a reply, resolve, reopen, hold, edit or delete is about
  files?: Attachment[]; // a comment's or reply's files; on an edit, the whole new list
  // Worked out by threads(), never written: when its author last edited it, and whether it is deleted.
  edited?: string;
  deleted?: boolean;
};
// resolved: done with (a resolved comment, or an accepted or rejected suggestion); by: who resolved or decided it.
// held: put on hold (RV-19), by whom and when; back: who had put it on hold, once a send or a version brought it back.
export type Thread = {
  comment: Note; replies: Note[]; resolved: boolean; by?: string; decision?: 'accepted' | 'rejected'; deleted?: boolean;
  held?: { who: string; when: string }; back?: string;
};
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
      // Skipped: the shared folder may still be bringing it in.
    }
  }
  return notes;
}

// Writes a note; `attach` are new files for it (RV-11), copied first into .studio/files/<its id>/ and added to the
// end of `files`, so the note never names a file that isn't there.
export async function addNote(
  dir: FileSystemDirectoryHandle,
  entry: Omit<Note, 'v' | 'id' | 'when'>,
  now = new Date(),
  attach: File[] = [],
): Promise<Note> {
  // Kept to the millisecond, so a resolve and a reopen in the same second still come in order. Names keep seconds.
  const when = now.toISOString();
  const note: Note = { v: 1, id: randomId(), ...entry, when };
  if (attach.length) note.files = [...(entry.files ?? []), ...(await saveFiles(dir, note.id, attach))];
  const folder = (await commentsFolder(dir, true))!;
  const name = `${when.replace(/\.\d+Z$/, 'Z').replace(/[-:]/g, '')}_${note.id}.json`;
  const writable = await (await folder.getFileHandle(name, { create: true })).createWritable();
  await writable.write(JSON.stringify(note, null, 2) + '\n');
  await writable.close();
  return note;
}

// Comments and suggestions with their replies, newest first; the newest resolve, accept, reject or reopen about
// each says where it stands. Edits by the author change the text; deleted ones (and a deleted comment's replies) are
// left out, unless `withDeleted` (Review keeps them for Undo, marked `deleted`). `ends` are the times of sends for
// review and official versions (`holdEnds`): a hold made before one of them is over (RV-19).
export function threads(notes: Note[], withDeleted = false, ends: string[] = []): Thread[] {
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
        if (note.files !== undefined) target.files = note.files;
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
      continue;
    }
    thread.held = thread.back = undefined; // whatever happens to it next ends a hold
    if (note.kind === 'hold') thread.held = { who: note.who, when: note.when };
    else if (note.kind === 'reopen') (thread.resolved = false), (thread.decision = undefined), (thread.by = undefined);
    else if (note.kind === 'resolve') (thread.resolved = true), (thread.by = note.who);
    else if (note.kind === 'accept' || note.kind === 'reject') {
      thread.resolved = true;
      thread.by = note.who;
      thread.decision = note.kind === 'accept' ? 'accepted' : 'rejected';
    }
  }
  const times = ends.map(Date.parse);
  for (const t of list) {
    if (t.held && times.some((end) => end > Date.parse(t.held!.when))) (t.back = t.held.who), (t.held = undefined);
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

// What a cell shows; files by their names, as in Write (a quote in Images & files is of what is shown).
export function fieldText(row: Row, field: Field): string {
  return field === 'files' ? row.files.map((f) => readFileRef(f).label).join('\n') : field === 'on_screen' ? row.onScreen : row.dialogue;
}

// A comment's quote is no longer in its row: it is on text that has since changed.
export function quoteGone(comment: Note, rows: Row[]): boolean {
  const row = rows.find((r) => r.id === comment.row);
  return !!comment.quote && (!row || !plain(fieldText(row, comment.field ?? 'dialogue')).includes(comment.quote));
}

// A size as people say it: 180 KB, 2.4 MB, 1.8 GB.
export function sizeText(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  const mb = bytes / (1024 * 1024);
  if (mb < 1024) return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
  return `${(mb / 1024).toFixed(1)} GB`;
}

// Why a file can't be attached, or '' if it can.
export function tooBig(file: File): string {
  return file.size > MAX_FILE
    ? `${file.name} is too big to attach (${sizeText(file.size)}; the limit is 50 MB). Put it somewhere shared and paste its link in the comment instead.`
    : '';
}

async function saveFiles(dir: FileSystemDirectoryHandle, id: string, files: File[]): Promise<Attachment[]> {
  const studio = await dir.getDirectoryHandle('.studio', { create: true });
  const folder = await (await studio.getDirectoryHandle('files', { create: true })).getDirectoryHandle(id, { create: true });
  const taken = new Set<string>();
  const saved: Attachment[] = [];
  for (const file of files) {
    const dot = file.name.lastIndexOf('.');
    const stem = safeName(dot > 0 ? file.name.slice(0, dot) : file.name) || 'file';
    const ext = dot > 0 ? file.name.slice(dot).replace(/[\\/:*?"<>|\s]/g, '') : '';
    let name = stem + ext;
    for (let n = 2; taken.has(name.toLowerCase()); n++) name = `${stem} ${n}${ext}`;
    taken.add(name.toLowerCase());
    const writable = await (await folder.getFileHandle(name, { create: true })).createWritable();
    await writable.write(file);
    await writable.close();
    saved.push({ name, path: `.studio/files/${id}/${name}`, size: file.size });
  }
  return saved;
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
