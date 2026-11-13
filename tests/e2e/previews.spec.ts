import { expect, test, type Page } from '@playwright/test';
import { setUp } from './folder';
import { docx } from '../zip';

// AP-19 (mock-up 41): files in Images & files get a preview of their kind. All the files are made here: a 2×2 TIFF,
// a two-page PDF, a one-second WAV, a Word file, a webm recorded from a canvas in the browser, and files that get none.

const b64 = (bytes: Buffer | Uint8Array) => 'base64:' + Buffer.from(bytes).toString('base64');

function tiff(): Buffer {
  // Little-endian, one strip of 2×2 RGB pixels, no packing.
  const entries: [number, number, number, number][] = [
    [256, 3, 1, 2], [257, 3, 1, 2], [258, 3, 1, 8], [259, 3, 1, 1], [262, 3, 1, 2],
    [273, 4, 1, 8 + 2 + 10 * 12 + 4], [277, 3, 1, 3], [278, 3, 1, 2], [279, 4, 1, 12], [284, 3, 1, 1],
  ];
  const buf = Buffer.alloc(8 + 2 + entries.length * 12 + 4 + 12);
  buf.write('II', 0);
  buf.writeUInt16LE(42, 2);
  buf.writeUInt32LE(8, 4);
  buf.writeUInt16LE(entries.length, 8);
  entries.forEach(([tag, type, count, value], i) => {
    const at = 10 + i * 12;
    buf.writeUInt16LE(tag, at);
    buf.writeUInt16LE(type, at + 2);
    buf.writeUInt32LE(count, at + 4);
    if (type === 3) buf.writeUInt16LE(value, at + 8);
    else buf.writeUInt32LE(value, at + 8);
  });
  Buffer.from([0, 128, 0, 0, 128, 0, 0, 128, 0, 0, 128, 0]).copy(buf, 8 + 2 + entries.length * 12 + 4);
  return buf;
}

function pdf(): string {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 280] >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 280] >>',
  ];
  let out = '%PDF-1.4\n';
  const offsets = objects.map((body, i) => {
    const at = out.length;
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
    return at;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  out += offsets.map((at) => `${String(at).padStart(10, '0')} 00000 n \n`).join('');
  return out + `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
}

function wav(seconds: number): Buffer {
  const n = 8000 * seconds;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(8000, 24); buf.writeUInt32LE(16000, 28);
  buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  return buf;
}

// A real webm, recorded from a canvas in the test's browser.
async function webm(page: Page): Promise<string> {
  await page.goto('about:blank');
  return page.evaluate(async () => {
    const canvas = Object.assign(document.createElement('canvas'), { width: 64, height: 36 });
    const ctx = canvas.getContext('2d')!;
    const recorder = new MediaRecorder(canvas.captureStream(25), { mimeType: 'video/webm' });
    const parts: Blob[] = [];
    recorder.ondataavailable = (e) => parts.push(e.data);
    const timer = setInterval(() => ((ctx.fillStyle = `hsl(${Date.now() % 360} 60% 50%)`), ctx.fillRect(0, 0, 64, 36)), 40);
    recorder.start();
    await new Promise((resolve) => setTimeout(resolve, 600));
    recorder.stop();
    await new Promise((resolve) => (recorder.onstop = resolve));
    clearInterval(timer);
    const bytes = new Uint8Array(await new Blob(parts).arrayBuffer());
    return 'base64:' + btoa(String.fromCharCode(...bytes));
  });
}

const row = (n: number, files: string[]) =>
  `## ${n}\nDialogue:\nLine ${n}.\n\nOn screen:\nShot ${n}.\n\nFiles:\n${files.map((f) => `- assets/${f}`).join('\n')}\n`;

const SCRIPT = `---\ntitle: Previews\nstatus: draft\n---\n\n# Files\n\n${[
  row(1, ['scan.tif']),
  row(2, ['clip.webm', 'broken.mp4']),
  row(3, ['birdsong.wav']),
  row(4, ['storyboard.pdf']),
  row(5, ['expert-notes.docx', 'label-text.txt']),
  row(6, ['end-card.pptx']),
].join('\n')}`;

async function openPreviews(page: Page) {
  const video = await webm(page);
  await setUp(page, '#/Previews', {
    'Previews/script.md': SCRIPT,
    'Previews/assets/scan.tif': b64(tiff()),
    'Previews/assets/clip.webm': video,
    'Previews/assets/broken.mp4': 'not a video',
    'Previews/assets/birdsong.wav': b64(wav(1)),
    'Previews/assets/storyboard.pdf': pdf(),
    'Previews/assets/expert-notes.docx': b64(docx(['Notes from Dr. Patel', 'Say "carbon dioxide" first.', 'Arrows both ways.', 'More later.'])),
    'Previews/assets/label-text.txt': 'IN: carbon dioxide + water\r\nOUT: glucose + oxygen\r\n',
    'Previews/assets/end-card.pptx': 'pptx',
  });
  await expect(page.getByLabel('Dialogue, row 1')).toBeVisible();
}

test('each kind of file gets its preview in Images & files', async ({ page }) => {
  await openPreviews(page);

  // A TIFF, which Chrome can't draw itself, is drawn as a picture.
  const tif = page.getByRole('button', { name: 'Open scan.tif' }).locator('img');
  await expect.poll(() => tif.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(2);

  // A PDF: a picture of page 1 and the page count.
  const pdfButton = page.getByRole('button', { name: 'Open storyboard.pdf' });
  await expect(pdfButton).toContainText('Page 1 of 2', { timeout: 15000 });
  expect(await pdfButton.locator('img').evaluate((img: HTMLImageElement) => img.naturalHeight)).toBe(240);

  // Word and text: the first three lines, and … when there are more.
  await expect(page.getByRole('button', { name: 'Open expert-notes.docx' }).locator('.line'))
    .toHaveText(['Notes from Dr. Patel', 'Say "carbon dioxide" first.', 'Arrows both ways.', '…']);
  await expect(page.getByRole('button', { name: 'Open label-text.txt' }).locator('.line'))
    .toHaveText(['IN: carbon dioxide + water', 'OUT: glucose + oxygen']);

  // No preview: the chip says the kind and the size; so does a video the browser can't play.
  await expect(page.getByRole('button', { name: 'end-card.pptx · PowerPoint, 1 KB' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'broken.mp4 · MP4, 1 KB' })).toBeVisible();

  // A video plays right in the cell: ▶ starts it and brings the player's own controls.
  const video = page.locator('video[aria-label="clip.webm"]');
  await expect(video).not.toHaveAttribute('controls');
  await page.getByRole('button', { name: 'Play clip.webm here' }).click();
  await expect(video).toHaveAttribute('controls');
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime)).toBeGreaterThan(0);

  // Sound: a slim player with its length, that plays, pauses, and comes back to Play at the end.
  const sound = page.locator('.sound');
  await expect(sound).toContainText('0:01');
  await page.getByRole('button', { name: 'Play birdsong.wav' }).click();
  await expect(page.getByRole('button', { name: 'Pause birdsong.wav' })).toBeVisible();
  await expect(sound).toContainText('/ 0:01');
  await expect(page.getByRole('button', { name: 'Play birdsong.wav' })).toBeVisible({ timeout: 5000 });
});

test('the Assets tab shows thumbnails of TIFFs, PDFs and videos too', async ({ page }) => {
  await openPreviews(page);
  await page.getByRole('button', { name: /^Assets/ }).click();
  const list = page.getByRole('region', { name: 'Assets' });
  await expect(list.locator('.thumb img')).toHaveCount(2, { timeout: 15000 }); // scan.tif and storyboard.pdf
  await expect(list.locator('.thumb video:visible')).toHaveCount(1); // clip.webm; broken.mp4 can't be played
});
