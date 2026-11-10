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

async function print(page: Page, notes = false) {
  await page.getByRole('button', { name: 'More' }).click();
  await page.getByRole('button', { name: 'Print…' }).click();
  if (notes) {
    await page.getByLabel('Notes column on each row').check();
    await page.getByLabel('Notes space at the end').check();
    await page.getByLabel('Text size').fill('80');
  }
  await page.locator('.print-menu').getByRole('button', { name: 'Print' }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { printed: number }).printed)).toBe(1);
  await page.emulateMedia({ media: 'print' });
}

test('Print shows only the print version: title, version, every row, files and previews', async ({ page }) => {
  await openExample(page);
  await print(page);
  const sheet = page.locator('.print-view');
  await expect(page.getByRole('navigation', { name: 'Mode' })).toBeHidden();
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
  await page.getByRole('button', { name: 'More' }).click();
  await page.getByRole('button', { name: 'Print…' }).click();
  await expect(page.getByLabel('Notes column on each row')).toBeChecked();
  await expect(page.getByLabel('Notes space at the end')).toBeChecked();
  await expect(page.locator('.print-menu')).toContainText('80%');
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
});
