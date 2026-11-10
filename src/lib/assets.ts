// The asset list (EX-6, mock-up 12): every file, link and "still to find" note across a script's rows, once each,
// with the rows that use it; and which files are missing from the script's folder.
import { assetFile } from './folder';
import { readFileRef, type FileRef, type Script } from './script';

export type Asset = FileRef & { line: string; rows: number[] };
export type Row = { n: number; section: string; assets: Asset[] };

// The rows in order, each with its section's name and its assets. An asset used in two rows is the same object.
export function assetRows(script: Script): Row[] {
  const seen = new Map<string, Asset>();
  const rows: Row[] = [];
  let section = '';
  let n = 0;
  for (const block of script.blocks) {
    if (block.type === 'section') {
      section = block.title;
      continue;
    }
    const row: Row = { n: ++n, section, assets: [] };
    for (const line of block.files) {
      const ref = readFileRef(line.trim());
      const key = `${ref.kind}:${ref.kind === 'words' ? ref.label.toLowerCase() : ref.target}`;
      let asset = seen.get(key);
      if (!asset) seen.set(key, (asset = { ...ref, line, rows: [] }));
      if (!asset.rows.includes(n)) asset.rows.push(n);
      if (!row.assets.includes(asset)) row.assets.push(asset);
    }
    rows.push(row);
  }
  return rows;
}

// Every asset once, in the order they first appear.
export function assetList(script: Script): Asset[] {
  return [...new Set(assetRows(script).flatMap((row) => row.assets))];
}

// The paths in the Files column that aren't in the script's folder.
export async function missingFiles(dir: FileSystemDirectoryHandle, assets: Asset[]): Promise<Set<string>> {
  const missing = new Set<string>();
  for (const asset of assets) {
    if (asset.kind === 'path' && !(await assetFile(dir, asset.target))) missing.add(asset.target);
  }
  return missing;
}

// How many of a script's files are missing, for the script list. 0 when the script can't be read.
export async function countMissing(dir: FileSystemDirectoryHandle, script: Script): Promise<number> {
  return (await missingFiles(dir, assetList(script))).size;
}
