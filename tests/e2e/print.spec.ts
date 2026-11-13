import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { setUp } from './folder';

const example = readFileSync('docs/example/Episode 03 - How Photosynthesis Works/script.md', 'utf8');
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="20"><rect width="40" height="20" fill="#4a4"/></svg>';

// window.print is replaced: the test counts the calls and then looks at the page as it prints.
async function openExample(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as { printed: number }).printed = 0;
    window.print = () => void (window as unknown as { printed: number }).printed++;
  });
  await setUp(page, '#/Episode%2003', { 'Episode 03/script.md': example, 'Episode 03/assets/icons-ingredients.svg': SVG });
  await expect(page.getByLabel('Dialogue, row 1')).toBeVisible();
}

// Export / Share > Print… opens the export screen on Print (EX-9); its Print… button opens the print window.
async function openPrint(page: Page) {
  await page.getByRole('button', { name: 'Export' }).click();
  await page.getByRole('button', { name: 'Print…' }).click();
  await expect(page.getByRole('button', { name: 'Print / PDF' })).toHaveAttribute('aria-pressed', 'true');
}

async function print(page: Page, notes = false) {
  await openPrint(page);
  if (notes) {
    await page.getByLabel('Notes column on each row').check();
    await page.getByLabel('Notes space at the end').check();
    await page.getByLabel('Text size').fill('80');
  }
  await page.getByLabel('Settings').getByRole('button', { name: 'Print…' }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { printed: number }).printed)).toBe(1);
  await page.emulateMedia({ media: 'print' });
}

test('Print shows only the print version: title, version, every row, files and previews', async ({ page }) => {
  await openExample(page);
  await print(page);
  const sheet = page.locator('.print-view');
  await expect(page.getByRole('button', { name: 'Back to the script' })).toBeHidden();
  await expect(sheet.getByRole('heading', { name: 'How Photosynthesis Works' })).toBeVisible();
  await expect(sheet).toContainText('Kiva, Sam');
  await expect(sheet).toContainText('Draft · In review');
  await expect(sheet.locator('th')).toHaveText(['#', 'Dialogue', 'On screen', 'Images & files']);
  await expect(sheet.locator('tbody tr:not(.section)')).toHaveCount(5);
  await expect(sheet.locator('tr.section')).toHaveText(['Intro', 'Inside the leaf', 'Wrap-up']);
  await expect(sheet).toContainText('Slow push-in on a sunlit leaf.');
  await expect(sheet).toContainText('To find: Park b-roll of a deep breath (to film)');
  await expect(sheet).toContainText('https://example.com/chloroplast-zoom.mp4');
  await expect(sheet.locator('img:visible')).toHaveCount(1); // the svg; the jpg and png are missing
  await expect(sheet.locator('.lines')).toHaveCount(0); // no room for notes unless asked
  // Closing the print window takes the print version away.
  await page.emulateMedia({ media: 'screen' });
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  await expect(sheet).toHaveCount(0);
});

test('room for notes (a column on each row, lines at the end) and the text size, remembered', async ({ page }) => {
  await openExample(page);
  await print(page, true);
  const sheet = page.locator('.print-view');
  await expect(sheet.locator('th')).toHaveText(['#', 'Dialogue', 'On screen', 'Images & files', 'Notes']);
  await expect(sheet.locator('td.blank')).toHaveCount(5);
  await expect(sheet.getByRole('heading', { name: 'Notes' })).toBeVisible();
  await expect(sheet.locator('.line')).toHaveCount(14);
  await expect(sheet).toHaveCSS('font-size', '10.6667px'); // 8pt: 80% of 10pt
  await page.emulateMedia({ media: 'screen' });
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  await page.getByRole('button', { name: 'Back to the script' }).click();
  await openPrint(page);
  await expect(page.getByLabel('Notes column on each row')).toBeChecked();
  await expect(page.getByLabel('Notes space at the end')).toBeChecked();
  await expect(page.getByLabel('Settings')).toContainText('80%');
});

test('the official version number is printed while the script is still that version', async ({ page }) => {
  await openExample(page);
  await page.getByRole('button', { name: 'History' }).click();
  await page.getByRole('button', { name: 'Publish official version' }).click();
  await page.getByLabel('Name it').fill('First draft');
  await page.getByRole('button', { name: 'Publish v1' }).click();
  await expect(page.getByRole('heading', { name: 'v1 · First draft' })).toBeVisible();
  await print(page);
  await expect(page.locator('.print-view')).toContainText('v1 · In review');
  await page.emulateMedia({ media: 'screen' });
  await expect(page.getByLabel('Preview')).toContainText('v1 · In review'); // the preview says so too
});

test('columns to print: the rest widen (Dialogue first, then Notes), one always prints, remembered', async ({ page }) => {
  await openExample(page);
  await openPrint(page);
  const preview = page.getByLabel('Preview');
  const width = (name: string) => preview.locator('th', { hasText: name }).evaluate((th) => th.style.width);
  await page.getByLabel('Notes column on each row').check();
  await page.getByLabel('Images & files').uncheck();
  expect(await width('Dialogue')).toBe('51%'); // 29 + the files' 22
  expect(await width('Notes')).toBe('22%');
  await page.getByLabel('On screen').uncheck();
  expect(await width('Notes')).toBe('45%'); // 22 + on screen's 23
  await expect(preview.locator('th')).toHaveText(['#', 'Dialogue', 'Notes']);
  await expect(page.getByLabel('Dialogue', { exact: true })).toBeDisabled();
  await expect(page.getByLabel('Settings')).toContainText('At least one column prints.');
  await expect(preview).toContainText('Every leaf'); // the dialogue
  await expect(preview).not.toContainText('Slow push-in on a sunlit leaf.');
  await expect(preview.locator('tr.section td').first()).toHaveAttribute('colspan', '3');

  // The printed page follows, and the choice is kept for next time.
  await page.getByLabel('Settings').getByRole('button', { name: 'Print…' }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { printed: number }).printed)).toBe(1);
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.print-view th')).toHaveText(['#', 'Dialogue', 'Notes']);
  await page.emulateMedia({ media: 'screen' });
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  await page.getByRole('button', { name: 'Back to the script' }).click();
  await openPrint(page);
  await expect(page.getByLabel('On screen')).not.toBeChecked();
  await expect(page.getByLabel('Images & files')).not.toBeChecked();
  await page.getByLabel('Images & files').check();
  await page.getByLabel('Dialogue', { exact: true }).uncheck();
  await expect(preview.locator('th')).toHaveText(['#', 'Images & files', 'Notes']);
});
