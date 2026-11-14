// Previews of files in Images & files, on comments and in Assets (AP-19, mock-up 41): what kind of preview a file
// gets from its name, and the work to make one. PDF and TIFF readers are only fetched when such a file is shown.

export type PreviewKind = 'image' | 'tif' | 'video' | 'audio' | 'pdf' | 'text' | 'word';

export type Preview =
  | { kind: 'image' | 'tif'; url: string }
  | { kind: 'video'; url: string; still: string; duration: number }
  | { kind: 'audio'; url: string }
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
  await turn();
  try {
    return await make(file, name);
  } finally {
    busy--;
    queue.shift()?.();
  }
}

// AP-39: two previews are made at a time. Scrolling fast brings dozens of rows near at once, and making all their
// previews together held up the page for a second or more.
const AT_ONCE = 2;
let busy = 0;
const queue: (() => void)[] = [];
function turn(): Promise<void> {
  if (busy < AT_ONCE) {
    busy++;
    return Promise.resolve();
  }
  return new Promise((resolve) => queue.push(() => (busy++, resolve())));
}

async function make(file: File, name: string): Promise<Preview | null> {
  const kind = previewKind(name);
  try {
    if (kind === 'image') return { kind, url: await smallPicture(file, name) };
    if (kind === 'video') return { kind, ...(await videoStill(file)) };
    if (kind === 'audio') return { kind, url: URL.createObjectURL(file) };
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
  if (preview?.kind === 'video') URL.revokeObjectURL(preview.still);
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
  return fits(page.width, page.height) ? canvasUrl(canvas) : shrink(canvas, page.width, page.height);
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

function canvasUrl(canvas: HTMLCanvasElement, type = 'image/png'): Promise<string> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(URL.createObjectURL(blob)) : reject(new Error('no picture'))), type, 0.85));
}

// AP-39: previews are shown at most 120 px tall, so they are made at most twice that (sharp on a hi-dpi screen) and
// 640 px wide. A camera photo shown as itself made Chrome unpack all 12 megapixels each time it came on screen:
// scrolling fell to a few frames a second and showed blank patches.
const TALL = 240;
const WIDE = 640;
const fits = (w: number, h: number) => h <= TALL && w <= WIDE;

// A small copy of a picture, or the file itself when it is small already. SVG and GIF (it may move) stay as they are.
async function smallPicture(file: File, name: string): Promise<string> {
  if (/\.(svg|gif)$/i.test(name)) return URL.createObjectURL(file);
  const bitmap = await createImageBitmap(file);
  try {
    return fits(bitmap.width, bitmap.height) ? URL.createObjectURL(file) : await shrink(bitmap, bitmap.width, bitmap.height);
  } finally {
    bitmap.close();
  }
}

async function shrink(source: ImageBitmap | HTMLCanvasElement | HTMLVideoElement, w: number, h: number): Promise<string> {
  const scale = Math.min(1, TALL / h, WIDE / w);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const small = await createImageBitmap(source, { resizeWidth: canvas.width, resizeHeight: canvas.height, resizeQuality: 'high' });
  canvas.getContext('2d')!.drawImage(small, 0, 0);
  small.close();
  return canvasUrl(canvas, 'image/webp');
}

// A video's preview is a still from its start and its length; the player is only made when ▶ is pressed (AP-39: a
// <video> per row kept a decoder each, and 150 of them took 14 s to show). One the browser can't play gives no
// preview (an error), so its chip says its kind and size.
async function videoStill(file: File): Promise<{ url: string; still: string; duration: number }> {
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  try {
    video.muted = true;
    video.preload = 'auto';
    const ready = (event: string) =>
      new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('too slow')), 15000);
        video.addEventListener(event, () => (clearTimeout(timer), resolve()), { once: true });
        video.addEventListener('error', () => (clearTimeout(timer), reject(new Error('no video'))), { once: true });
      });
    const loaded = ready('loadeddata');
    video.src = url;
    await loaded;
    const seeked = ready('seeked');
    video.currentTime = 0.1;
    await seeked;
    if (!video.videoWidth) throw new Error('no picture');
    const still = await shrink(video, video.videoWidth, video.videoHeight);
    return { url, still, duration: Number.isFinite(video.duration) ? video.duration : NaN };
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  } finally {
    video.removeAttribute('src');
    video.load();
  }
}

// "0:42", "1:05", "1:02:03".
export function clock(seconds: number): string {
  if (!Number.isFinite(seconds)) return '';
  const s = Math.round(seconds);
  const mm = Math.floor(s / 60) % 60;
  const ss = String(s % 60).padStart(2, '0');
  return s >= 3600 ? `${Math.floor(s / 3600)}:${String(mm).padStart(2, '0')}:${ss}` : `${Math.floor(s / 60)}:${ss}`;
}
