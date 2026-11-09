import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { readFile, setUp } from './folder';

const example = readFileSync('docs/example/Episode 03 - How Photosynthesis Works/script.md', 'utf8');

test('lists each script with its title and status', async ({ page }) => {
  await setUp(page, '', {
    'Episode 03/script.md': example,
    'Trailer/script.md': '---\ntitle: Trailer · Season 1\n---\n',
    'Not a script/notes.txt': 'hello',
  });
  const rows = page.locator('a.row');
  await expect(rows).toHaveCount(2);
  await expect(page.getByRole('link', { name: /How Photosynthesis Works\s*In review/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Trailer · Season 1\s*Draft/ })).toBeVisible();
  await page.getByRole('link', { name: /How Photosynthesis Works/ }).click();
  await expect(page).toHaveURL(/#\/Episode%2003$/);
  await expect(page.getByLabel('Dialogue, row 1')).toBeVisible();
});

test('a new script opens ready to write, with you as its author', async ({ page }) => {
  await setUp(page);
  await page.getByRole('button', { name: 'New script' }).click();
  await page.getByLabel('Name of the new script').fill('Episode 05: Food Chains');
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page).toHaveURL(/#\/Episode%2005%20Food%20Chains$/);
  await expect(page.getByLabel('Dialogue, row 1')).toHaveValue('');
  const text = await readFile(page, 'Episode 05 Food Chains/script.md');
  expect(text).toContain('title: Episode 05: Food Chains');
  expect(text).toContain('authors: [Sam]');
  await page.getByRole('link', { name: 'Video Scripts' }).click();
  await expect(page.getByRole('link', { name: /Episode 05: Food Chains/ })).toBeVisible();
});

test('a name already used is refused plainly', async ({ page }) => {
  await setUp(page, '', { 'Trailer/script.md': '' });
  await page.getByRole('button', { name: 'New script' }).click();
  await page.getByLabel('Name of the new script').fill('trailer');
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByRole('alert')).toHaveText('There is already a script called "trailer".');
});

test("picking one script's folder says which folder to pick", async ({ page }) => {
  await setUp(page, '', { 'script.md': example });
  await expect(page.getByRole('heading', { name: "This is one script's folder" })).toBeVisible();
});
