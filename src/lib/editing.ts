// "Sam is editing": one small file per person in .studio/editing/ (docs/studio-folder.md). Each person writes a new
// one every 30 s and removes their own older ones; on leaving, a last one marked `left` stays ("Sam was here", AP-37).
import { jsonNames, readJson, stamp, writeText } from './files';
import { ago, at } from './when';

// left: when the person left the script (their last file, AP-37); never editing then.
export type Editing = { v: 1; who: string; since: string; seen: string; last_written: string; left?: string };

const FRESH_FOR = 2 * 60 * 1000; // older than this, the person has gone (closed laptop)
const QUIET_FOR = 2 * 60 * 60 * 1000; // gone without leaving: "last seen" (amber) until this old, then "was here"
const BAR_FOR = 7 * 24 * 60 * 60 * 1000; // the top bar names the last person here up to this far back
export const KEEP_FOR = 30 * 24 * 60 * 60 * 1000; // older editing files are removed, and not listed

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

// Everyone's newest editing file, stale and left ones too (their last_written still counts when a script is opened).
// Anyone's file over 30 days old is removed (AP-37).
export async function readEditing(dir: FileSystemDirectoryHandle, now = Date.now()): Promise<Editing[]> {
  const folder = await editingFolder(dir, false);
  if (!folder) return [];
  const newest = new Map<string, Editing>();
  for (const name of await jsonNames(folder)) {
    const entry = await readJson<Editing>(folder, name);
    if (entry?.v !== 1 || !entry.who) continue; // half-written: skipped
    if (now - Date.parse(entry.seen) > KEEP_FOR) {
      await folder.removeEntry(name).catch(() => {});
      continue;
    }
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

// Has the script open now: seen in the last 2 minutes, and hasn't left.
export const isEditing = (e: Editing, now = Date.now()) => !e.left && now - Date.parse(e.seen) < FRESH_FOR;

// The other people who have the script open now.
export function othersEditing(entries: Editing[], me: string, now = Date.now()): string[] {
  return entries.filter((e) => fileName(e.who) !== fileName(me) && isEditing(e, now)).map((e) => e.who);
}

// Who has been here (AP-37): everyone else in the last 30 days, newest first. editing: has it open now; quiet:
// stopped checking in without leaving, under 2 hours ago (the laptop slept or lost the drive); here: left, or long gone.
export type Seen = { who: string; time: number; state: 'editing' | 'quiet' | 'here' };

export function whoWasHere(entries: Editing[], me: string, now = Date.now()): Seen[] {
  return entries
    .filter((e) => fileName(e.who) !== fileName(me) && now - Date.parse(e.seen) <= KEEP_FOR)
    .map((e): Seen => {
      const time = Date.parse(e.seen);
      return { who: e.who, time, state: isEditing(e, now) ? 'editing' : !e.left && now - time < QUIET_FOR ? 'quiet' : 'here' };
    })
    .sort((a, b) => b.time - a.time);
}

// The top bar when nobody else is editing: "Sam was here 12 min ago", "Sam last seen 3 min ago", '' past 7 days.
export function lastHereText(seen: Seen[], now = Date.now()): string {
  const last = seen[0];
  if (!last || last.state === 'editing' || now - last.time > BAR_FOR) return '';
  return `${last.who} ${last.state === 'quiet' ? 'last seen' : 'was here'} ${ago(last.time, now)}`;
}

// One line of the list: "editing now", "last seen 3 min ago", "3 h ago", then "Yesterday, 5:40 pm".
export function seenWhen(seen: Seen, now = Date.now()): string {
  if (seen.state === 'editing') return 'editing now';
  if (seen.state === 'quiet') return `last seen ${ago(seen.time, now)}`;
  return now - seen.time < 24 * 60 * 60 * 1000 ? ago(seen.time, now) : at(seen.time, now);
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
