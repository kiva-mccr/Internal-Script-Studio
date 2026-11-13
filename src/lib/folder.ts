// Reading and writing inside the picked folder: the scripts in it, one script's script.md, and its assets.
// See docs/script-format.md for the layout.

import { addVersion, lastEditor } from './history';
import { frontValue, newId, parseScript } from './script';

export type ScriptInfo = { path: string[]; title: string; status: string; edited: number; who: string };

const SCRIPT = 'script.md';
// Characters Windows and OneDrive refuse in a file or folder name.
const BAD_NAME = /[\\/:*?"<>|]/g;

// Every folder in the picked folder that holds a script.md, newest edit first.
export async function listScripts(root: FileSystemDirectoryHandle): Promise<ScriptInfo[]> {
  const found: ScriptInfo[] = [];
  for await (const entry of root.values()) {
    if (entry.kind !== 'directory' || entry.name.startsWith('.')) continue;
    const file = await fileIn(entry as FileSystemDirectoryHandle, SCRIPT);
    if (!file) continue;
    const front = parseScript(await file.text()).front;
    found.push({
      path: [entry.name],
      title: frontValue(front, 'title') || entry.name,
      status: frontValue(front, 'status') || 'draft',
      edited: file.lastModified,
      who: await lastEditor(entry as FileSystemDirectoryHandle),
    });
  }
  return found.sort((a, b) => b.edited - a.edited);
}

// The script folder a link names, or null if there is none.
export async function findScript(root: FileSystemDirectoryHandle, path: string[]): Promise<FileSystemDirectoryHandle | null> {
  let dir = root;
  try {
    for (const part of path) dir = await dir.getDirectoryHandle(part);
  } catch {
    return null;
  }
  return (await fileIn(dir, SCRIPT)) ? dir : null;
}

export async function readScript(dir: FileSystemDirectoryHandle): Promise<string> {
  return (await (await dir.getFileHandle(SCRIPT)).getFile()).text();
}

export async function writeScriptFile(dir: FileSystemDirectoryHandle, text: string): Promise<void> {
  const writable = await (await dir.getFileHandle(SCRIPT, { create: true })).createWritable();
  await writable.write(text);
  await writable.close();
}

// Makes a new script folder with one empty row. Returns the folder's name, or throws a plain-language Error.
export async function createScript(root: FileSystemDirectoryHandle, name: string, author: string): Promise<string> {
  const folderName = safeName(name);
  if (!folderName) throw new Error('Type a name for the script.');
  if (await exists(root, folderName)) throw new Error(`There is already a script called "${folderName}".`);
  const dir = await root.getDirectoryHandle(folderName, { create: true });
  const text = [
    '---',
    `title: ${name.trim()}`,
    'status: draft',
    `authors: [${author}]`,
    '---',
    '',
    `## 1 <!-- id: ${newId(new Set())} -->`,
    'Dialogue:',
    '',
    'On screen:',
    '',
    'Files:',
    '',
  ].join('\n');
  await writeScriptFile(dir, text);
  await addVersion(dir, { parents: [], who: author, kind: 'edit', text });
  return folderName;
}

// Copies a file the person picked into the script's assets/ folder. Returns its path for the Files column.
export async function addAsset(dir: FileSystemDirectoryHandle, file: File): Promise<string> {
  const assets = await dir.getDirectoryHandle('assets', { create: true });
  const dot = file.name.lastIndexOf('.');
  const stem = safeName(dot > 0 ? file.name.slice(0, dot) : file.name) || 'file';
  const ext = dot > 0 ? file.name.slice(dot) : '';
  let name = stem + ext;
  for (let n = 2; await exists(assets, name); n++) name = `${stem} ${n}${ext}`;
  const writable = await (await assets.getFileHandle(name, { create: true })).createWritable();
  await writable.write(file);
  await writable.close();
  return `assets/${name}`;
}

// Whether a Files line is a copy of a file named `name` made by addAsset: assets/ plus its safe name, or that name
// with " 2", " 3" … (RV-12: "Use in script" shows "In row" while such a line is in the row).
export function isCopyOf(line: string, name: string): boolean {
  const dot = name.lastIndexOf('.');
  const stem = safeName(dot > 0 ? name.slice(0, dot) : name) || 'file';
  const ext = dot > 0 ? name.slice(dot) : '';
  if (!line.startsWith('assets/') || !line.endsWith(ext)) return false;
  const rest = line.slice(7, line.length - ext.length);
  return rest === stem || (rest.startsWith(stem + ' ') && /^[1-9]\d*$/.test(rest.slice(stem.length + 1)));
}

// A file inside the script's folder, by its path in the Files column. Null if it is not there.
export async function assetFile(dir: FileSystemDirectoryHandle, path: string): Promise<File | null> {
  const parts = path.split('/').filter((p) => p && p !== '.' && p !== '..');
  try {
    let at = dir;
    for (const part of parts.slice(0, -1)) at = await at.getDirectoryHandle(part);
    return await (await at.getFileHandle(parts.at(-1)!)).getFile();
  } catch {
    return null;
  }
}

export function safeName(name: string): string {
  return name.replace(BAD_NAME, ' ').replace(/\s+/g, ' ').trim().replace(/^\.+/, '').slice(0, 120);
}

async function fileIn(dir: FileSystemDirectoryHandle, name: string): Promise<File | null> {
  try {
    return await (await dir.getFileHandle(name)).getFile();
  } catch {
    return null;
  }
}

async function exists(dir: FileSystemDirectoryHandle, name: string): Promise<boolean> {
  for await (const key of dir.keys()) if (key.toLowerCase() === name.toLowerCase()) return true;
  return false;
}
