// Previews of files in Images & files, on comments and in Assets (AP-19, mock-up 41): what kind of preview a file
// gets from its name, and the work to make one. PDF and TIFF readers are only fetched when such a file is shown.

export type PreviewKind = 'image' | 'tif' | 'video' | 'audio' | 'pdf' | 'text' | 'word';

export type Preview =
  | { kind: 'image' | 'tif'; url: string }
  | { kind: 'video' | 'audio'; url: string }
  | { kind: 'pdf'; url: string; pages: number }
  | { kind: 'text' | 'word'; label: string; lines: string[]; more: boolean };

const KINDS: [RegExp, PreviewKind][] = [
  [/\.(png|jpe?g|gif|webp|svg|avif|bmp)$/i, 'image'],
  [/\.tiff?$/i, 'tif'],
  [/\.(mp4|webm|mov|m4v|ogv)$/i, 'video'],
  [/\.(mp3|wav|m4a|ogg|oga|opus|aac|flac)$/i, 'audio'],
  [/\.pdf$/i, 'pdf'],
  [/\.(txt|md|markdown|csv)$/i, 'text'],
  [/\.docx$/i, 'word'],
];

export function previewKind(name: string): PreviewKind | null {
  return KINDS.find(([test]) => test.test(name))?.[1] ?? null;
}

// The kind named on a chip with no preview (mock-up 41, row 6): "PowerPoint", "Excel", "Zip", else the extension.
const NAMES: Record<string, string> = {
  ppt: 'PowerPoint', pptx: 'PowerPoint', key: 'Keynote', xls: 'Excel', xlsx: 'Excel', doc: 'Word', zip: 'Zip',
  psd: 'Photoshop', ai: 'Illustrator', heic: 'HEIC photo', txt: 'Text', md: 'Markdown', csv: 'CSV', docx: 'Word',
};
export function kindName(name: string): string {
  const ext = /\.([a-z0-9]+)$/i.exec(name)?.[1].toLowerCase() ?? '';
  return NAMES[ext] ?? (ext ? ext.toUpperCase() : 'File');
}

// How many lines of a text or Word file are shown.
export const LINES = 3;

// Makes a file's preview, or null when it has none or it can't be read. Anything with a url is a blob URL the caller
// revokes when done (revokePreview).
export async function makePreview(file: File, name = file.name): Promise<Preview | null> {
  const kind = previewKind(name);
  try {
    if (kind === 'image' || kind === 'video' || kind === 'audio') return { kind, url: URL.createObjectURL(file) };
    if (kind === 'text') return { kind, label: kindName(name), ...takeLines(await readStart(file)) };
    if (kind === 'word') return { kind, label: 'Word', ...takeLines(await wordText(new Uint8Array(await file.arrayBuffer()))) };
    if (kind === 'tif') return { kind, url: await tifPicture(file) };
    if (kind === 'pdf') return { kind, ...(await pdfFirstPage(file)) };
  } catch {
    // Not really that kind of file, or damaged: no preview, only its chip.
  }
  return null;
}

export function revokePreview(preview: Preview | null | undefined) {
  if (preview && 'url' in preview) URL.revokeObjectURL(preview.url);
}

// The first lines with something on them, and whether there are more.
export function takeLines(text: string): { lines: string[]; more: boolean } {
  const all = text.replace(/^﻿/, '').split(/\r?\n/).map((line) => line.trimEnd()).filter((line) => line.trim());
  return { lines: all.slice(0, LINES), more: all.length > LINES };
}

// Only the start of a text file is read: a big one is not loaded whole for three lines.
async function readStart(file: File): Promise<string> {
  return new TextDecoder().decode(await file.slice(0, 16384).arrayBuffer());
}

// A .docx is a zip: its text is in word/document.xml, one <w:p> per paragraph, the words in <w:t>.
export async function wordText(zip: Uint8Array): Promise<string> {
  const xml = new TextDecoder().decode(await unzipEntry(zip, 'word/document.xml'));
  return xml
    .split(/<\/w:p>/)
    .map((para) =>
      [...para.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>|<w:tab\/>/g)].map((m) => (m[1] === undefined ? ' ' : m[1])).join(''))
    .map((line) => line.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&'))
    .join('\n');
}

// Reads one file out of a zip with the browser's own inflate (no library): the central directory at the end names
// each file, its size, how it is packed and where its data starts.
export async function unzipEntry(zip: Uint8Array, wanted: string): Promise<Uint8Array> {
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  let end = zip.length - 22;
  while (end >= 0 && view.getUint32(end, true) !== 0x06054b50) end--;
  if (end < 0) throw new Error('not a zip');
  const count = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  for (let i = 0; i < count; i++) {
    if (view.getUint32(at, true) !== 0x02014b50) break;
    const method = view.getUint16(at + 10, true);
    const size = view.getUint32(at + 20, true);
    const nameLength = view.getUint16(at + 28, true);
    const skip = nameLength + view.getUint16(at + 30, true) + view.getUint16(at + 32, true);
    const local = view.getUint32(at + 42, true);
    const name = new TextDecoder().decode(zip.subarray(at + 46, at + 46 + nameLength));
    if (name === wanted) {
      const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
      const data = zip.slice(start, start + size);
      if (method === 0) return data;
      if (method !== 8) throw new Error('unknown packing');
      const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      return new Uint8Array(await new Response(stream).arrayBuffer());
    }
    at += 46 + skip;
  }
  throw new Error(`${wanted} not in the zip`);
}

// Chrome can't draw TIFF itself: UTIF (small, fetched only now) reads the first page, a canvas makes it a PNG.
async function tifPicture(file: File): Promise<string> {
  const UTIF = (await import('utif')).default;
  const buffer = await file.arrayBuffer();
  const [page] = UTIF.decode(buffer);
  UTIF.decodeImage(buffer, page);
  const rgba = UTIF.toRGBA8(page);
  const canvas = document.createElement('canvas');
  canvas.width = page.width;
  canvas.height = page.height;
  canvas.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(rgba), page.width, page.height), 0, 0);
  return canvasUrl(canvas);
}

// pdf.js (fetched only when a PDF is shown) draws page 1, twice the 120 px it is shown at so it stays sharp.
async function pdfFirstPage(file: File): Promise<{ url: string; pages: number }> {
  const [pdfjs, worker] = await Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  try {
    const doc = await task.promise;
    const page = await doc.getPage(1);
    const viewport = page.getViewport({ scale: 240 / page.getViewport({ scale: 1 }).height });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await page.render({ canvas, viewport }).promise;
    return { url: await canvasUrl(canvas), pages: doc.numPages };
  } finally {
    void task.destroy();
  }
}

function canvasUrl(canvas: HTMLCanvasElement): Promise<string> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(URL.createObjectURL(blob)) : reject(new Error('no picture'))), 'image/png'));
}

// "0:42", "1:05", "1:02:03".
export function clock(seconds: number): string {
  if (!Number.isFinite(seconds)) return '';
  const s = Math.round(seconds);
  const mm = Math.floor(s / 60) % 60;
  const ss = String(s % 60).padStart(2, '0');
  return s >= 3600 ? `${Math.floor(s / 3600)}:${String(mm).padStart(2, '0')}:${ss}` : `${Math.floor(s / 60)}:${ss}`;
}
