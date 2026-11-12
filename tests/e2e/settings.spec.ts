import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { setUp } from './folder';

const example = readFileSync('docs/example/Episode 03 - How Photosynthesis Works/script.md', 'utf8');

// The microphones and the recording are faked. `mics` is what the browser lists ([] before it may use the mic); a
// recording notes which mic it was handed in window.usedMic, and says the default stood in when `unplugged`.
async function open(page: Page, mics: { id: string; name: string }[], unplugged = false) {
  await page.addInitScript(([mics, unplugged]) => {
    const w = window as unknown as Record<string, unknown>;
    w.studioMics = async () => mics;
    w.studioRecord = async (mic: string) => {
      w.usedMic = mic;
      return { fellBack: unplugged && !!mic, stop: async () => new Blob(['RIFF'], { type: 'audio/wav' }) };
    };
  }, [mics, unplugged] as const);
  await setUp(page, '#/Episode%2003', { 'Episode 03/script.md': example });
  await expect(page.getByLabel('Dialogue, row 1')).toBeVisible();
}

async function openSettings(page: Page) {
  await page.getByRole('button', { name: 'More' }).click();
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible();
}

const mics = [{ id: 'yeti', name: 'Blue Yeti' }, { id: 'mbp', name: 'MacBook Pro Microphone' }];

test('Settings picks the microphone, takes record with it, and the browser remembers it', async ({ page }) => {
  await open(page, mics);
  await openSettings(page);
  const select = page.getByLabel('Microphone');
  await expect(select.locator('option')).toHaveText(['Default', 'Blue Yeti', 'MacBook Pro Microphone']);
  await expect(select).toHaveValue('');
  await select.selectOption({ label: 'Blue Yeti' });
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.getByRole('button', { name: 'Record row 1', exact: true }).click();
  expect(await page.evaluate(() => (window as unknown as { usedMic: string }).usedMic)).toBe('yeti');
  await page.getByRole('button', { name: 'Stop recording row 1' }).click();

  await page.reload();
  await openSettings(page);
  await expect(page.getByLabel('Microphone')).toHaveValue('yeti');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('before Chrome may use the mic, only Default is listed, with why', async ({ page }) => {
  await open(page, []);
  await openSettings(page);
  await expect(page.getByLabel('Microphone').locator('option')).toHaveText(['Default']);
  await expect(page.getByRole('dialog')).toContainText('The names of your microphones show once Chrome may use the mic');
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('an unplugged mic still records, with the default, and says so in the page', async ({ page }) => {
  await open(page, mics, true);
  await openSettings(page);
  await page.getByLabel('Microphone').selectOption({ label: 'Blue Yeti' });
  await page.getByRole('button', { name: 'Done' }).click();
  await page.getByRole('button', { name: 'Record row 1', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText("Blue Yeti isn't plugged in, so this take is recorded with the default microphone.");
  await page.getByRole('button', { name: 'Stop recording row 1' }).click();
  await expect(page.getByRole('button', { name: 'Record row 1 again' })).toBeVisible();
});
