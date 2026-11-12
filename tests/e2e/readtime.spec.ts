import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { setUp } from './folder';

const example = readFileSync('docs/example/Episode 03 - How Photosynthesis Works/script.md', 'utf8');
const take = (seconds: number, text: string) => JSON.stringify({ by: 'Alex', at: 1, seconds, text });
const ids = ['k3f9a', 'p8x2m', 't1q7c', 'b6n0w', 'z4r5e'];

// The example's dialogue is 21, 32 and 10 words by section: 63 words, 0:25 at 150 words a minute.
test('each section shows its read time in Write and Review, and the top bar the whole script (AP-12)', async ({ page }) => {
  await setUp(page, '#/Episode%2003', { 'Episode 03/script.md': example });
  await expect(page.locator('.section .time')).toHaveText(['0:08', '0:13', '0:04']);
  await expect(page.locator('header .voice')).toHaveText('0:25');
  await page.getByLabel('Dialogue, row 5').fill('Short now.');
  await expect(page.locator('.section .time')).toHaveText(['0:08', '0:13', '0:01']);
  await page.getByRole('button', { name: /^Review/ }).click();
  await expect(page.locator('.section .time')).toHaveText(['0:08', '0:13', '0:01']);
  await expect(page.locator('header .voice')).toHaveText('0:22');
});

test('the speaking speed is set in Settings, shared with the teleprompter, and kept (AP-12)', async ({ page }) => {
  await setUp(page, '#/Episode%2003', {
    'Episode 03/script.md': example,
    'Episode 03/voice/row-k3f9a.json': take(4, 'Every leaf you have ever seen is running a tiny factory.'), // 11 words in 4 s
  });
  await expect(page.locator('header .voice')).toHaveText('1 of 5 · 0:04/0:25');
  await page.getByRole('button', { name: 'More' }).click();
  await page.getByRole('button', { name: 'Settings' }).click();
  const speed = page.getByLabel('Speaking speed');
  await expect(speed).toHaveValue('150');
  await speed.fill('300');
  await speed.press('Tab');
  await expect(page.locator('.section .time')).toHaveText(['0:04', '0:06', '0:02']);
  await expect(page.locator('header .voice')).toHaveText('1 of 5 · 0:04/0:14'); // 4 s, then 52 words at 300
  await page.getByRole('button', { name: 'Slower' }).click();
  await expect(speed).toHaveValue('290');
  await speed.fill('5');
  await speed.press('Tab');
  await expect(speed).toHaveValue('60'); // the slowest
  await expect(page.getByText('Your takes average 165 words a minute.')).toBeVisible();
  await page.getByRole('button', { name: 'Use 165' }).click();
  await expect(speed).toHaveValue('165');
  await expect(page.getByText(/Your takes average/)).toHaveCount(0);
  await page.getByRole('button', { name: 'Done' }).click();

  await page.reload();
  await expect(page.locator('.section .time')).toHaveText(['0:08', '0:12', '0:04']); // still 165
  await page.getByRole('button', { name: 'More' }).click();
  await page.getByRole('button', { name: 'Teleprompter' }).click();
  const prompter = page.getByRole('dialog', { name: 'Teleprompter' });
  await expect(prompter).toContainText('165 words a minute');
  await page.keyboard.press('ArrowUp');
  await expect(prompter).toContainText('175 words a minute');
  await page.keyboard.press('Escape');
  await expect(page.locator('.section .time')).toHaveText(['0:07', '0:11', '0:03']);
});

test('the script list shows each script’s length: read time, or recorded once every row has a take (AP-12)', async ({ page }) => {
  const files: Record<string, string> = { 'Episode 03/script.md': example, 'Episode 02/script.md': example.replace('How Photosynthesis Works', 'The Water Cycle'), 'Trailer/script.md': '' };
  ids.forEach((id) => (files[`Episode 02/voice/row-${id}.json`] = take(10, 'x')));
  files['Episode 03/voice/row-k3f9a.json'] = take(10, 'x');
  await setUp(page, '', files);
  const length = (name: string) => page.locator('a.row', { hasText: name }).locator('.length');
  await expect(length('The Water Cycle')).toHaveText('0:50');
  await expect(length('The Water Cycle').getByRole('img', { name: 'recorded' })).toBeVisible();
  await expect(length('The Water Cycle')).toHaveAttribute('title', 'Recorded voice-over, every row');
  await expect(length('How Photosynthesis')).toHaveText('0:31'); // 10 s, then 52 words at 150
  await expect(length('How Photosynthesis').getByRole('img')).toHaveCount(0);
  await expect(length('How Photosynthesis')).toHaveAttribute('title', 'Read time at 150 words a minute');
  await expect(length('Trailer')).toHaveText('');
});
