import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { setUp } from './folder';

const example = readFileSync('docs/example/Episode 03 - How Photosynthesis Works/script.md', 'utf8');

test('opens on the script list', async ({ page }) => {
  await setUp(page);
  await expect(page.getByRole('heading', { name: 'No scripts here yet' })).toBeVisible();
});

test('a link opens the script it names, after set-up', async ({ page }) => {
  await setUp(page, '#/Episode%2003', { 'Episode 03/script.md': example });
  await expect(page.getByLabel('Dialogue, row 1')).toHaveValue('Every leaf you have ever seen is running a tiny factory.');
});

test('a small link to the code sits in the corner', async ({ page }) => {
  await setUp(page);
  await expect(page.getByRole('link', { name: 'GitHub' })).toHaveAttribute('href', 'https://github.com/kiva-mccr/Internal-Script-Studio');
});
