// A script's history: one file per version in .studio/versions/ (docs/studio-folder.md), written once and never
// changed. Also what changed between two versions, in words.

import { frontValue, parseScript, type Row, type Script } from './script';
import { fileKey, keepVersions, recallVersions, remembered } from './versioncache';

type Kind = 'edit' | 'review' | 'restore' | 'merge' | 'outside' | 'restart' | 'official';
export type Version = {
  v: 1;
  id: string;
  parents: string[];
  who: string;
  when: string; // 2026-11-09T14:41:00Z
  kind: Kind;
  note: string;
  message?: string; // the note with "Sent for review" (RV-8) or "Sent back to writer" (RV-13); absent when none was written
  official?: true; // a send for review that is also the next official version (RV-9); absent otherwise
  sha256: string;
  text: string;
};
// row and field (as comments name them) say which cell changed; a removed row has no field.
export type Change = { where: string; old: string; new: string; row?: string; field?: 'dialogue' | 'on_screen' | 'files' };

export const OUTSIDE = 'Outside the app';

// Every version, oldest first. Files that can't be read (half-synced) are skipped.
export async function listVersions(dir: FileSystemDirectoryHandle): Promise<Version[]> {
  // One read of a script at a time: several screens ask at once when it opens, and the first read is the slow one.
  const before = reading.get(dir);
  const mine = (async () => {
    await before?.catch(() => {});
    return readVersions(dir);
  })();
  reading.set(dir, mine);
  return mine;
}
const reading = new WeakMap<FileSystemDirectoryHandle, Promise<Version[]>>();

async function readVersions(dir: FileSystemDirectoryHandle): Promise<Version[]> {
  const folder = await versionsFolder(dir, false);
  if (!folder) return [];
  const names: string[] = [];
  for await (const name of folder.keys()) if (name.endsWith('.json')) names.push(name);
  // Files never change, so only files not read before are read (HI-3): first this visit's, then this browser's.
  const known = remembered(dir);
  const files = new Map<string, File>();
  for (const name of names) {
    if (known.has(name)) continue;
    try {
      files.set(name, await (await folder.getFileHandle(name)).getFile());
    } catch {
      // Skipped: the shared folder may still be bringing it in.
    }
  }
  const kept = await recallVersions([...files].map(([name, file]) => fileKey(name, file)));
  const fresh: [string, Version][] = [];
  for (const [name, file] of files) {
    const key = fileKey(name, file);
    let version = kept.get(key);
    if (!version) {
      try {
        version = JSON.parse(await file.text());
      } catch {
        continue; // Half-synced: read again next time.
      }
      if (version?.v !== 1 || typeof version.text !== 'string') continue;
      fresh.push([key, version]);
    }
    known.set(name, version);
  }
  void keepVersions(fresh);
  const versions = names.sort().flatMap((name) => known.get(name) ?? []);
  // Names sort by the second they were made; within the same second, by how many versions lie before (parents first).
  const byId = new Map(versions.map((v) => [v.id, v]));
  const depth = new Map<string, number>();
  const depthOf = (v: Version, seen = new Set<string>()): number => {
    if (depth.has(v.id)) return depth.get(v.id)!;
    seen.add(v.id);
    const parents = v.parents.map((id) => byId.get(id)).filter((p): p is Version => !!p && !seen.has(p.id));
    const d = parents.length ? 1 + Math.max(...parents.map((p) => depthOf(p, seen))) : 0;
    depth.set(v.id, d);
    return d;
  };
  return versions.sort((a, b) => (a.when !== b.when ? (a.when < b.when ? -1 : 1) : depthOf(a) - depthOf(b)));
}

// The note sent with the script for review (RV-8): from the newest review change, if that was a send with a note.
export function reviewNote(versions: Version[]): Version | undefined {
  const newest = versions.findLast((v) => v.kind === 'review');
  return newest?.note === 'Sent for review' && newest.message ? newest : undefined;
}

// The newest review entry when it is a send back (RV-13): Write shows it, and its note, at the top of Comments.
export function backNote(versions: Version[]): Version | undefined {
  const newest = versions.findLast((v) => v.kind === 'review');
  return newest?.note.startsWith('Sent back') ? newest : undefined;
}

// The version from when the last review ended (RV-4): the newest "Sent back to writer" or "Approved" (also
// "Approved, 2 still open"). Review marks what changed since it.
export function reviewEnd(versions: Version[]): Version | undefined {
  return versions.findLast((v) => v.kind === 'review' && (v.note.startsWith('Sent back') || v.note.startsWith('Approved')));
}

// Rows changed since `before` (RV-4), matched by id: each changed row with its old self (null for a new row), and
// each removed row with the id of the row it came after ('' for the top). A moved row is not changed.
export function sinceReview(before: Script, after: Script): { changed: Map<string, Row | null>; removed: { after: string; row: Row }[] } {
  const old = new Map(numbered(before).map(({ row }) => [row.id, row]));
  const changed = new Map<string, Row | null>();
  for (const { row } of numbered(after)) {
    const was = old.get(row.id);
    if (!was) changed.set(row.id, null);
    else if (FIELDS.some(([field]) => fieldText(was, field) !== fieldText(row, field))) changed.set(row.id, was);
  }
  const kept = new Set(numbered(after).map(({ row }) => row.id));
  const removed: { after: string; row: Row }[] = [];
  let previous = '';
  for (const { row } of numbered(before)) {
    if (kept.has(row.id)) previous = row.id;
    else removed.push({ after: previous, row });
  }
  return { changed, removed };
}

// Writes a new version file and returns it.
export async function addVersion(
  dir: FileSystemDirectoryHandle,
  entry: { parents: string[]; who: string; kind: Kind; text: string; note?: string; message?: string; official?: boolean },
  now = new Date(),
): Promise<Version> {
  const version: Version = {
    v: 1,
    id: randomId(8),
    parents: entry.parents,
    who: entry.who,
    when: now.toISOString().replace(/\.\d+Z$/, 'Z'),
    kind: entry.kind,
    note: entry.note ?? '',
    ...(entry.message ? { message: entry.message } : {}),
    ...(entry.official ? { official: true as const } : {}),
    sha256: await sha256(entry.text),
    text: entry.text,
  };
  const folder = (await versionsFolder(dir, true))!;
  const name = `${version.when.replace(/[-:]/g, '')}_${version.id}.json`;
  const writable = await (await folder.getFileHandle(name, { create: true })).createWritable();
  await writable.write(JSON.stringify(version, null, 2) + '\n');
  await writable.close();
  return version;
}

// The newest version's author, without reading every version (for the list).
export async function lastEditor(dir: FileSystemDirectoryHandle): Promise<string> {
  const folder = await versionsFolder(dir, false);
  if (!folder) return '';
  const names: string[] = [];
  for await (const name of folder.keys()) if (name.endsWith('.json')) names.push(name);
  names.sort();
  const newest = names.at(-1);
  if (!newest) return '';
  // Two made in the same second: only the full list knows which came last.
  if (names.at(-2)?.slice(0, 16) === newest.slice(0, 16)) return (await listVersions(dir)).at(-1)?.who ?? '';
  try {
    return JSON.parse(await (await (await folder.getFileHandle(newest)).getFile()).text()).who ?? '';
  } catch {
    return '';
  }
}

export async function sha256(text: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, '0')).join('');
}

// An official version: published from History, or made by a send for review (RV-9).
export const isOfficial = (v: Version) => v.kind === 'official' || !!v.official;
export const isSend = (v: Version) => v.kind === 'review' && v.note === 'Sent for review';

// When comments on hold come back (RV-19): the times of every send for review and official version.
export const holdEnds = (versions: Version[]) => versions.filter((v) => isSend(v) || isOfficial(v)).map((v) => v.when);

// Official versions are numbered v1, v2 … in the order they were made (versions oldest first).
export function officialNumbers(versions: Version[]): Map<string, number> {
  return new Map(versions.filter(isOfficial).map((v, i) => [v.id, i + 1]));
}

// Two texts are the same script when only the review status or the authors differ: a send or a save by someone
// new changes those lines, not the script (RV-9).
export function sameScript(a: string, b: string): boolean {
  const plain = (text: string) => text.replace(/^---\n[\s\S]*?\n---\n/, (front) => front.replace(/^(status|authors):.*\n/gm, ''));
  return plain(a) === plain(b);
}

// The number of the official version a script's text is, or 0 once anything has changed since the newest official
// version (versions oldest first). Printing and the exports show it (EX-1, EX-7).
export function officialNumber(versions: Version[], text: string): number {
  const newest = versions.findLast(isOfficial);
  return newest && sameScript(newest.text, text) ? (officialNumbers(versions).get(newest.id) ?? 0) : 0;
}

// What a send for review makes (RV-9): the next official version, or none when the script is still the newest one
// (`still`), however that one was made, so a version published by hand and then sent is never made twice.
export function sendVersion(versions: Version[], text: string): { n: number; still: boolean } {
  const n = officialNumber(versions, text);
  return n ? { n, still: true } : { n: officialNumbers(versions).size + 1, still: false };
}

// Versions nothing was made from: normally one. Two means two saves at the same time.
export function heads(versions: Version[]): Version[] {
  const used = new Set(versions.flatMap((v) => v.parents));
  return versions.filter((v) => !used.has(v.id));
}

// The newest version both were made from.
export function ancestor(versions: Version[], a: Version, b: Version): Version | undefined {
  const byId = new Map(versions.map((v) => [v.id, v]));
  const above = (v: Version) => {
    const seen = new Set<string>();
    const todo = [...v.parents];
    while (todo.length) {
      const id = todo.shift()!;
      if (seen.has(id)) continue;
      seen.add(id);
      todo.push(...(byId.get(id)?.parents ?? []));
    }
    return seen;
  };
  const fromA = above(a);
  return versions.filter((v) => fromA.has(v.id) && above(b).has(v.id)).at(-1);
}

// What History shows as a version's title.
export function summary(version: Version, before: Version | undefined): string {
  if (version.note) return version.note;
  if (version.kind === 'restart') return 'History starts here';
  if (version.kind === 'outside') return 'Changed outside the app';
  if (!before) return 'Created the script';
  return describe(parseScript(before.text), parseScript(version.text));
}

// "Edited rows 3 and 4, added row 5", worked out by matching rows by id.
export function describe(before: Script, after: Script): string {
  const { edited, added, removed, moved } = compareRows(before, after);
  const parts: string[] = [];
  if (edited.length) parts.push(`edited ${rowList(edited)}`);
  if (added.length) parts.push(`added ${rowList(added)}`);
  if (removed.length) parts.push(`removed ${rowList(removed)}`);
  if (!parts.length && moved) parts.push('moved rows');
  if (!parts.length && frontValue(before.front, 'status') !== frontValue(after.front, 'status')) parts.push('changed the status');
  if (!parts.length && frontValue(before.front, 'title') !== frontValue(after.front, 'title')) parts.push('changed the title');
  if (!parts.length && sectionTitles(before) !== sectionTitles(after)) parts.push('changed the sections');
  if (!parts.length) return 'No changes to the rows';
  const text = parts.join(', ');
  return text[0].toUpperCase() + text.slice(1);
}

// Each changed field, old and new, for the History screen.
export function changes(beforeText: string | undefined, afterText: string): Change[] {
  const after = parseScript(afterText);
  if (beforeText === undefined) return [{ where: 'Script', old: '(new file)', new: frontValue(after.front, 'title') || '' }];
  const before = parseScript(beforeText);
  const list: Change[] = [];
  for (const key of ['title', 'status']) {
    const old = frontValue(before.front, key);
    const now = frontValue(after.front, key);
    if (old !== now) list.push({ where: key === 'title' ? 'Title' : 'Status', old: old || '(none)', new: now || '(none)' });
  }
  const oldRows = new Map(numbered(before).map((r) => [r.row.id, r]));
  const newRows = numbered(after);
  for (const { row, n } of newRows) {
    const old = oldRows.get(row.id)?.row;
    for (const [field, label] of FIELDS) {
      const was = old ? fieldText(old, field) : '';
      const is = fieldText(row, field);
      if (was !== is) list.push({ where: `Row ${n} · ${label}`, old: was || '(empty)', new: is || '(empty)', row: row.id, field: FIELD_KEY[field] });
    }
  }
  const kept = new Set(newRows.map((r) => r.row.id));
  for (const { row, n } of oldRows.values()) {
    if (!kept.has(row.id)) list.push({ where: `Row ${n} (removed)`, old: row.dialogue || row.onScreen || '(empty)', new: '', row: row.id });
  }
  if (!list.length && sectionTitles(before) !== sectionTitles(after)) {
    list.push({ where: 'Sections', old: sectionTitles(before) || '(none)', new: sectionTitles(after) || '(none)' });
  }
  return list;
}

const FIELDS = [
  ['dialogue', 'Dialogue'],
  ['onScreen', 'On screen'],
  ['files', 'Images & files'],
  ['timeline', 'Timeline'],
] as const;
const FIELD_KEY = { dialogue: 'dialogue', onScreen: 'on_screen', files: 'files', timeline: undefined } as const;

function fieldText(row: Row, field: (typeof FIELDS)[number][0]): string {
  return field === 'files' ? row.files.join('\n') : row[field];
}

function numbered(script: Script): { row: Row; n: number }[] {
  return script.blocks.filter((b): b is Row => b.type === 'row').map((row, i) => ({ row, n: i + 1 }));
}

function compareRows(before: Script, after: Script) {
  const oldRows = new Map(numbered(before).map((r) => [r.row.id, r.row]));
  const newRows = numbered(after);
  const edited: number[] = [];
  const added: number[] = [];
  for (const { row, n } of newRows) {
    const old = oldRows.get(row.id);
    if (!old) added.push(n);
    else if (FIELDS.some(([field]) => fieldText(old, field) !== fieldText(row, field))) edited.push(n);
  }
  const kept = new Set(newRows.map((r) => r.row.id));
  const removed = numbered(before).filter((r) => !kept.has(r.row.id)).map((r) => r.n);
  const order = (s: Script) => numbered(s).map((r) => r.row.id).filter((id) => kept.has(id) && oldRows.has(id)).join();
  return { edited, added, removed, moved: order(before) !== order(after) };
}

function rowList(numbers: number[]): string {
  if (numbers.length === 1) return `row ${numbers[0]}`;
  if (numbers.length > 4) return `${numbers.length} rows`;
  return `rows ${numbers.slice(0, -1).join(', ')} and ${numbers.at(-1)}`;
}

function sectionTitles(script: Script): string {
  return script.blocks.flatMap((b) => (b.type === 'section' ? [b.title] : [])).join(' · ');
}

async function versionsFolder(dir: FileSystemDirectoryHandle, create: boolean): Promise<FileSystemDirectoryHandle | null> {
  try {
    const studio = await dir.getDirectoryHandle('.studio', { create });
    return await studio.getDirectoryHandle('versions', { create });
  } catch {
    return null;
  }
}

function randomId(length: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from(crypto.getRandomValues(new Uint8Array(length)), (b) => chars[b % 36]).join('');
}
