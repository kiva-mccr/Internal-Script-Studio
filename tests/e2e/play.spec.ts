import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { setUp } from './folder';

const example = readFileSync('docs/example/Episode 03 - How Photosynthesis Works/script.md', 'utf8');

// The microphone is faked as in voice.spec.ts: a take is a real WAV of 1.5 s with a tone in its middle, so the
// crop finds about a second to play. (All silence played for as long as the quick test "recorded", a tenth of a
// second, over before a busy machine's test saw the row playing.) Rows with no take are read fast (the
// teleprompter's speed), so the test doesn't wait long.
async function openWithTakes(page: Page, taken: number[]) {
  await page.addInitScript(() => {
    localStorage.setItem('prompter-speed', '400');
    const wav = () => {
      const rate = 8000, n = rate * 1.5, buf = new DataView(new ArrayBuffer(44 + n * 2));
      const text = (at: number, s: string) => [...s].forEach((c, i) => buf.setUint8(at + i, c.charCodeAt(0)));
      text(0, 'RIFF'); buf.setUint32(4, 36 + n * 2, true); text(8, 'WAVEfmt '); buf.setUint32(16, 16, true);
      buf.setUint16(20, 1, true); buf.setUint16(22, 1, true); buf.setUint32(24, rate, true); buf.setUint32(28, rate * 2, true);
      buf.setUint16(32, 2, true); buf.setUint16(34, 16, true); text(36, 'data'); buf.setUint32(40, n * 2, true);
      for (let i = 0.2 * rate; i < 1.3 * rate; i++) buf.setInt16(44 + i * 2, Math.round(8000 * Math.sin(i / 3)), true);
      return new Blob([buf], { type: 'audio/wav' });
    };
    (window as unknown as { studioRecord: () => Promise<{ stop: () => Promise<Blob> }> }).studioRecord = async () => ({
      stop: async () => wav(),
    });
  });
  await setUp(page, '#/Episode%2003', { 'Episode 03/script.md': example });
  for (const row of taken) {
    await page.getByRole('button', { name: `Record row ${row}`, exact: true }).click();
    await page.getByRole('button', { name: `Stop recording row ${row}` }).click();
    await expect(page.getByRole('button', { name: `Record row ${row} again` })).toBeVisible();
  }
}

const playing = (page: Page) => page.locator('.row.here');

test('Play goes through the rows in order: a take is heard, a row with none waits its read time', async ({ page }) => {
  await openWithTakes(page, [1, 3]);
  await page.getByRole('button', { name: 'Play the script' }).click();
  await expect(playing(page).getByLabel('Dialogue, row 1')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Pause the script' })).toHaveText(/❚❚ 0:0\d \/ 0:\d\d/);
  await expect(page.getByRole('button', { name: 'Pause row 1' })).toBeVisible();
  await expect(playing(page).getByLabel('Dialogue, row 2')).toBeVisible();
  await expect(playing(page).getByRole('status')).toContainText('No take yet · waiting its read time, 0:0');
  await expect(playing(page).getByLabel('Dialogue, row 3')).toBeVisible({ timeout: 10000 });
  await expect(playing(page).getByLabel('Dialogue, row 5')).toBeVisible({ timeout: 15000 });
  // The end of the last row stops it.
  await expect(page.getByRole('button', { name: 'Play the script' })).toBeVisible({ timeout: 10000 });
  await expect(playing(page)).toHaveCount(0);
});

test('pause and carry on, play from a row, stop', async ({ page }) => {
  await openWithTakes(page, [1]);
  await page.getByRole('button', { name: 'Play from row 2' }).click();
  await expect(playing(page).getByLabel('Dialogue, row 2')).toBeVisible();
  await page.getByRole('button', { name: 'Pause the script' }).click();
  const paused = page.getByRole('button', { name: 'Carry on playing the script' });
  const time = await paused.textContent();
  await page.waitForTimeout(600);
  await expect(paused).toHaveText(time!);
  await paused.click();
  await expect(page.getByRole('button', { name: 'Pause the script' })).toBeVisible();
  await page.getByRole('button', { name: 'Stop playing' }).click();
  await expect(playing(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Play the script' })).toBeVisible();
});

test('Space pauses and Esc stops, but not while typing', async ({ page }) => {
  await openWithTakes(page, [1]);
  await page.getByRole('button', { name: 'Play from row 2' }).click();
  await page.getByLabel('Dialogue, row 4').click();
  await page.keyboard.type(' ');
  await expect(page.getByRole('button', { name: 'Pause the script' })).toBeVisible(); // typed, not paused
  // Leave the text field (not by clicking main's corner: the sticky bar covers it while the page follows the rows).
  await page.evaluate(() => (document.activeElement as HTMLElement).blur());
  await page.keyboard.press(' ');
  await expect(page.getByRole('button', { name: 'Carry on playing the script' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Play the script' })).toBeVisible();
});

test('Play is offered in Write and Review once a row has a take; recording stops it', async ({ page }) => {
  await openWithTakes(page, []);
  await expect(page.getByRole('button', { name: 'Play the script' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Play from row 1' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Record row 1', exact: true }).click();
  await page.getByRole('button', { name: 'Stop recording row 1' }).click();
  await page.getByRole('button', { name: 'Play from row 2' }).click();
  await expect(playing(page)).toHaveCount(1);
  await page.getByRole('button', { name: 'Record row 3', exact: true }).click();
  await expect(playing(page)).toHaveCount(0);
  await page.getByRole('button', { name: 'Stop recording row 3' }).click();
  await page.getByRole('button', { name: 'Assets' }).click();
  await expect(page.getByRole('button', { name: 'Play the script' })).toHaveCount(0);
});

test('the page follows the row being played, and the top bar stays in view', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 500 });
  await openWithTakes(page, [1]);
  await page.getByRole('button', { name: 'Play from row 5' }).click();
  await expect(playing(page).getByLabel('Dialogue, row 5')).toBeInViewport();
  await expect(page.getByRole('button', { name: 'Stop playing' })).toBeInViewport();
});

test('a row number turns into ▶ under the mouse, and shows ❚❚ while its row plays (AU-7)', async ({ page }) => {
  await openWithTakes(page, [1]);
  const from = page.getByRole('button', { name: 'Play from row 3' });
  await expect(from.locator('.n')).toBeVisible();
  await expect(from.locator('.go')).toBeHidden();
  await page.getByLabel('Dialogue, row 3').hover(); // anywhere on the row, not only the number
  await expect(from.locator('.go')).toBeVisible();
  await expect(from.locator('.n')).toBeHidden();
  await from.click();
  await expect(playing(page).getByLabel('Dialogue, row 3')).toBeVisible();
  const pause = page.getByRole('button', { name: 'Pause at row 3' });
  await expect(pause).toHaveText('❚❚');
  await pause.click();
  await expect(page.getByRole('button', { name: 'Carry on playing the script' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Play from row 3' })).toBeVisible();
});

test('Review plays the takes without the recording tools (AU-9)', async ({ page }) => {
  await openWithTakes(page, [1]);
  await page.getByRole('button', { name: 'Review' }).click();
  const row1 = page.locator('.row').filter({ has: page.getByLabel('Dialogue, row 1') });
  await expect(row1.locator('.take .about')).toContainText(/\d+ wpm · Sam, \w{3} \d+/);
  // Only listening: no mic, no deleting the take, no rows of other takes.
  await expect(page.getByRole('button', { name: /^Record row/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Delete the take/ })).toHaveCount(0);
  await expect(page.locator('.take')).toHaveCount(1);
  // A take alone.
  await page.getByRole('button', { name: 'Play row 1' }).click();
  await expect(page.getByRole('button', { name: 'Pause row 1' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Play row 1' })).toBeVisible({ timeout: 5000 });
  // Play the script from a row: the row is tinted, a row with no take waits its read time.
  const from = page.getByRole('button', { name: 'Play from row 2' });
  await expect(from.locator('.go')).toBeHidden();
  await page.getByLabel('Dialogue, row 2').hover();
  await expect(from.locator('.go')).toBeVisible();
  await from.click();
  await expect(page.locator('.row.here').getByLabel('Dialogue, row 2')).toBeVisible();
  await expect(page.locator('.row.here').getByRole('status')).toContainText('No take yet · waiting its read time, 0:0');
  await expect(page.getByRole('button', { name: 'Pause at row 2' })).toHaveText('❚❚');
  await page.getByRole('button', { name: 'Pause the script' }).click();
  await page.getByRole('button', { name: 'Stop playing' }).click();
  await expect(page.locator('.row.here')).toHaveCount(0);
  // The top bar's Play starts from the top, where the take is.
  await page.getByRole('button', { name: 'Play the script' }).click();
  await expect(page.locator('.row.here').getByLabel('Dialogue, row 1')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Pause row 1' })).toBeVisible();
});

test('an outdated take shows Outdated in Review, with no × to hide it (AU-9)', async ({ page }) => {
  await openWithTakes(page, [1]);
  await page.getByLabel('Dialogue, row 1').click();
  await page.keyboard.press('End');
  await page.keyboard.type(' Changed.');
  await expect(page.locator('.old')).toContainText('Outdated');
  await page.getByRole('button', { name: 'Review' }).click();
  await expect(page.locator('.old')).toHaveText('Outdated');
  await expect(page.getByRole('button', { name: /hide Outdated/ })).toHaveCount(0);
});
