import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { setUp, writeFile } from './folder';

const example = readFileSync('docs/example/Episode 03 - How Photosynthesis Works/script.md', 'utf8');
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="20"><rect width="40" height="20" fill="#4a4"/></svg>';
// All but two of the example's files are in the folder: storyboard-p4.pdf and glucose-model.png are missing.
const OTHERS = ['leaf-push-in.mp4', 'music-bed.mp3', 'cell-micrograph.tif', 'glucose-notes.docx', 'park-shot-list.txt', 'lesson-slides.pptx'];
const FILES = { 'Episode 03/script.md': example, 'Episode 03/assets/leaf-closeup.jpg': 'jpg', 'Episode 03/assets/icons-ingredients.svg': SVG,
  ...Object.fromEntries(OTHERS.map((f) => [`Episode 03/assets/${f}`, 'x'])) };

async function openAssets(page: Page) {
  await setUp(page, '#/Episode%2003', FILES);
  await expect(page.getByLabel('Dialogue, row 1')).toBeVisible();
  await page.getByRole('button', { name: /^Assets/ }).click();
  return page.getByRole('region', { name: 'Assets' });
}

test('the Assets tab counts what is missing and lists it first, then what to find, then the rest', async ({ page }) => {
  await setUp(page, '#/Episode%2003', FILES);
  await expect(page.getByRole('button', { name: /^Assets/ })).toContainText('2');
  await expect(page.getByLabel('2 missing')).toBeVisible();
  await page.getByRole('button', { name: /^Assets/ }).click();
  const assets = page.getByRole('region', { name: 'Assets' });
  await expect(assets.locator('.sum')).toHaveText('12 in 5 rows · 2 missing · 1 to find');
  await expect(assets.locator('h2')).toHaveText(['Missing from the folder', 'Still to find or film', 'In the folder or linked']);
  await expect(assets.locator('li.lost .open')).toHaveText(['storyboard-p4.pdf', 'glucose-model.png']);
  await expect(assets.locator('li.find')).toContainText('Park b-roll of a deep breath (to film)');
  await expect(assets.locator('li.here .open')).toHaveText(['leaf-closeup.jpg', 'leaf-push-in.mp4', 'icons-ingredients.svg', 'music-bed.mp3',
    'Chloroplast zoom animation', 'cell-micrograph.tif', 'glucose-notes.docx', 'park-shot-list.txt', 'lesson-slides.pptx']);
  await expect(assets.locator('li.here img:visible')).toHaveCount(1); // the svg; the fake files aren't pictures, so no thumbnail is drawn
});

test('a file put in the folder stops being missing', async ({ page }) => {
  const assets = await openAssets(page);
  await expect(assets.locator('li.lost')).toHaveCount(2);
  await writeFile(page, 'Episode 03/assets/glucose-model.png', 'png');
  await expect(assets.locator('li.lost')).toHaveCount(1, { timeout: 10000 }); // the 5 s check
  await expect(page.getByLabel('1 missing')).toBeVisible();
});

test('Order by row lists each row under its section, and is remembered', async ({ page }) => {
  const assets = await openAssets(page);
  await assets.getByRole('button', { name: 'Order: by what needs doing' }).click();
  await expect(assets.locator('h2')).toHaveText(['Intro', 'Inside the leaf', 'Wrap-up']);
  await expect(assets.locator('.by-row').nth(3)).toContainText('glucose-model.png · missing');
  await page.reload();
  await page.getByRole('button', { name: /^Assets/ }).click();
  await expect(page.getByRole('button', { name: 'Order: by row' })).toBeVisible();
});

test('a row number goes to that row in Write', async ({ page }) => {
  const assets = await openAssets(page);
  await assets.locator('li.find').getByRole('button', { name: 'Row 5' }).click();
  await expect(page.getByLabel('Dialogue, row 5')).toBeFocused();
});

test('the script list says how many files are missing', async ({ page }) => {
  await setUp(page, '', { ...FILES, 'Trailer/script.md': '---\ntitle: Trailer\n---\n' });
  await expect(page.getByRole('link', { name: /How Photosynthesis Works/ }).locator('.missing')).toHaveText('2 missing');
  await expect(page.getByRole('link', { name: /Trailer/ }).locator('.missing')).toHaveCount(0);
});
