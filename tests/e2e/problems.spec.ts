import { expect, test } from '@playwright/test';

// Copy details (AP-41): an error has a small copy icon that copies what went wrong; a hint has none.

test('an error copies its details; a hint has no copy icon', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.addInitScript(() => {
    (window as unknown as { showDirectoryPicker: () => Promise<never> }).showDirectoryPicker = async () => {
      throw new DOMException('system folder', 'SecurityError');
    };
  });
  await page.goto('./');

  await page.getByRole('button', { name: 'Choose folder' }).click();
  await expect(page.getByRole('alert')).toHaveText('Type your name first.');
  await expect(page.getByRole('button', { name: 'Copy details' })).toHaveCount(0);

  await page.getByLabel('Your name').fill('Sam');
  await page.getByRole('button', { name: 'Choose folder' }).click();
  const alert = page.getByRole('alert');
  await expect(alert).toHaveText(/couldn't be opened/);
  const copy = alert.getByRole('button', { name: 'Copy details' });
  await copy.click();
  await expect(copy).toHaveAttribute('title', 'Copied');
  const text = await page.evaluate(() => navigator.clipboard.readText());
  expect(text).toMatch(/^That folder couldn't be opened\. Try again, or pick a different folder\.\n\n/);
  expect(text).toContain('While: opening the picked folder');
  expect(text).toContain('Error: SecurityError: system folder');
  expect(text).toContain('App: P2P Script Studio, dev build');
  expect(text).toMatch(/Browser: Chrome \d+/);
  await expect(copy).toHaveAttribute('title', 'Copy details');
});
