import { expect, test } from '@playwright/test';
import { setUp } from './folder';

test('opens on the script list', async ({ page }) => {
  await setUp(page);
  await expect(page.getByRole('heading', { name: 'Script Studio' })).toBeVisible();
});

test('a link opens the script it names', async ({ page }) => {
  await setUp(page, '#/Episode%2003');
  await expect(page.getByRole('heading', { name: 'Episode 03' })).toBeVisible();
});
