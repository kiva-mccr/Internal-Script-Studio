// The shared asset browser (AS-1, mock-up 29): the files and links of every other script in the folder, to reuse.
// A file is copied into this script's assets/; a link is added as the same link.
import { assetList } from './assets';
import { addAsset, assetFile, listScripts, readScript } from './folder';
import { parseScript } from './script';

// line: a link's line as its script has it, so it is added the same.
export type SharedFile = { kind: 'path' | 'link'; name: string; target: string; line: string; uses: number };
export type SharedScript = { folder: string; title: string; status: string; files: SharedFile[] };

// Every script but `except` (its folder name) that has files, newest edited first: the files in its assets/ folder
// by name, then the links its rows use. A script that can't be read is left out.
export async function sharedFiles(root: FileSystemDirectoryHandle, except: string): Promise<SharedScript[]> {
  const found: SharedScript[] = [];
  for (const info of await listScripts(root)) {
    const folder = info.path[0];
    if (folder.toLowerCase() === except.toLowerCase()) continue;
    try {
      const dir = await root.getDirectoryHandle(folder);
      const used = assetList(parseScript(await readScript(dir)));
      const uses = (kind: string, target: string) => used.find((a) => a.kind === kind && a.target === target)?.rows.length ?? 0;
      const files: SharedFile[] = [];
      for (const name of await assetNames(dir)) {
        const target = `assets/${name}`;
        files.push({ kind: 'path', name, target, line: target, uses: uses('path', target) });
      }
      for (const a of used) if (a.kind === 'link') files.push({ kind: 'link', name: a.label, target: a.target, line: a.line.trim(), uses: a.rows.length });
      if (files.length) found.push({ folder, title: info.title, status: info.status, files });
    } catch {
      // still syncing or unreadable: skip it
    }
  }
  return found;
}

// Copies a file from another script's folder into this one's assets/. Returns its line for the Files column.
export async function copyShared(root: FileSystemDirectoryHandle, folder: string, file: SharedFile,
  dir: FileSystemDirectoryHandle): Promise<string> {
  if (file.kind === 'link') return file.line;
  const from = await assetFile(await root.getDirectoryHandle(folder), file.target);
  if (!from) throw new Error('gone');
  return addAsset(dir, from);
}

async function assetNames(dir: FileSystemDirectoryHandle): Promise<string[]> {
  let assets: FileSystemDirectoryHandle;
  try {
    assets = await dir.getDirectoryHandle('assets');
  } catch {
    return [];
  }
  const names: string[] = [];
  for await (const entry of assets.values()) if (entry.kind === 'file' && !entry.name.startsWith('.')) names.push(entry.name);
  return names.sort((a, b) => a.localeCompare(b));
}
