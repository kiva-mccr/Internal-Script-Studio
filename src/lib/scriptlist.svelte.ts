// The script list's facts (AP-40): each script's title, status and counts, remembered in this browser with a
// fingerprint of its files (names and dates, no file opened), so a script is read again only when its files changed.
// Scripts on screen are read first.

import { assetList, countMissing } from './assets';
import { flags, listNotes } from './comments';
import { fileIn, readScript, scriptHead, type ScriptInfo } from './folder';
import { forMe, type ForMe } from './forme';
import { listVersions } from './history';
import { countWords } from './readtime.svelte';
import { keep, recall } from './remember';
import { parseScript, rows } from './script';
import { readTakes, takeLength } from './voice.svelte';

export type Counts = {
  missing: number; // files in the Files column not in the folder (EX-6)
  flagged: number; // flagged rows (AP-9)
  mine: ForMe; // what waits for you (RV-14)
  takeSeconds: number; // the takes' length (AP-12)
  words: number; // dialogue words in rows with no take, timed at the speaking speed when shown
  dirs: string[]; // the folders the Files column points into, part of the fingerprint
};
export type Entry = ScriptInfo & { counts?: Counts };
type Kept = { print: string; entry: Entry };

const WORKERS = 4; // scripts read at once: a network drive answers each call slowly, not several calls slowly

// The length as Play times it (lib/play.svelte.ts): the takes, plus read time for rows with none. Recorded once no
// row with dialogue is left without a take.
export function length(counts: Counts, wpm: number): { seconds: number; recorded: boolean } | null {
  const seconds = counts.takeSeconds + (counts.words / wpm) * 60;
  return seconds > 0 ? { seconds, recorded: counts.words === 0 } : null;
}

// Everything the list shows that comes from inside a script, read from its files.
export async function readCounts(dir: FileSystemDirectoryHandle, me: string, status: string): Promise<Counts> {
  const script = parseScript(await readScript(dir));
  const takes = await readTakes(dir);
  let takeSeconds = 0;
  let words = 0;
  for (const row of rows(script)) {
    const take = takes[row.id];
    if (take) takeSeconds += Math.max(0, takeLength(take));
    else words += countWords(row.dialogue);
  }
  const notes = await listNotes(dir);
  // History only matters for a review or a send back, so an approved script's isn't read.
  const versions = status === 'approved' ? [] : await listVersions(dir);
  const paths = assetList(script).flatMap((a) => (a.kind === 'path' ? [a.target] : []));
  return {
    missing: await countMissing(dir, script),
    flagged: flags(notes, rows(script).map((row) => row.id)).size,
    mine: forMe(me, status, versions, notes),
    takeSeconds,
    words,
    dirs: [...new Set(paths.map((p) => parts(p).slice(0, -1).join('/')))].sort(),
  };
}

const parts = (path: string) => path.split('/').filter((p) => p && p !== '.' && p !== '..');

// The names in a folder inside the script's, sorted; '-' when there is no such folder.
async function names(dir: FileSystemDirectoryHandle, path: string[]): Promise<string> {
  try {
    let at = dir;
    for (const part of path) at = await at.getDirectoryHandle(part);
    const found: string[] = [];
    for await (const name of at.keys()) found.push(name);
    return found.sort().join('/');
  } catch {
    return '-';
  }
}

// Takes are rewritten when recorded again (lib/voice.svelte.ts), so their sizes and dates count, not only names.
async function takeDates(dir: FileSystemDirectoryHandle): Promise<string> {
  try {
    const found: string[] = [];
    for await (const [name, handle] of (await dir.getDirectoryHandle('voice')).entries()) {
      if (handle.kind !== 'file' || !name.endsWith('.json')) continue;
      const file = await (handle as FileSystemFileHandle).getFile();
      found.push(`${name}:${file.size}:${file.lastModified}`);
    }
    return found.sort().join('/');
  } catch {
    return '-';
  }
}

// A script's fingerprint, apart from the folders its files are in: script.md's size and date, the names in History
// and comments (written once, never changed: docs/studio-folder.md) and the takes. Null when there's no script.md.
export async function basePrint(dir: FileSystemDirectoryHandle): Promise<string | null> {
  const [file, versions, comments, takes] = await Promise.all([
    fileIn(dir, 'script.md'),
    names(dir, ['.studio', 'versions']),
    names(dir, ['.studio', 'comments']),
    takeDates(dir),
  ]);
  return file ? [`${file.size}:${file.lastModified}`, versions, comments, takes].join('\n') : null;
}

// The names in the folders the Files column points into, for the missing count.
export async function dirsPrint(dir: FileSystemDirectoryHandle, dirs: string[]): Promise<string> {
  return (await Promise.all(dirs.map((d) => names(dir, parts(d))))).join('\n');
}

// A short hash of a long fingerprint (FNV-1a), so the browser keeps little.
export function hash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(36) + text.length.toString(36);
}

export class ScriptList {
  entries = $state.raw<Record<string, Entry>>({}); // by folder name
  ready = $state(false); // every script's title and status is known (from this browser or its files)
  busy = $state(false); // checking the scripts' files
  #root: FileSystemDirectoryHandle;
  #me: string;
  #kept: Record<string, Kept>;
  #onScreen = new Set<string>();
  #running = false;
  #again = false;
  #stopped = false;
  #saving: ReturnType<typeof setTimeout> | undefined;

  constructor(root: FileSystemDirectoryHandle, me: string) {
    this.#root = root;
    this.#me = me;
    this.#kept = this.#recall();
    const entries: Record<string, Entry> = {};
    for (const [name, kept] of Object.entries(this.#kept)) entries[name] = kept.entry;
    this.entries = entries;
    this.ready = Object.keys(entries).length > 0;
  }

  // A row came into view or left it: rows on screen are checked first.
  seen(name: string, on: boolean) {
    if (on) this.#onScreen.add(name);
    else this.#onScreen.delete(name);
  }

  // Stops reading (the list was left), keeping what was read so far.
  stop() {
    this.#stopped = true;
    this.#keep();
  }

  // Lists the folder and checks every script, reading only those whose files changed. Throws when the folder
  // itself can't be read. Asked again while running: runs once more after.
  async refresh(): Promise<void> {
    if (this.#running) {
      this.#again = true;
      return;
    }
    this.#running = this.busy = true;
    try {
      do {
        this.#again = false;
        await this.#pass();
      } while (this.#again && !this.#stopped);
    } finally {
      this.#running = this.busy = false;
    }
  }

  async #pass() {
    const folders: FileSystemDirectoryHandle[] = [];
    for await (const entry of this.#root.values()) {
      if (entry.kind === 'directory' && !entry.name.startsWith('.')) folders.push(entry as FileSystemDirectoryHandle);
    }
    const here = new Set(folders.map((f) => f.name));
    this.entries = Object.fromEntries(Object.entries(this.entries).filter(([name]) => here.has(name)));
    // Scripts this browser hasn't seen: their title and status first, all of them, so the list shows whole.
    const unknown = folders.filter((f) => !this.entries[f.name]);
    await this.#each(unknown, async (dir) => {
      const head = await scriptHead(dir).catch(() => null);
      if (head) this.#put(dir.name, head);
    });
    this.ready = true;
    // Then each script's counts: those on screen first.
    await this.#each(folders, (dir) => this.#check(dir), true);
    this.#keep();
  }

  // Runs `work` on each folder, a few at once; with `screenFirst`, those on screen go ahead of the rest.
  async #each(folders: FileSystemDirectoryHandle[], work: (dir: FileSystemDirectoryHandle) => Promise<void>, screenFirst = false) {
    const queue = [...folders];
    const next = () => {
      if (this.#stopped) return undefined;
      const i = screenFirst ? queue.findIndex((f) => this.#onScreen.has(f.name)) : -1;
      return queue.splice(i >= 0 ? i : 0, 1)[0];
    };
    await Promise.all(Array.from({ length: WORKERS }, async () => {
      for (let dir = next(); dir; dir = next()) await work(dir);
    }));
  }

  async #check(dir: FileSystemDirectoryHandle) {
    try {
      const kept = this.#kept[dir.name];
      const base = await basePrint(dir);
      if (base === null) return this.#drop(dir.name);
      const known = kept?.entry.counts;
      if (kept && known && kept.print === hash([this.#me, base, await dirsPrint(dir, known.dirs)].join('\n'))) {
        if (this.entries[dir.name] !== kept.entry) this.#put(dir.name, kept.entry);
        return;
      }
      const head = await scriptHead(dir);
      if (!head) return this.#drop(dir.name);
      const counts = await readCounts(dir, this.#me, head.status);
      const entry = { ...head, counts };
      this.#kept[dir.name] = { print: hash([this.#me, base, await dirsPrint(dir, counts.dirs)].join('\n')), entry };
      this.#put(dir.name, entry);
      // Kept every few seconds too, so a first visit's reading isn't lost if the tab closes halfway.
      this.#saving ??= setTimeout(() => this.#keep(), 3000);
    } catch {
      // Mid-sync: read next time.
    }
  }

  #put(name: string, entry: Entry) {
    this.entries = { ...this.entries, [name]: entry };
  }

  #drop(name: string) {
    delete this.#kept[name];
    const { [name]: _gone, ...rest } = this.entries;
    this.entries = rest;
  }

  get #key() {
    return `script-list:${this.#root.name}`;
  }

  #recall(): Record<string, Kept> {
    try {
      const kept = JSON.parse(recall(this.#key) || '{}');
      return kept && typeof kept === 'object' ? kept : {};
    } catch {
      return {};
    }
  }

  #keep() {
    clearTimeout(this.#saving);
    this.#saving = undefined;
    const here = new Set(Object.keys(this.entries));
    for (const name of Object.keys(this.#kept)) if (!here.has(name)) delete this.#kept[name];
    keep(this.#key, JSON.stringify(this.#kept));
  }
}
