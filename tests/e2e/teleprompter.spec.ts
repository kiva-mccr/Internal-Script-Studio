import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { setUp } from './folder';

const example = readFileSync('docs/example/Episode 03 - How Photosynthesis Works/script.md', 'utf8');

async function openPrompter(page: Page) {
  await setUp(page, '#/Episode%2003', { 'Episode 03/script.md': example });
  await page.getByRole('button', { name: 'More' }).click();
  await page.getByRole('button', { name: 'Teleprompter' }).click();
  const prompter = page.getByRole('dialog', { name: 'Teleprompter' });
  await expect(prompter).toBeVisible();
  return prompter;
}

const scrollTop = (page: Page) => page.locator('.prompter .scroller').evaluate((el) => el.scrollTop);

test('shows the dialogue big, with section names; cues and mirror are switches', async ({ page }) => {
  const prompter = await openPrompter(page);
  await expect(prompter.locator('.line').first()).toContainText('Every leaf you have ever seen');
  await expect(prompter.locator('.line')).toHaveCount(5);
  await expect(prompter.locator('.section')).toHaveText(['Intro', 'Inside the leaf', 'Wrap-up']);
  await expect(prompter).not.toContainText('Slow push-in on a sunlit leaf.');
  await prompter.getByLabel('On-screen cues').check();
  await expect(prompter).toContainText('[ Slow push-in on a sunlit leaf. ]');
  await prompter.getByLabel('Mirror').check();
  await expect(prompter.locator('.text')).toHaveCSS('transform', 'matrix(-1, 0, 0, 1, 0, 0)');
  await prompter.getByRole('button', { name: 'Bigger text' }).click();
  await expect(prompter.locator('.text')).toHaveCSS('font-size', '48px');
});

test('Start scrolls at the speed, Space pauses, keys change the speed, Esc leaves', async ({ page }) => {
  const prompter = await openPrompter(page);
  await expect(prompter).toContainText('150 words a minute');
  const left = await prompter.locator('.left').textContent();
  for (let i = 0; i < 25; i++) await page.keyboard.press('ArrowUp'); // up to 400, the fastest
  await expect(prompter).toContainText('400 words a minute');
  expect(left).toMatch(/^\d+:\d\d left$/);
  await prompter.getByRole('button', { name: 'Start' }).click();
  await expect.poll(() => scrollTop(page)).toBeGreaterThan(300);
  await page.keyboard.press(' ');
  await expect(prompter.getByRole('button', { name: 'Start' })).toBeVisible();
  const paused = await scrollTop(page);
  await page.waitForTimeout(300);
  expect(await scrollTop(page)).toBe(paused);
  await expect(prompter.locator('.past').first()).toBeVisible(); // lines already read are dimmed
  await page.keyboard.press('Escape');
  await expect(prompter).toHaveCount(0);
  // The speed is remembered.
  await page.getByRole('button', { name: 'More' }).click();
  await page.getByRole('button', { name: 'Teleprompter' }).click();
  await expect(page.getByRole('dialog', { name: 'Teleprompter' })).toContainText('400 words a minute');
});

test('scrolling by hand moves where it goes on from', async ({ page }) => {
  const prompter = await openPrompter(page);
  const before = await prompter.locator('.left').textContent();
  await page.locator('.prompter .scroller').evaluate((el) => (el.scrollTop = 400));
  await expect(prompter.locator('.left')).not.toHaveText(before!);
  await prompter.getByRole('button', { name: 'Exit' }).click();
  await expect(prompter).toHaveCount(0);
});
