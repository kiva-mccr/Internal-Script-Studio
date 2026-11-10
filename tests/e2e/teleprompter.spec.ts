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

// Follow my voice (EX-8): the microphone and Whisper are stood in for by window.studioListen (lib/listen.ts).
type Hooks = { onText: (text: string) => void; onProgress: (loaded: number, total: number) => void; onFail: () => void };
type Fake = { hooks?: Hooks; ready?: () => void; stopped?: boolean; fail?: string };

async function fakeVoice(page: Page, fail = '') {
  await page.addInitScript((fail) => {
    const fake: Fake = { fail };
    (window as unknown as { fake: Fake }).fake = fake;
    (window as unknown as { studioListen: unknown }).studioListen = async (hooks: Hooks) => {
      if (fake.fail) throw { why: fake.fail };
      fake.hooks = hooks;
      hooks.onProgress(30e6, 75e6);
      await new Promise<void>((resolve) => (fake.ready = resolve));
      return { stop: () => (fake.stopped = true) };
    };
  }, fail);
}

test('Follow my voice: downloads once with progress, then the marker follows the words heard', async ({ page }) => {
  await fakeVoice(page);
  const prompter = await openPrompter(page);
  await prompter.getByLabel('Follow my voice').check();
  await expect(prompter.getByRole('status').filter({ hasText: 'Getting speech recognition ready' })).toContainText('30 of 75 MB');
  await page.evaluate(() => (window as unknown as { fake: Fake }).fake.ready!());
  await expect(prompter.getByText('Listening: it follows as you speak')).toBeVisible();
  await expect(prompter.getByRole('button', { name: 'Start' })).toHaveCount(0); // the voice sets the pace
  const say = (text: string) => page.evaluate((t) => (window as unknown as { fake: Fake }).fake.hooks!.onText(t), text);
  await say('every leaf you have ever seen is running a tiny factory');
  await expect(prompter.locator('.past').first()).toContainText('Every leaf'); // the first line has been read
  await expect(prompter.locator('.said')).toHaveCount(11); // each word said is greyed out
  await say('it needs three simple');
  await expect(prompter.locator('.said')).toHaveCount(15);
  await expect(prompter.locator('.said').last()).toHaveText('simple');
  const after = await scrollTop(page);
  expect(after).toBeGreaterThan(50);
  await say('sorry, can we start again'); // nothing in the script: it stays where it is
  await page.waitForTimeout(500);
  expect(Math.abs((await scrollTop(page)) - after)).toBeLessThan(5);
  await prompter.getByLabel('Follow my voice').uncheck();
  await expect(prompter.getByRole('button', { name: 'Start' })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { fake: Fake }).fake.stopped)).toBe(true);
});

test('Follow my voice: a blocked microphone or a failed download says what to do', async ({ page }) => {
  await fakeVoice(page, 'microphone');
  const prompter = await openPrompter(page);
  const box = prompter.getByLabel('Follow my voice');
  await box.click();
  await expect(prompter.getByRole('alert')).toHaveText(/The microphone isn't allowed\. Allow it from the address bar/);
  await expect(box).not.toBeChecked();
  await page.evaluate(() => ((window as unknown as { fake: Fake }).fake.fail = 'download'));
  await box.click();
  await expect(prompter.getByRole('alert')).toHaveText(/couldn't be downloaded\. Check the internet connection/);
  // It started, then stopped working (a phone out of memory): it says so and goes back to Start.
  await page.evaluate(() => ((window as unknown as { fake: Fake }).fake.fail = ''));
  await box.click();
  await page.evaluate(() => (window as unknown as { fake: Fake }).fake.ready!());
  await expect(prompter.getByText('Listening: it follows as you speak')).toBeVisible();
  await page.evaluate(() => (window as unknown as { fake: Fake }).fake.hooks!.onFail());
  await expect(prompter.getByRole('alert')).toHaveText(/stopped working on this device\. Use Start/);
  await expect(box).not.toBeChecked();
  await expect(prompter.getByRole('button', { name: 'Start' })).toBeVisible();
});
