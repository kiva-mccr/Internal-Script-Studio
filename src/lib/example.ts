// The example to try (AP-33): a copy of the made-up script in docs/example/, kept in the browser's private storage
// as a folder of its own, so every part of the app works on it and nothing reaches the shared folder.

import { addNote } from './comments';
import { addVersion } from './history';
import { keep, recall } from './remember';

const SCRIPT = 'Episode 03 - How Photosynthesis Works';
const NAME = 'Example'; // the folder's name, shown in the top bar ("Example / How Photosynthesis Works")
const BEFORE = 'Example before start over'; // the copy kept for Undo
const FOLDED = 'studio.example-folded';

const files = import.meta.glob('../../docs/example/*/script.md', { query: '?raw', import: 'default', eager: true });
// The drawings and other made-up files (one of each kind the app previews), and the voice-over takes (AU-1).
const assets = import.meta.glob(['../../docs/example/*/assets/*', '../../docs/example/*/voice/*'], { query: '?url', import: 'default', eager: true });

// Whether the offer on the first-time screen is folded to one line (remembered by this browser).
export function exampleFolded(): boolean {
  return recall(FOLDED) === 'yes';
}

export function foldExample(folded: boolean): void {
  keep(FOLDED, folded ? 'yes' : '');
}

// The example folder, made the first time; later visits get it back as they left it.
export async function openExample(): Promise<FileSystemDirectoryHandle> {
  const root = await navigator.storage.getDirectory();
  try {
    return await root.getDirectoryHandle(NAME);
  } catch {
    return fill(await root.getDirectoryHandle(NAME, { create: true }));
  }
}

// Puts the example back as new. The old copy is kept until the next start over, so `undo` can bring it back.
export async function startOver(): Promise<{ folder: FileSystemDirectoryHandle; undo: () => Promise<FileSystemDirectoryHandle> }> {
  const root = await navigator.storage.getDirectory();
  await root.removeEntry(BEFORE, { recursive: true }).catch(() => {});
  await copy(await root.getDirectoryHandle(NAME), await root.getDirectoryHandle(BEFORE, { create: true }));
  await removeWhenFree(root, NAME);
  const folder = await fill(await root.getDirectoryHandle(NAME, { create: true }));
  return {
    folder,
    async undo() {
      await removeWhenFree(root, NAME);
      const back = await root.getDirectoryHandle(NAME, { create: true });
      await copy(await root.getDirectoryHandle(BEFORE), back);
      return back;
    },
  };
}

// The script, its files and takes, two History entries and two comments, so every tab has something to show.
async function fill(folder: FileSystemDirectoryHandle): Promise<FileSystemDirectoryHandle> {
  const dir = await folder.getDirectoryHandle(SCRIPT, { create: true });
  const text = Object.entries(files).find(([path]) => path.includes(`/${SCRIPT}/`))![1] as string;
  for (const [path, url] of Object.entries(assets)) {
    const [sub, name] = path.split('/').slice(-2);
    const blob = await (await fetch(url as string)).blob();
    await write(await dir.getDirectoryHandle(sub, { create: true }), name, blob);
  }
  const draft = text.replace('status: in review', 'status: draft');
  const first = await addVersion(dir, { parents: [], who: 'Kiva', kind: 'edit', text: draft }, new Date('2026-11-09T14:20:00Z'));
  await addVersion(dir, { parents: [first.id], who: 'Kiva', kind: 'review', text, note: 'Sent for review',
    message: 'Is the zoom in row 3 too fast?' }, new Date('2026-11-09T14:41:00Z'));
  await addNote(dir, { kind: 'comment', who: 'Ana', row: 'k3f9a', field: 'on_screen', quote: 'Slow push-in on a sunlit leaf.',
    text: 'Could we shoot a real leaf for this instead of stock footage?' }, new Date('2026-11-09T15:02:00Z'));
  await addNote(dir, { kind: 'suggestion', who: 'Ana', row: 'p8x2m', field: 'dialogue', quote: 'simple', replace: 'everyday',
    text: '' }, new Date('2026-11-09T15:04:00Z'));
  await write(dir, 'script.md', text);
  return folder;
}

// The open script may be writing a file in the example just then (its 30 s "here" or a History entry): removing a
// folder with a file being written fails (NoModificationAllowedError), so it is tried again a moment later.
async function removeWhenFree(root: FileSystemDirectoryHandle, name: string) {
  for (let tries = 0; ; tries++) {
    try {
      return await root.removeEntry(name, { recursive: true });
    } catch (error) {
      if (tries >= 40 || !(error instanceof DOMException) || error.name !== 'NoModificationAllowedError') throw error;
      await new Promise((r) => setTimeout(r, 50));
    }
  }
}

async function write(dir: FileSystemDirectoryHandle, name: string, data: Blob | string) {
  const writable = await (await dir.getFileHandle(name, { create: true })).createWritable();
  await writable.write(data);
  await writable.close();
}

async function copy(from: FileSystemDirectoryHandle, to: FileSystemDirectoryHandle) {
  for await (const [name, handle] of from.entries()) {
    if (handle.kind === 'directory') await copy(handle as FileSystemDirectoryHandle, await to.getDirectoryHandle(name, { create: true }));
    else await write(to, name, await (handle as FileSystemFileHandle).getFile());
  }
}
