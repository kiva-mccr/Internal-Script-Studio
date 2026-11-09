// "Sam is editing": one small file per person in .studio/editing/ (docs/studio-folder.md). The only files in
// .studio/ that are rewritten, and each is only ever written by its own person.

export type Editing = { v: 1; who: string; since: string; seen: string; last_written: string };

export const FRESH_FOR = 2 * 60 * 1000; // older than this, the person has gone (closed laptop)

export function fileName(who: string): string {
  return (who.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'someone') + '.json';
}

export async function writeEditing(dir: FileSystemDirectoryHandle, entry: Editing): Promise<void> {
  const folder = await editingFolder(dir, true);
  const writable = await (await folder!.getFileHandle(fileName(entry.who), { create: true })).createWritable();
  await writable.write(JSON.stringify(entry) + '\n');
  await writable.close();
}

export async function removeEditing(dir: FileSystemDirectoryHandle, who: string): Promise<void> {
  const folder = await editingFolder(dir, false);
  await folder?.removeEntry(fileName(who)).catch(() => {});
}

// Everyone's editing file, stale ones too (their last_written still counts when a script is opened).
export async function readEditing(dir: FileSystemDirectoryHandle): Promise<Editing[]> {
  const folder = await editingFolder(dir, false);
  if (!folder) return [];
  const found: Editing[] = [];
  for await (const [name, handle] of folder.entries()) {
    if (!name.endsWith('.json') || handle.kind !== 'file') continue;
    try {
      const entry = JSON.parse(await (await (handle as FileSystemFileHandle).getFile()).text());
      if (entry.v === 1 && entry.who) found.push(entry);
    } catch {
      // Half-synced: skipped.
    }
  }
  return found;
}

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
