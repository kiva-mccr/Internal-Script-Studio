import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { setUp } from './folder';

const example = readFileSync('docs/example/Episode 03 - How Photosynthesis Works/script.md', 'utf8');

async function openExport(page: Page, item: string) {
  await setUp(page, '#/Episode%2003', { 'Episode 03/script.md': example });
  await expect(page.getByLabel('Dialogue, row 1')).toBeVisible();
  await page.getByRole('button', { name: 'Export / Share' }).click();
  await page.getByRole('button', { name: item }).click();
}

test('the export screen opens on the picked format, in place of the script, and goes back', async ({ page }) => {
  await openExport(page, 'Final Draft (.fdx)');
  await expect(page.getByRole('navigation', { name: 'Export as' }).getByRole('button')).toHaveText(
    ['Print / PDF', 'Fountain (.fountain)', 'Final Draft (.fdx)', 'Voice-over (.wav)']);
  await expect(page.getByRole('button', { name: 'Final Draft (.fdx)' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('Dialogue, row 1')).toHaveCount(0);
  const preview = page.getByLabel('Preview');
  await expect(preview.locator('.scene').first()).toHaveText('INTRO');
  await expect(preview.locator('.general').first()).toHaveText('Row 1 · Files: assets/leaf-closeup.jpg, assets/leaf-push-in.mp4');
  await page.getByRole('button', { name: 'Print / PDF' }).click();
  await expect(preview.getByRole('heading', { name: 'How Photosynthesis Works' })).toBeVisible(); // the print page, on screen
  await expect(page.getByRole('button', { name: 'Print…' })).toBeVisible();
  await page.getByRole('button', { name: 'Back to the script' }).click();
  await expect(page.getByLabel('Dialogue, row 1')).toBeVisible();
});

test('Fountain settings change the preview and the file, and are remembered', async ({ page }) => {
  await openExport(page, 'Fountain (.fountain)');
  const file = page.getByLabel('Preview').locator('pre');
  await expect(file).toContainText('.INTRO');
  await page.getByLabel('Speaker name').fill('Host');
  await page.getByLabel('Sections as scene headings').uncheck();
  await page.getByLabel('Row numbers as notes').uncheck();
  await page.getByLabel('Files as notes').uncheck();
  await expect(file).toContainText('# Intro\n\nSlow push-in on a sunlit leaf.\n\nHOST\nEvery leaf');
  await expect(page.getByLabel('Preview').locator('.speaker').first()).toHaveText('HOST');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Save .fountain' }).click()]);
  const text = readFileSync(await download.path(), 'utf8');
  expect(text).toContain('\nHOST\n');
  expect(text).not.toContain('[[Row');
  // Final Draft keeps its own settings; Fountain's are back after a reload.
  await page.getByRole('button', { name: 'Final Draft (.fdx)' }).click();
  await expect(page.getByLabel('Speaker name')).toHaveValue('NARRATOR');
  await page.reload();
  await page.getByRole('button', { name: 'Export / Share' }).click();
  await page.getByRole('button', { name: 'Fountain (.fountain)' }).click();
  await expect(page.getByLabel('Speaker name')).toHaveValue('Host');
  await expect(page.getByLabel('Row numbers as notes')).not.toBeChecked();
});

test('Final Draft: row numbers and files off take the row line out', async ({ page }) => {
  await openExport(page, 'Final Draft (.fdx)');
  await page.getByLabel('Row numbers and files').uncheck();
  await expect(page.getByLabel('Preview').locator('.general')).toHaveCount(0);
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Save .fdx' }).click()]);
  expect(readFileSync(await download.path(), 'utf8')).not.toContain('Row 1');
});

test('Esc goes back to the script, but not from the speaker name', async ({ page }) => {
  await openExport(page, 'Fountain (.fountain)');
  await page.getByLabel('Speaker name').press('Escape');
  await expect(page.getByLabel('Speaker name')).toBeVisible();
  await page.getByRole('button', { name: 'Fountain (.fountain)' }).press('Escape');
  await expect(page.getByLabel('Dialogue, row 1')).toBeVisible();
});
