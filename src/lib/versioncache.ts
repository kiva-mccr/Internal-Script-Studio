// History files are written once and never changed (docs/studio-folder.md), so a file read once need not be read
// again (HI-3): kept in memory for this visit, and in this browser (IndexedDB) for the next ones.

import type { Version } from './history';

const DB = 'script-studio-history';
const STORE = 'versions';

// This visit's: per script folder, by file name. Repeated reads of the same script then only list the folder.
const memory = new WeakMap<FileSystemDirectoryHandle, Map<string, Version>>();

export function remembered(dir: FileSystemDirectoryHandle): Map<string, Version> {
  let known = memory.get(dir);
  if (!known) memory.set(dir, (known = new Map()));
  return known;
}

// The browser's key for a file: its name, size and time, so two scripts' files that share a name never mix.
export const fileKey = (name: string, file: File) => `${name}|${file.size}|${file.lastModified}`;

// Versions this browser kept from an earlier visit, by key. Storage refused (a private window): none.
export async function recallVersions(keys: string[]): Promise<Map<string, Version>> {
  const found = new Map<string, Version>();
  if (!keys.length) return found;
  try {
    const store = (await db()).transaction(STORE, 'readonly').objectStore(STORE);
    const got = await Promise.all(keys.map((key) => request<Version | undefined>(store.get(key))));
    keys.forEach((key, i) => got[i] && found.set(key, got[i]));
  } catch {
    // Read from the files instead.
  }
  return found;
}

export async function keepVersions(entries: [string, Version][]): Promise<void> {
  if (!entries.length) return;
  try {
    const tx = (await db()).transaction(STORE, 'readwrite');
    for (const [key, version] of entries) tx.objectStore(STORE).put(version, key);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = tx.onabort = () => reject(tx.error);
    });
  } catch {
    // Not kept: read from the files next visit.
  }
}

let opened: Promise<IDBDatabase> | null = null;
function db(): Promise<IDBDatabase> {
  opened ??= new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('No IndexedDB'));
    const open = indexedDB.open(DB, 1);
    open.onupgradeneeded = () => open.result.createObjectStore(STORE);
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error);
  });
  opened.catch(() => (opened = null));
  return opened;
}

function request<T>(r: IDBRequest): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result as T);
    r.onerror = () => reject(r.error);
  });
}
