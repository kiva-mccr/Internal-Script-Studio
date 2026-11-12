import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { setUp } from './folder';

const example = readFileSync('docs/example/Episode 03 - How Photosynthesis Works/script.md', 'utf8');

// The microphones and the recording are faked. `mics` is the browser's device list ([] before it may use the mic); a
// recording notes which mic it was handed in window.usedMic, and says the default stood in when `unplugged`.
async function open(page: Page, mics: { deviceId: string; label: string; groupId: string; kind: string }[], unplugged = false) {
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

const dev = (deviceId: string, label: string, groupId: string) => ({ deviceId, label, groupId, kind: 'audioinput' });
// Chrome's list: the default (the MacBook's mic here) is also listed as "default".
const mics = [dev('default', 'Default - MacBook Pro Microphone', 'g2'), dev('yeti', 'Blue Yeti', 'g1'), dev('mbp', 'MacBook Pro Microphone', 'g2')];
const field = (page: Page) => page.getByRole('combobox', { name: 'Microphone' });

async function pickMic(page: Page, name: string) {
  await field(page).click();
  await page.getByRole('option', { name }).click();
}

test('Settings picks the microphone, takes record with it, and the browser remembers it', async ({ page }) => {
  await open(page, mics);
  await openSettings(page);
  // AU-5: no "Default" entry, the default mic is marked "(default)" on its row and picked until another is.
  await expect(field(page)).toHaveText('MacBook Pro Microphone (default)');
  await field(page).click();
  await expect(page.getByRole('option')).toHaveText(['Blue Yeti', '✓MacBook Pro Microphone (default)']);
  await expect(page.getByRole('option', { name: 'MacBook Pro Microphone (default)' })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('option', { name: 'Blue Yeti' }).click();
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await expect(field(page)).toHaveText('Blue Yeti');
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.getByRole('button', { name: 'Record row 1', exact: true }).click();
  expect(await page.evaluate(() => (window as unknown as { usedMic: string }).usedMic)).toBe('yeti');
  await page.getByRole('button', { name: 'Stop recording row 1' }).click();

  await page.reload();
  await openSettings(page);
  await expect(field(page)).toHaveText('Blue Yeti');
  // Picking the "(default)" row follows the computer's default again.
  await pickMic(page, 'MacBook Pro Microphone (default)');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Record row 2', exact: true }).click();
  expect(await page.evaluate(() => (window as unknown as { usedMic: string }).usedMic)).toBe('');
});

test('the microphone list works from the keyboard, and Esc closes only the list', async ({ page }) => {
  await open(page, mics);
  await openSettings(page);
  await field(page).focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('listbox')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Enter');
  await expect(field(page)).toHaveText('Blue Yeti');
  await expect(field(page)).toBeFocused();
});

test('before Chrome may use the mic, one row stands for the default, with why', async ({ page }) => {
  await open(page, []);
  await openSettings(page);
  await expect(field(page)).toHaveText("Computer's microphone (default)");
  await field(page).click();
  await expect(page.getByRole('option')).toHaveText(["✓Computer's microphone (default)"]);
  await expect(page.getByRole('dialog')).toContainText('The names of your microphones show once Chrome may use the mic');
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('an unplugged mic still records, with the default, and says so in the page', async ({ page }) => {
  await open(page, mics, true);
  await openSettings(page);
  await pickMic(page, 'Blue Yeti');
  await page.getByRole('button', { name: 'Done' }).click();
  await page.getByRole('button', { name: 'Record row 1', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText("Blue Yeti isn't plugged in, so this take is recorded with the default microphone.");
  await page.getByRole('button', { name: 'Stop recording row 1' }).click();
  await expect(page.getByRole('button', { name: 'Record row 1 again' })).toBeVisible();
});

test('a picked mic that is unplugged stays in the list, marked "(unplugged)"', async ({ page }) => {
  await page.addInitScript(() => (localStorage.setItem('mic', 'rode'), localStorage.setItem('mic-name', 'Rode NT-USB')));
  await open(page, mics);
  await openSettings(page);
  await expect(field(page)).toHaveText('Rode NT-USB (unplugged)');
  await field(page).click();
  await expect(page.getByRole('option')).toHaveText(['Blue Yeti', 'MacBook Pro Microphone (default)', '✓Rode NT-USB (unplugged)']);
});
