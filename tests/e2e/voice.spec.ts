import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { readFile, setUp, writeFile } from './folder';

const example = readFileSync('docs/example/Episode 03 - How Photosynthesis Works/script.md', 'utf8');

// The microphone is faked: a "recording" is half a second of silence as a real WAV, so it can be played back.
async function openExample(page: Page) {
  await page.addInitScript(() => {
    const wav = () => {
      const rate = 8000, n = rate / 2, buf = new DataView(new ArrayBuffer(44 + n * 2));
      const text = (at: number, s: string) => [...s].forEach((c, i) => buf.setUint8(at + i, c.charCodeAt(0)));
      text(0, 'RIFF'); buf.setUint32(4, 36 + n * 2, true); text(8, 'WAVEfmt '); buf.setUint32(16, 16, true);
      buf.setUint16(20, 1, true); buf.setUint16(22, 1, true); buf.setUint32(24, rate, true); buf.setUint32(28, rate * 2, true);
      buf.setUint16(32, 2, true); buf.setUint16(34, 16, true); text(36, 'data'); buf.setUint32(40, n * 2, true);
      return new Blob([buf], { type: 'audio/wav' });
    };
    (window as unknown as { studioRecord: () => Promise<{ stop: () => Promise<Blob> }> }).studioRecord = async () => ({
      stop: async () => wav(),
    });
  });
  await setUp(page, '#/Episode%2003', { 'Episode 03/script.md': example });
  await expect(page.getByLabel('Dialogue, row 1')).toBeVisible();
}

test('record a take for a row, see its length and words a minute, and play it back', async ({ page }) => {
  await openExample(page);
  await page.getByRole('button', { name: 'Record row 1', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Recording' })).toContainText('● Recording 0:0');
  await page.getByRole('button', { name: 'Stop recording row 1' }).click();
  await expect(page.getByRole('button', { name: 'Play row 1' })).toContainText(/▶ 0:0\d/);
  await expect(page.locator('.take .about')).toContainText(/\d+ wpm · Sam, \w{3} \d+/);
  await expect(page.getByRole('button', { name: 'Record row 1 again' })).toBeVisible();
  await expect(page.locator('header .voice')).toHaveText(/^1 of 5 · 0:0\d\/0:\d\d$/);
  const take = JSON.parse(await readFile(page, 'Episode 03/voice/row-k3f9a.json'));
  expect(take).toMatchObject({ by: 'Sam', text: expect.stringContaining('Every leaf') });
  expect((await readFile(page, 'Episode 03/voice/row-k3f9a.webm')).startsWith('RIFF')).toBe(true);
  await page.getByRole('button', { name: 'Play row 1' }).click();
  await expect(page.getByRole('button', { name: 'Pause row 1' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Play row 1' })).toBeVisible({ timeout: 5000 }); // played to the end
});

test('a take says Outdated once its line is changed, and keeps its words a minute', async ({ page }) => {
  await openExample(page);
  await page.getByRole('button', { name: 'Record row 1', exact: true }).click();
  await page.getByRole('button', { name: 'Stop recording row 1' }).click();
  await expect(page.locator('.take')).toBeVisible();
  await expect(page.locator('.old')).toHaveCount(0);
  const rate = await page.locator('.take .about').textContent();
  await page.getByLabel('Dialogue, row 1').click();
  await page.keyboard.press('End');
  await page.keyboard.type(' Really, really, truly it does.');
  await expect(page.locator('.old')).toHaveText('Outdated');
  await expect(page.locator('.take .about')).toHaveText(rate!); // the words a minute of what was recorded
});

test('deleting a take takes it out of the folder; someone else’s take appears', async ({ page }) => {
  await openExample(page);
  await page.getByRole('button', { name: 'Record row 1', exact: true }).click();
  await page.getByRole('button', { name: 'Stop recording row 1' }).click();
  await page.getByRole('button', { name: 'Delete the take of row 1' }).click();
  await expect(page.locator('.take')).toHaveCount(0);
  await expect(page.locator('header .voice')).toHaveText('0:25'); // only the read time, with no take
  await writeFile(page, 'Episode 03/voice/row-p8x2m.json', JSON.stringify({ by: 'Alex', at: Date.now(), seconds: 4, text: 'x' }));
  await expect(page.locator('header .voice')).toHaveText('1 of 5 · 0:04/0:25', { timeout: 10000 }); // 4 s for row 2's 10 words (4 s at 150)
  await expect(page.getByRole('button', { name: 'Record row 2 again' })).toBeVisible();
});

test('a blocked microphone says what to do, in the page', async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { studioRecord: () => Promise<never> }).studioRecord = async () => {
      throw new DOMException('denied', 'NotAllowedError');
    };
  });
  await setUp(page, '#/Episode%2003', { 'Episode 03/script.md': example });
  await page.getByRole('button', { name: 'Record row 1', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('The microphone is blocked or missing');
});

test('Export > Voice-over joins the takes in row order into one WAV, and says which rows have none', async ({ page }) => {
  await openExample(page);
  for (const row of [3, 1]) {
    await page.getByRole('button', { name: `Record row ${row}`, exact: true }).click();
    await page.getByRole('button', { name: `Stop recording row ${row}` }).click();
    await expect(page.getByRole('button', { name: `Record row ${row} again` })).toBeVisible();
  }
  await page.getByRole('button', { name: 'Export' }).click();
  const [file] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Voice-over (.wav)' }).click()]);
  expect(file.suggestedFilename()).toBe('How Photosynthesis Works voice-over.wav');
  const bytes = readFileSync(await file.path());
  expect(bytes.subarray(0, 4).toString()).toBe('RIFF');
  expect(bytes.readUInt32LE(24)).toBe(48000);
  expect(bytes.length).toBe(44 + 2 * 24000 * 2); // two takes of half a second, mono, 16 bits
  await expect(page.getByRole('alert')).toContainText('The file has 2 of 5 rows. 3 rows have no take yet.');
});

test('Export > Voice-over with no takes says so and downloads nothing', async ({ page }) => {
  await openExample(page);
  await page.getByRole('button', { name: 'Export' }).click();
  await page.getByRole('button', { name: 'Voice-over (.wav)' }).click();
  await expect(page.getByRole('alert')).toContainText('No voice-over has been recorded yet');
});
