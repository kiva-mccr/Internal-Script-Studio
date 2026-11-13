// Writing in the shared folder so that two computers never clash (FX-2): a file is written once, under a new name,
// and never replaced. A Windows network share refuses to replace a file another computer has open, and OneDrive can
// hold one while it syncs; a new name has no one reading it yet.

// Tried again quietly (0.3, 0.7, 1.5, 3 s) before it counts as failed. A lost OK to edit the folder isn't: only a
// click helps there.
const WAITS = [300, 700, 1500, 3000];
export async function patiently<T>(work: () => Promise<T>, waits = WAITS): Promise<T> {
  for (const wait of waits) {
    try {
      return await work();
    } catch (e) {
      if (e instanceof DOMException && (e.name === 'NotAllowedError' || e.name === 'SecurityError')) throw e;
      await new Promise((done) => setTimeout(done, wait));
    }
  }
  return work();
}

// Writes a file: a new one, apart from script.md, which only the keeper writes. A write that fails is aborted, or
// its unfinished .crswap file stays behind.
export async function writeText(folder: FileSystemDirectoryHandle, name: string, text: string): Promise<void> {
  await patiently(async () => {
    const writable = await (await folder.getFileHandle(name, { create: true })).createWritable();
    try {
      await writable.write(text);
      await writable.close();
    } catch (e) {
      await writable.abort().catch(() => {});
      throw e;
    }
  });
}

// The JSON in a file, or null while it is still being written or synced (empty, cut short, or gone).
export async function readJson<T>(folder: FileSystemDirectoryHandle, name: string): Promise<T | null> {
  try {
    return JSON.parse(await (await (await folder.getFileHandle(name)).getFile()).text()) as T;
  } catch {
    return null;
  }
}

// The names of the finished .json files in a folder, sorted (oldest first, for names that start with the time).
export async function jsonNames(folder: FileSystemDirectoryHandle): Promise<string[]> {
  const names: string[] = [];
  for await (const name of folder.keys()) if (name.endsWith('.json')) names.push(name);
  return names.sort();
}

// A time that sorts as text, to the millisecond: 20261113T204500123Z.
export const stamp = (at = new Date()) => at.toISOString().replace(/[-:.]/g, '');
