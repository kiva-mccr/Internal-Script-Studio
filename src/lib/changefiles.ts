// The change files in a script's `.studio/changes/` (FX-2, docs/studio-folder.md): each person's saves, one new
// file each, and the keeper's notes of which of them script.md already holds.

import type { Delta } from './changes';
import { jsonNames, readJson, stamp, writeNew } from './files';
import { fileName } from './editing';

export type Change = { v: 1; id: string; who: string; when: string; delta: Delta };
// Written by the keeper with each script.md it writes: the changes in it, and its fingerprint (sha256).
export type Folded = { v: 1; sha256: string; changes: string[] };

const CHANGE = /^\d{8}T\d+Z_[a-z0-9]+_[^_]+\.json$/; // <time>_<id>_<person>.json
const FOLDED = /^folded_\d{8}T\d+Z\.json$/;

// Writes one change as a new file; returns its name.
export async function writeChange(dir: FileSystemDirectoryHandle, who: string, delta: Delta, at = new Date()): Promise<string> {
  const id = randomId();
  const name = `${stamp(at)}_${id}_${fileName(who)}`;
  const change: Change = { v: 1, id, who, when: at.toISOString(), delta };
  await writeNew((await changesFolder(dir, true))!, name, JSON.stringify(change) + '\n');
  return name;
}

// The change files there now, oldest first.
export async function listChanges(dir: FileSystemDirectoryHandle): Promise<string[]> {
  const folder = await changesFolder(dir, false);
  return folder ? (await jsonNames(folder)).filter((name) => CHANGE.test(name)) : [];
}

// One change, or null while it is still being written or synced.
export async function readChange(dir: FileSystemDirectoryHandle, name: string): Promise<Change | null> {
  const folder = await changesFolder(dir, false);
  const change = folder ? await readJson<Change>(folder, name) : null;
  return change?.v === 1 && change.delta ? change : null;
}

export async function removeChange(dir: FileSystemDirectoryHandle, name: string): Promise<void> {
  await (await changesFolder(dir, false))?.removeEntry(name).catch(() => {});
}

// The keeper's newest note of what script.md holds, or null.
export async function readFolded(dir: FileSystemDirectoryHandle): Promise<Folded | null> {
  const folder = await changesFolder(dir, false);
  if (!folder) return null;
  const names = (await jsonNames(folder)).filter((name) => FOLDED.test(name));
  for (const name of names.reverse()) {
    const folded = await readJson<Folded>(folder, name);
    if (folded?.v === 1) return folded;
  }
  return null;
}

// A new note of what script.md holds; older notes are removed.
export async function writeFolded(dir: FileSystemDirectoryHandle, folded: Omit<Folded, 'v'>): Promise<void> {
  const folder = (await changesFolder(dir, true))!;
  const name = `folded_${stamp()}.json`;
  await writeNew(folder, name, JSON.stringify({ v: 1, ...folded }) + '\n');
  for (const old of await jsonNames(folder)) if (FOLDED.test(old) && old < name) await folder.removeEntry(old).catch(() => {});
}

async function changesFolder(dir: FileSystemDirectoryHandle, create: boolean): Promise<FileSystemDirectoryHandle | null> {
  try {
    return await (await dir.getDirectoryHandle('.studio', { create })).getDirectoryHandle('changes', { create });
  } catch {
    return null;
  }
}

function randomId(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]).join('');
}
