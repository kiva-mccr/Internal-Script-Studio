// A script's history: one file per version in .studio/versions/ (docs/studio-folder.md), written once and never
// changed. Also what changed between two versions, in words.

import { frontValue, parseScript, type Row, type Script } from './script';

export type Kind = 'edit' | 'review' | 'restore' | 'merge' | 'outside' | 'restart' | 'official';
export type Version = {
  v: 1;
  id: string;
  parents: string[];
  who: string;
  when: string; // 2026-11-09T14:41:00Z
  kind: Kind;
  note: string;
  sha256: string;
  text: string;
};
export type Change = { where: string; old: string; new: string };

export const OUTSIDE = 'Outside the app';

// Every version, oldest first. Files that can't be read (half-synced) are skipped.
export async function listVersions(dir: FileSystemDirectoryHandle): Promise<Version[]> {
  const folder = await versionsFolder(dir, false);
  if (!folder) return [];
  const names: string[] = [];
  for await (const name of folder.keys()) if (name.endsWith('.json')) names.push(name);
  const versions: Version[] = [];
  for (const name of names.sort()) {
    try {
      const version = JSON.parse(await (await (await folder.getFileHandle(name)).getFile()).text());
      if (version.v === 1 && typeof version.text === 'string') versions.push(version);
    } catch {
      // Skipped: OneDrive may still be bringing it in.
    }
  }
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

// Writes a new version file and returns it.
export async function addVersion(
  dir: FileSystemDirectoryHandle,
  entry: { parents: string[]; who: string; kind: Kind; text: string; note?: string },
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

// Official versions are numbered v1, v2 … in the order they were published (versions oldest first).
export function officialNumbers(versions: Version[]): Map<string, number> {
  return new Map(versions.filter((v) => v.kind === 'official').map((v, i) => [v.id, i + 1]));
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
      if (was !== is) list.push({ where: `Row ${n} · ${label}`, old: was || '(empty)', new: is || '(empty)' });
    }
  }
  const kept = new Set(newRows.map((r) => r.row.id));
  for (const { row, n } of oldRows.values()) {
    if (!kept.has(row.id)) list.push({ where: `Row ${n} (removed)`, old: row.dialogue || row.onScreen || '(empty)', new: '' });
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
] as const;

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
