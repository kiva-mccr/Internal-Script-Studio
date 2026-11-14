// The example to try (AP-33): a copy of the made-up script in docs/example/, kept in the browser's private storage
// as a folder of its own, so every part of the app works on it and nothing reaches the shared folder.

import { addNote } from './comments';
import { writeEditing } from './editing';
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

// Sam's changes after Ana sent the script back (AP-47): a slower zoom in row 3, and the storyboard timeline's lines
// (a cut on a word, a hold, a picture only for the timeline, a placeholder). docs/example keeps the text as first
// sent for review, which many tests read; the example opens on this one. Dialogue is unchanged, so no take is Outdated.
export function samsVersion(text: string): string {
  const edits: [string, string][] = [
    ['- assets/leaf-push-in.mp4\n', '- assets/leaf-push-in.mp4\n\nTimeline: cuts at "running"\n'],
    ['- assets/music-bed.mp3\n', '- assets/music-bed.mp3\n\nTimeline: then hold 2 s\n'],
    ['Animated zoom: leaf to cell to chloroplast.', 'Slow animated zoom: leaf to cell to chloroplast, a few seconds on each.'],
    ['- assets/cell-micrograph.tif\n', '- assets/cell-micrograph.tif\n- assets/zoom-sketch.svg (timeline)\n'],
    ['- assets/glucose-notes.docx\n', '- assets/glucose-notes.docx\n\nTimeline: then placeholder 3 s "Time-lapse of a seedling growing"\n'],
  ];
  for (const [from, to] of edits) {
    if (!text.includes(from)) throw new Error(`The example's script no longer has "${from.trim()}"`);
    text = text.replace(from, to);
  }
  return text;
}

// The script, its files and takes, a History with a send back and a second send (so Review has a count and What's
// changed), comments of each kind (one on hold), and Ana's last visit, so every tab and the top bar have something
// to show. Made relative to `now` where it ages: the top bar names someone who was here only up to 7 days back.
async function fill(folder: FileSystemDirectoryHandle, now = new Date()): Promise<FileSystemDirectoryHandle> {
  const dir = await folder.getDirectoryHandle(SCRIPT, { create: true });
  const sent = Object.entries(files).find(([path]) => path.includes(`/${SCRIPT}/`))![1] as string;
  for (const [path, url] of Object.entries(assets)) {
    const [sub, name] = path.split('/').slice(-2);
    const blob = await (await fetch(url as string)).blob();
    await write(await dir.getDirectoryHandle(sub, { create: true }), name, blob);
  }
  const draft = (text: string) => text.replace('status: in review', 'status: draft');
  const text = samsVersion(sent);
  const at = (when: string) => new Date(when);
  const first = await addVersion(dir, { parents: [], who: 'Kiva', kind: 'edit', text: draft(sent) }, at('2026-11-09T14:20:00Z'));
  const send = await addVersion(dir, { parents: [first.id], who: 'Kiva', kind: 'review', text: sent, note: 'Sent for review',
    message: 'Is the zoom in row 3 too fast?' }, at('2026-11-09T14:41:00Z'));
  await addNote(dir, { kind: 'comment', who: 'Ana', row: 'k3f9a', field: 'on_screen', quote: 'Slow push-in on a sunlit leaf.',
    text: 'Could we shoot a real leaf for this instead of stock footage?' }, at('2026-11-09T15:02:00Z'));
  await addNote(dir, { kind: 'suggestion', who: 'Ana', row: 'p8x2m', field: 'dialogue', quote: 'simple', replace: 'everyday',
    text: '' }, at('2026-11-09T15:04:00Z'));
  await addNote(dir, { kind: 'comment', who: 'Ana', row: 't1q7c', field: 'dialogue', quote: 'chloroplasts',
    text: 'Could the narrator slow down here? It\'s a new word for most students.' }, at('2026-11-09T15:07:00Z'));
  const back = await addVersion(dir, { parents: [send.id], who: 'Ana', kind: 'review', text: draft(sent), note: 'Sent back to writer',
    message: 'Yes, the zoom is too fast. The filmmakers also asked for a rough storyboard.' }, at('2026-11-10T09:30:00Z'));
  const edit = await addVersion(dir, { parents: [back.id], who: 'Sam', kind: 'edit', text: draft(text) }, at('2026-11-10T15:12:00Z'));
  await addVersion(dir, { parents: [edit.id], who: 'Sam', kind: 'review', text, note: 'Sent for review',
    message: 'Zoom slowed down, and there\'s a timeline under the script for the filmmakers.' }, at('2026-11-11T09:10:00Z'));
  const quiz = await addNote(dir, { kind: 'comment', who: 'Leo', row: 'z4r5e', field: 'dialogue', quote: '',
    text: 'Could we end on a quiz question?' }, at('2026-11-11T10:02:00Z'));
  await addNote(dir, { kind: 'reply', who: 'Sam', about: quiz.id, text: 'Good idea. Saving it for episode 4.' }, at('2026-11-11T10:15:00Z'));
  await addNote(dir, { kind: 'hold', who: 'Sam', about: quiz.id }, at('2026-11-11T10:16:00Z'));
  const left = new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString();
  const came = new Date(now.getTime() - 3.5 * 60 * 60 * 1000).toISOString();
  await writeEditing(dir, { v: 1, who: 'Ana', since: came, seen: left, last_written: '', left });
  await write(dir, 'script.md', text);
  return folder;
}

// The open script may be writing a file in the example just then (its 30 s "here" or a History entry): removing a
// folder with a file being written fails (NoModificationAllowedError, or InvalidModificationError when a file is
// added to it while it is being removed), so it is tried again a moment later.
async function removeWhenFree(root: FileSystemDirectoryHandle, name: string) {
  for (let tries = 0; ; tries++) {
    try {
      return await root.removeEntry(name, { recursive: true });
    } catch (error) {
      const busy = error instanceof DOMException && ['NoModificationAllowedError', 'InvalidModificationError'].includes(error.name);
      if (tries >= 40 || !busy) throw error;
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
