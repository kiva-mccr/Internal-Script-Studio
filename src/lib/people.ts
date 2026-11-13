// Credits and contacts (AP-31, board 50). The people who work on the scripts are kept once for the whole folder, in
// .studio/people/ at the top of the picked folder: one file per change, written once and never edited (OneDrive
// sync); the newest about a person counts. A script's credits are a `credits:` line in its front matter: who, and a
// short blurb on what they did on it. See docs/studio-folder.md and docs/script-format.md.

import { findScript, listScripts, readScript, type ScriptInfo } from './folder';
import { frontValue, parseScript, setFrontValue } from './script';

export type Person = { id: string; name: string; role: string; email: string; linkedin: string };
// One credit on a script. `name` is kept too, so the script reads on its own (exports, a text editor).
export type Credit = { id: string; name: string; role: string };
type Entry = Person & { v: 1; who: string; when: string; removed?: boolean };

// Everyone in the folder, by name. Files that can't be read (half-synced) are skipped.
export async function listPeople(root: FileSystemDirectoryHandle): Promise<Person[]> {
  const folder = await peopleFolder(root, false);
  if (!folder) return [];
  const names: string[] = [];
  for await (const name of folder.keys()) if (name.endsWith('.json')) names.push(name);
  const newest = new Map<string, Entry>();
  for (const name of names.sort()) {
    try {
      const entry = JSON.parse(await (await (await folder.getFileHandle(name)).getFile()).text()) as Entry;
      if (entry.v === 1 && entry.id && typeof entry.name === 'string') newest.set(entry.id, entry);
    } catch {
      // Skipped: OneDrive may still be bringing it in.
    }
  }
  return [...newest.values()]
    .filter((e) => !e.removed)
    .map(({ id, name, role, email, linkedin }) => ({ id, name, role: role ?? '', email: email ?? '', linkedin: linkedin ?? '' }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// Adds a person, or changes one (a new file; the newest counts). Returns the person as saved.
export async function savePerson(root: FileSystemDirectoryHandle, person: Omit<Person, 'id'> & { id?: string }, who: string,
  now = new Date(), removed = false): Promise<Person> {
  const saved: Person = { id: person.id || randomId(), name: person.name.trim(), role: person.role.trim(), email: person.email.trim(),
    linkedin: person.linkedin.trim() };
  const entry: Entry = { v: 1, ...saved, who, when: now.toISOString(), ...(removed ? { removed: true } : {}) };
  const folder = (await peopleFolder(root, true))!;
  const name = `${entry.when.replace(/\.\d+Z$/, 'Z').replace(/[-:]/g, '')}_${saved.id}_${randomId()}.json`;
  const writable = await (await folder.getFileHandle(name, { create: true })).createWritable();
  await writable.write(JSON.stringify(entry, null, 2) + '\n');
  await writable.close();
  return saved;
}

// Takes a person out of the folder's list (only offered once no script credits them).
export async function removePerson(root: FileSystemDirectoryHandle, person: Person, who: string, now = new Date()): Promise<void> {
  await savePerson(root, person, who, now, true);
}

// A script's credits, from its front matter. A line that can't be read gives none (and is kept as typed until changed).
export function readCredits(front: string | null): Credit[] {
  const value = frontValue(front, 'credits');
  if (!value) return [];
  try {
    const list = JSON.parse(value);
    if (!Array.isArray(list)) return [];
    return list
      .filter((c) => c && typeof c.id === 'string' && typeof c.name === 'string')
      .map((c) => ({ id: c.id, name: c.name, role: typeof c.role === 'string' ? c.role : '' }));
  } catch {
    return [];
  }
}

// The front matter with these credits: one line of JSON (which YAML reads too), or no line when there are none.
export function writeCredits(front: string | null, credits: Credit[]): string | null {
  if (credits.length) return setFrontValue(front, 'credits', JSON.stringify(credits.map(({ id, name, role }) => ({ id, name, role }))));
  if (front === null) return null;
  return front.split('\n').filter((line) => !line.startsWith('credits:')).join('\n');
}

// Two saves at once (lib/merge.ts): the side that changed wins; when both did, theirs with your changes on top
// (people you added or changed, and taking out the ones you took out). Never a clash to pick.
export function mergeCredits(base: Credit[], mine: Credit[], theirs: Credit[]): Credit[] {
  const same = (a: Credit[], b: Credit[]) => JSON.stringify(a) === JSON.stringify(b);
  if (same(mine, base)) return theirs;
  if (same(theirs, base)) return mine;
  const was = new Map(base.map((c) => [c.id, c]));
  const out = theirs.filter((c) => !was.has(c.id) || mine.some((m) => m.id === c.id));
  for (const m of mine) {
    const at = out.findIndex((c) => c.id === m.id);
    const changed = !was.has(m.id) || !same([was.get(m.id)!], [m]);
    if (at < 0) out.push(m);
    else if (changed) out[at] = m;
  }
  return out;
}

// The credits that show in exports: those with a name, in the script's order.
export function shownCredits(front: string | null): Credit[] {
  return readCredits(front).filter((c) => c.name.trim());
}

// How someone can be reached, on one line: "sam@example.org · linkedin.com/in/sam".
export function contactLine(person: Pick<Person, 'email' | 'linkedin'>): string {
  return [person.email, person.linkedin].filter(Boolean).join(' · ');
}

// A LinkedIn line as a link: "linkedin.com/in/sam" or a full address.
export function linkedinUrl(text: string): string {
  const t = text.trim();
  if (!t) return '';
  return /^https?:\/\//i.test(t) ? t : `https://${t.replace(/^\/+/, '')}`;
}

// The scripts that credit each person, by person id: "On 3 scripts", and the list in People. A script that can't be
// read (mid-sync) is skipped.
export async function creditedOn(root: FileSystemDirectoryHandle): Promise<Map<string, ScriptInfo[]>> {
  const on = new Map<string, ScriptInfo[]>();
  for (const info of await listScripts(root).catch(() => [])) {
    try {
      const dir = await findScript(root, info.path);
      if (!dir) continue;
      for (const credit of readCredits(parseScript(await readScript(dir)).front)) on.set(credit.id, [...(on.get(credit.id) ?? []), info]);
    } catch {
      // Counted next time.
    }
  }
  return on;
}

async function peopleFolder(root: FileSystemDirectoryHandle, create: boolean): Promise<FileSystemDirectoryHandle | null> {
  try {
    const studio = await root.getDirectoryHandle('.studio', { create });
    return await studio.getDirectoryHandle('people', { create });
  } catch {
    return null;
  }
}

function randomId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => chars[b % 36]).join('');
}
