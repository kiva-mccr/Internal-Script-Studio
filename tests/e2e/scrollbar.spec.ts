import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { setUp } from './folder';

const example = readFileSync('docs/example/Episode 03 - How Photosynthesis Works/script.md', 'utf8');

// Headless Chromium hides scrollbars, so nothing could shift: show them, as on a real desktop.
test.use({ launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] } });

test("the top bar's buttons stay put when a tab is too short to scroll", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await setUp(page, '#/Episode%2003', { 'Episode 03/script.md': example });
  await expect(page.getByLabel('Dialogue, row 1')).toBeVisible(); // Write is longer than the window: it scrolls
  const share = page.getByRole('button', { name: 'Export / Share' });
  const x = async () => (await share.boundingBox())!.x;
  const inWrite = await x();
  for (const tab of [/^Review/, /^History/, /^Assets/]) { // History and Assets are short here
    await page.getByRole('button', { name: tab }).click();
    await expect.poll(x).toBe(inWrite);
  }
});
