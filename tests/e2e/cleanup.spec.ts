import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { readFile, setUp, writeFile } from './folder';

const example = readFileSync('docs/example/Episode 03 - How Photosynthesis Works/script.md', 'utf8');

// The microphone is faked (AU-4): a "recording" is a real WAV of 0.3 s silence, 0.4 s of tone, 0.3 s silence, so the
// crop has something to find. Whether the browser's noise reduction was asked for is noted in window.noise.
async function open(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>;
    const wav = () => {
      const rate = 8000, n = rate, buf = new DataView(new ArrayBuffer(44 + n * 2));
      const text = (at: number, s: string) => [...s].forEach((c, i) => buf.setUint8(at + i, c.charCodeAt(0)));
      text(0, 'RIFF'); buf.setUint32(4, 36 + n * 2, true); text(8, 'WAVEfmt '); buf.setUint32(16, 16, true);
      buf.setUint16(20, 1, true); buf.setUint16(22, 1, true); buf.setUint32(24, rate, true); buf.setUint32(28, rate * 2, true);
      buf.setUint16(32, 2, true); buf.setUint16(34, 16, true); text(36, 'data'); buf.setUint32(40, n * 2, true);
      for (let i = 0; i < n; i++) buf.setInt16(44 + i * 2, i > 0.3 * rate && i < 0.7 * rate ? Math.round(8000 * Math.sin(i / 3)) : 0, true);
      return new Blob([buf], { type: 'audio/wav' });
    };
    w.studioRecord = async (_mic: string, noise: boolean) => {
      w.noise = noise;
      w.stops = 0;
      return { stop: async () => ((w.stops = 1), wav()) };
    };
  });
  await setUp(page, '#/Episode%2003', { 'Episode 03/script.md': example });
  await expect(page.getByLabel('Dialogue, row 1')).toBeVisible();
}

async function settings(page: Page) {
  await page.getByRole('button', { name: 'More' }).click();
  await page.getByRole('button', { name: 'Settings' }).click();
  return page.getByRole('dialog', { name: 'Settings' });
}

test('the mic records at once, a ring fills for a second, then ■ is the cue; the take is cropped', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Record row 1', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Getting ready…' })).toBeVisible();
  await expect(page.locator('.mic.cue .ring')).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: '● Recording' })).toBeVisible({ timeout: 3000 });
  await expect(page.locator('.mic.cue')).toHaveCount(0);
  await expect(page.locator('.mic.on')).toHaveText('■');
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: 'Stop recording row 1' }).click();
  await expect(page.getByRole('button', { name: 'Play row 1' })).toBeVisible();
  const take = JSON.parse(await readFile(page, 'Episode 03/voice/row-k3f9a.json'));
  expect(take.from).toBeCloseTo(0.05, 1);
  expect(take.to).toBeCloseTo(0.95, 1);
  expect(take.gain).toBeGreaterThan(0);
  expect(take.seconds).toBeGreaterThan(1.2); // the whole recording, as timed
  await expect(page.getByRole('button', { name: 'Play row 1' })).toHaveText('▶ 0:01');
  await expect(page.getByRole('button', { name: 'Play row 1' })).toHaveAttribute('title', /^0:01 after cropping 0\.\d s of silence$/);
  expect(await page.evaluate(() => (window as unknown as { noise: boolean }).noise)).toBe(true);
  // It plays (the cropped part) to the end.
  await page.getByRole('button', { name: 'Play row 1' }).click();
  await expect(page.getByRole('button', { name: 'Pause row 1' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Play row 1' })).toBeVisible({ timeout: 5000 });
});

test('Esc while the ring fills throws the new take away and keeps the old one', async ({ page }) => {
  await open(page);
  await writeFile(page, 'Episode 03/voice/row-k3f9a.json', JSON.stringify({ by: 'Alex', at: Date.now(), seconds: 4, text: 'x' }));
  await expect(page.getByRole('button', { name: 'Record row 1 again' })).toBeVisible({ timeout: 10000 });
  await page.getByRole('button', { name: 'Record row 1 again' }).click();
  await expect(page.locator('.mic.cue')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('status').filter({ hasText: /Getting ready|Recording/ })).toHaveCount(0);
  await page.waitForTimeout(1200);
  await expect(page.getByRole('status').filter({ hasText: 'Recording' })).toHaveCount(0);
  expect(JSON.parse(await readFile(page, 'Episode 03/voice/row-k3f9a.json')).by).toBe('Alex');
  await expect(page.locator('.take .about')).toContainText('Alex');
});

test('Settings switches the clean-up: crop off plays the whole take, noise reduction off records without it', async ({ page }) => {
  await open(page);
  const dialog = await settings(page);
  const crop = dialog.getByLabel('Crop the silence at the start and end');
  const noise = dialog.getByLabel('Reduce background noise');
  const level = dialog.getByLabel('Make every take equally loud');
  await expect(crop).toBeChecked();
  await expect(noise).toBeChecked();
  await expect(level).toBeChecked();
  await noise.uncheck();
  await dialog.getByRole('button', { name: 'Done' }).click();
  await page.getByRole('button', { name: 'Record row 1', exact: true }).click();
  await expect(page.locator('.mic.on')).toBeVisible({ timeout: 3000 });
  await page.waitForTimeout(1100);
  await page.getByRole('button', { name: 'Stop recording row 1' }).click();
  expect(await page.evaluate(() => (window as unknown as { noise: boolean }).noise)).toBe(false);
  await expect(page.getByRole('button', { name: 'Play row 1' })).toHaveText('▶ 0:01');
  await (await settings(page)).getByLabel('Crop the silence at the start and end').uncheck();
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByRole('button', { name: 'Play row 1' })).toHaveText(/^▶ 0:0[23]$/); // the whole take, as timed
  await expect(page.getByRole('button', { name: 'Play row 1' })).not.toHaveAttribute('title', /.+/);
  // Kept in this browser.
  await page.reload();
  const again = await settings(page);
  await expect(again.getByLabel('Crop the silence at the start and end')).not.toBeChecked();
  await expect(again.getByLabel('Reduce background noise')).not.toBeChecked();
  await expect(again.getByLabel('Make every take equally loud')).toBeChecked();
});
