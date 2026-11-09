import { expect, test } from '@playwright/test';

test('opens on the script list', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Script Studio' })).toBeVisible();
});

test('a link opens the script it names', async ({ page }) => {
  await page.goto('./#/Episode%2003');
  await expect(page.getByRole('heading', { name: 'Episode 03' })).toBeVisible();
});
