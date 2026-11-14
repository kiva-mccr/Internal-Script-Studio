import { expect, test } from '@playwright/test';
import { fakeFolder } from './folder';

// The example to try (AP-33): a made-up script kept in the browser's private storage, never in the shared folder.

test('the example opens with its pictures, comments and History, and nothing is remembered as the folder', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Open the example' }).click();
  await expect(page.getByText('Example script.')).toBeVisible();
  await page.getByText('How Photosynthesis Works').click();
  await expect(page.getByText('Every leaf you have ever seen is running a tiny factory.')).toBeVisible();
  await expect(page.locator('img[alt="leaf-closeup.jpg"], img[src^="blob:"]').first()).toBeVisible();
  // Matched by its start: its name can gain a count of what's new (RV-21).
  await page.getByRole('button', { name: /^Review/ }).click();
  await expect(page.getByText('Could we shoot a real leaf for this instead of stock footage?')).toBeVisible();
  await page.getByRole('button', { name: 'History', exact: true }).click();
  await expect(page.getByText('Sent for review').first()).toBeVisible();

  // A reload stays in the example; leaving it goes back to the first-time screen at the list.
  await page.reload();
  await expect(page.getByText('Example script.')).toBeVisible();
  await page.getByRole('button', { name: 'Open your scripts folder' }).click();
  await expect(page.getByRole('heading', { name: 'Open your scripts folder' })).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Open your scripts folder' })).toBeVisible();
});

test('keeps a typed name, but not Guest', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Open the example' }).click();
  await page.getByRole('button', { name: 'Open your scripts folder' }).click();
  await expect(page.getByLabel('Your name')).toHaveValue('');
  await page.getByLabel('Your name').fill('Robin');
  await page.getByRole('button', { name: 'Open the example' }).click();
  await page.getByRole('button', { name: 'Open your scripts folder' }).click();
  await expect(page.getByLabel('Your name')).toHaveValue('Robin');
});

test('edits are kept for the next visit, and Start over puts it back, with Undo', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Open the example' }).click();
  await page.getByText('How Photosynthesis Works').click();
  await page.getByLabel('Dialogue, row 1').click();
  await page.keyboard.press('End');
  await page.keyboard.type(' Kept.');
  await expect(page.getByRole('status')).toHaveText('Saved');

  await page.getByRole('button', { name: 'Open your scripts folder' }).click();
  await page.getByRole('button', { name: 'Open the example' }).click();
  await page.getByText('How Photosynthesis Works').click();
  const row1 = page.getByLabel('Dialogue, row 1');
  await expect(row1).toHaveValue('Every leaf you have ever seen is running a tiny factory. Kept.');

  await page.getByRole('button', { name: 'Start over' }).click();
  await expect(page.getByText('The example is back as new.')).toBeVisible();
  await expect(row1).toHaveValue('Every leaf you have ever seen is running a tiny factory.');
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(row1).toHaveValue('Every leaf you have ever seen is running a tiny factory. Kept.');
});

test('the offer folds to one line, and stays folded on the next visit', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Minimize' }).click();
  await expect(page.getByRole('button', { name: 'Open the example' })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Open the example' })).toHaveCount(0);
  await page.getByRole('button', { name: '▸ Try it with an example' }).click();
  await expect(page.getByRole('button', { name: 'Open the example' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Open the example' })).toBeVisible();
});

test('the real folder is still opened as before, and the example never shows in it', async ({ page }) => {
  await fakeFolder(page);
  await page.goto('./');
  await page.getByRole('button', { name: 'Open the example' }).click();
  await page.getByRole('button', { name: 'Open your scripts folder' }).click();
  await page.getByLabel('Your name').fill('Sam');
  await page.getByRole('button', { name: 'Choose folder' }).click();
  await expect(page.getByText('Video Scripts')).toBeVisible();
  await expect(page.getByText('How Photosynthesis Works')).toHaveCount(0);
  await expect(page.getByText('Example script.')).toHaveCount(0);
});

test('the example shows every kind of file the app previews, and a take on every row', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Open the example' }).click();
  await page.getByText('How Photosynthesis Works').click();
  await expect(page.locator('video[aria-label="leaf-push-in.mp4"]')).toBeAttached();
  await expect(page.getByRole('button', { name: 'Play music-bed.mp3' })).toBeVisible();
  await expect(page.getByText('Page 1 of 1')).toBeVisible(); // the PDF
  await expect(page.getByRole('button', { name: 'Open cell-micrograph.tif' })).toBeVisible();
  await expect(page.getByText('Glucose model: notes for the animator')).toBeVisible(); // Word
  await expect(page.getByText('Park shot list (made up)')).toBeVisible(); // text
  await expect(page.getByText('· PowerPoint')).toBeVisible(); // a kind with no preview
  // Every row has a take, read from the current words, so none is Outdated and the whole script is recorded.
  await expect(page.getByText(/wpm · Kiva/)).toHaveCount(5);
  await expect(page.getByText('Outdated')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Play the script' })).toBeVisible();
});
