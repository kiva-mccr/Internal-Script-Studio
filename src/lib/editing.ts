// "Sam is editing": one small file per person in .studio/editing/ (docs/studio-folder.md). The only files in
// .studio/ that change: each person writes a new one every 30 s and removes their own older ones.
import { jsonNames, readJson, stamp, writeText } from './files';

export type Editing = { v: 1; who: string; since: string; seen: string; last_written: string };

export const FRESH_FOR = 2 * 60 * 1000; // older than this, the person has gone (closed laptop)

export function fileName(who: string): string {
  return (who.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'someone') + '.json';
}

// A new file each time (`sam_<time>.json`), never one rewritten (FX-2: a network share refuses to replace a file
// someone else is reading), then this person's older ones are removed.
export async function writeEditing(dir: FileSystemDirectoryHandle, entry: Editing): Promise<void> {
  const folder = (await editingFolder(dir, true))!;
  const name = `${base(entry.who)}_${stamp()}.json`;
  await writeText(folder, name, JSON.stringify(entry) + '\n');
  for (const old of await ownFiles(folder, entry.who)) if (old < name) await folder.removeEntry(old).catch(() => {});
}

export async function removeEditing(dir: FileSystemDirectoryHandle, who: string): Promise<void> {
  const folder = await editingFolder(dir, false);
  if (folder) for (const name of await ownFiles(folder, who)) await folder.removeEntry(name).catch(() => {});
}

// Everyone's newest editing file, stale ones too (their last_written still counts when a script is opened).
export async function readEditing(dir: FileSystemDirectoryHandle): Promise<Editing[]> {
  const folder = await editingFolder(dir, false);
  if (!folder) return [];
  const newest = new Map<string, Editing>();
  for (const name of await jsonNames(folder)) {
    const entry = await readJson<Editing>(folder, name);
    if (entry?.v !== 1 || !entry.who) continue; // half-written: skipped
    const had = newest.get(fileName(entry.who));
    if (!had || had.seen <= entry.seen) newest.set(fileName(entry.who), entry);
  }
  return [...newest.values()];
}

// This person's files: `sam_<time>.json`, and `sam.json` from before FX-2.
async function ownFiles(folder: FileSystemDirectoryHandle, who: string): Promise<string[]> {
  const mine = base(who);
  return (await jsonNames(folder)).filter((name) => name === `${mine}.json` || /^\d{8}T\d+Z\.json$/.test(name.slice(mine.length + 1)) && name.startsWith(`${mine}_`));
}

const base = (who: string) => fileName(who).slice(0, -'.json'.length);

// The other people who have the script open now.
export function othersEditing(entries: Editing[], me: string, now = Date.now()): string[] {
  return entries
    .filter((e) => fileName(e.who) !== fileName(me) && now - Date.parse(e.seen) < FRESH_FOR)
    .map((e) => e.who);
}

// "Sam is editing", "Sam and Ana are editing", "Sam, Ana and Lee are editing".
export function editingText(names: string[]): string {
  if (!names.length) return '';
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
  return `${list} ${names.length === 1 ? 'is' : 'are'} editing`;
}

async function editingFolder(dir: FileSystemDirectoryHandle, create: boolean): Promise<FileSystemDirectoryHandle | null> {
  try {
    return await (await dir.getDirectoryHandle('.studio', { create })).getDirectoryHandle('editing', { create });
  } catch {
    return null;
  }
}

// Who wrote a script.md that no version matches: the person whose last save it is, or else the one other person
// editing it right now (their editing file can lag behind on a shared folder); '' if no one.
export function writerOf(entries: Editing[], sha: string, me: string, now = Date.now()): string {
  const matching = entries.find((e) => e.last_written === sha);
  if (matching) return matching.who;
  const others = othersEditing(entries, me, now);
  return others.length === 1 ? others[0] : '';
}
