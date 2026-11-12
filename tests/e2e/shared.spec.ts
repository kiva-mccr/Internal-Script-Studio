import { expect, test } from '@playwright/test';
import { readFile, setUp } from './folder';

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="20"><rect width="40" height="20" fill="#4a4"/></svg>';
const row = (files: string[]) => `## 1 <!-- id: aaaaa -->\nDialogue:\nHello.\n\nOn screen:\n\nFiles:\n${files.map((f) => `- ${f}\n`).join('')}`;
const FILES = {
  'Trailer/script.md': `---\ntitle: Trailer\n---\n\n${row(['assets/leaf.svg'])}`,
  'Trailer/assets/leaf.svg': 'old leaf',
  'Water Cycle/script.md': `---\ntitle: The Water Cycle\nstatus: approved\n---\n\n${row(['assets/leaf.svg', '[Rain sound](https://example.com/rain.mp3)'])}`,
  'Water Cycle/assets/leaf.svg': SVG,
  'Water Cycle/assets/cloud.mp4': 'mp4',
  'Empty/script.md': `---\ntitle: Empty\n---\n\n${row([])}`,
};

async function openBrowser(page: import('@playwright/test').Page) {
  await setUp(page, '#/Trailer', FILES);
  await page.getByLabel('Dialogue, row 1').hover();
  await page.getByRole('button', { name: '+ Add', exact: true }).click();
  await page.getByRole('button', { name: 'From other scripts…' }).click();
  return page.getByRole('dialog', { name: 'Files from other scripts' });
}

test('From other scripts lists every other script with files, and copies a picked file into this one', async ({ page }) => {
  const box = await openBrowser(page);
  await expect(box.locator('.sum')).toHaveText('3 files in 1 script');
  await expect(box.locator('h3')).toHaveText(['The Water Cycle · Approved']); // not this script, not one with no files
  await expect(box.locator('.tile .name')).toHaveText(['cloud.mp4', 'leaf.svg', 'Rain sound']);
  await expect(box.locator('.tile .uses')).toHaveText(['Not in any row', 'In 1 row', 'In 1 row']);
  await expect(box.locator('.tile img:visible')).toHaveCount(1);
  await expect(box.getByRole('button', { name: 'Add to row 1' })).toBeDisabled();
  await box.getByRole('button', { name: /leaf\.svg/ }).click();
  await expect(box.locator('.foot')).toContainText("leaf.svg will be copied into this script's assets folder.");
  await box.getByRole('button', { name: 'Add to row 1' }).click();
  await expect(box).toHaveCount(0);
  // This script already has a leaf.svg: the copy gets a number, and nothing is overwritten.
  await expect(page.locator('.chip').getByRole('button', { name: 'leaf 2.svg', exact: true })).toBeVisible();
  await expect(page.getByText('Copied from The Water Cycle')).toBeVisible();
  expect(await readFile(page, 'Trailer/assets/leaf 2.svg')).toBe(SVG);
  expect(await readFile(page, 'Trailer/assets/leaf.svg')).toBe('old leaf');
  await expect.poll(() => readFile(page, 'Trailer/script.md')).toContain('- assets/leaf 2.svg');
});

test('a link is added as the same link, and Find narrows by name', async ({ page }) => {
  const box = await openBrowser(page);
  await box.getByLabel('Find').fill('rain');
  await expect(box.locator('.tile .name')).toHaveText(['Rain sound']);
  await box.getByRole('button', { name: /Rain sound/ }).click();
  await expect(box.locator('.foot')).toContainText('Rain sound is a link: it is added as the same link.');
  await box.getByRole('button', { name: 'Add to row 1' }).click();
  await expect(page.getByRole('link', { name: 'Rain sound' })).toBeVisible();
  await expect.poll(() => readFile(page, 'Trailer/script.md')).toContain('- [Rain sound](https://example.com/rain.mp3)');
});

test('Find with no match says so, and Esc closes the window', async ({ page }) => {
  const box = await openBrowser(page);
  await box.getByLabel('Find').fill('zebra');
  await expect(box).toContainText('No file in other scripts has "zebra" in its name.');
  await page.keyboard.press('Escape');
  await expect(box).toHaveCount(0);
});

test('Files on the script list shows every script\'s files, opens a file, and a script\'s name opens it', async ({ page }) => {
  await setUp(page, '', FILES);
  await page.getByRole('button', { name: 'Files', exact: true }).click();
  const box = page.getByRole('dialog', { name: 'Files in every script' });
  await expect(box.locator('h3')).toHaveText(['The Water Cycle · Approved', 'Trailer · Draft']);
  await expect(box.getByRole('button', { name: /Add to row/ })).toHaveCount(0);
  const popup = page.waitForEvent('popup');
  await box.getByRole('button', { name: /cloud\.mp4/ }).click();
  expect((await popup).url()).toMatch(/^blob:/);
  await box.getByRole('link', { name: 'Trailer' }).click();
  await expect(box).toHaveCount(0);
  await expect(page.getByLabel('Dialogue, row 1')).toHaveValue('Hello.');
});
