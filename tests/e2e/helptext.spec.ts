import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { setUp } from './folder';

const example = readFileSync('docs/example/Episode 03 - How Photosynthesis Works/script.md', 'utf8');

async function openSettings(page: Page) {
  await page.getByRole('button', { name: 'More' }).click();
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible();
}

test('Hide help text (AP-43) is off by default, hides the explaining lines everywhere, and is remembered', async ({ page }) => {
  await setUp(page, '#/Episode%2003', { 'Episode 03/script.md': example });
  await page.getByRole('button', { name: /^Review/ }).click();
  const reviewHint = page.getByText('Select any text, then press Comment');
  await expect(reviewHint).toBeVisible();

  await openSettings(page);
  const box = page.getByRole('checkbox', { name: /Hide help text/ });
  await expect(box).not.toBeChecked();
  const speedHint = page.getByText('150 is a calm speaking speed.');
  const ownLine = page.getByText('The grey lines that explain how things work.');
  await expect(speedHint).toBeVisible();

  await box.check();
  await expect(speedHint).toBeHidden();
  await expect(page.getByText('Click a key to change it.')).toBeHidden();
  await expect(ownLine).toBeVisible(); // so it can be found again
  await expect(page.getByText('Kept in this browser only.')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(reviewHint).toBeHidden();

  await page.reload();
  await page.getByRole('button', { name: /^Review/ }).click();
  await expect(page.getByRole('heading', { name: /^Open ·/ })).toBeVisible(); // Review is there; its hint isn't
  await expect(reviewHint).toBeHidden();
  await openSettings(page);
  await expect(box).toBeChecked();
  await box.uncheck();
  await expect(speedHint).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(reviewHint).toBeVisible();
});

test('An empty screen keeps its heading and loses only the explanation under it', async ({ page }) => {
  await setUp(page, '', {});
  await expect(page.getByRole('heading', { name: 'No scripts here yet' })).toBeVisible();
  const why = page.getByText('Each script is a folder with a script.md file in it.');
  await expect(why).toBeVisible();
  await page.evaluate(() => localStorage.setItem('hide-help', 'on'));
  await page.reload();
  await expect(page.getByRole('heading', { name: 'No scripts here yet' })).toBeVisible();
  await expect(why).toBeHidden();
});
