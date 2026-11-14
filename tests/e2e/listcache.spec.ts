import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { setUp, writeFile } from './folder';

// The script list reads only what it needs (AP-40): counts are remembered in the browser, and a script is read again
// only when its files changed.
const example = readFileSync('docs/example/Episode 03 - How Photosynthesis Works/script.md', 'utf8');
const ids = [...example.matchAll(/<!-- id: (\w+) -->/g)].map((m) => m[1]);
const COMMENTS = 'Episode 03/.studio/comments';
const flag = (row: string, n: number) => [
  `${COMMENTS}/20261109T10000${n}Z_ana${n}flag.json`,
  JSON.stringify({ v: 1, id: `ana${n}flag`, kind: 'flag', who: 'Ana', when: `2026-11-09T10:00:0${n}Z`, row, text: '' }),
];

// The files the app opens from now on, by name (a File is only got to read it or to see its date).
async function recordReads(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { opened: string[] };
    w.opened = [];
    const getFile = FileSystemFileHandle.prototype.getFile;
    FileSystemFileHandle.prototype.getFile = function () {
      w.opened.push(this.name);
      return getFile.call(this);
    };
  });
}
const opened = (page: Page) => page.evaluate(() => (window as unknown as { opened: string[] }).opened);
const checked = (page: Page) => expect(page.locator('.table[aria-busy="false"]')).toBeVisible();

test('a script whose files are unchanged is shown from memory, and read again once they change', async ({ page }) => {
  const [name, text] = flag(ids[0], 0);
  await setUp(page, '', { 'Episode 03/script.md': example, [name]: text, 'Trailer/script.md': '---\ntitle: Trailer\n---\n' });
  await expect(page.getByText('1 flagged')).toBeVisible();
  await checked(page);

  await recordReads(page);
  await page.reload();
  await expect(page.getByText('1 flagged')).toBeVisible();
  await expect(page.getByRole('link', { name: /How Photosynthesis Works.*In review/ })).toBeVisible();
  await checked(page);
  // Only dates were looked at: no comment, History file or take was opened, and script.md only for its date.
  const reads = await opened(page);
  expect(reads.filter((n) => n.endsWith('.json'))).toEqual([]);
  expect(reads.filter((n) => n === 'script.md').length).toBeLessThanOrEqual(2);

  // Someone flags another row: coming back to the window finds it.
  await writeFile(page, ...(flag(ids[1], 1) as [string, string]));
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByText('2 flagged')).toBeVisible();
});

test('scripts added, renamed or removed elsewhere show when you come back to the window', async ({ page }) => {
  await setUp(page, '', { 'Trailer/script.md': '---\ntitle: Trailer\n---\n', 'Old/script.md': '---\ntitle: Old one\n---\n' });
  await expect(page.locator('a.row')).toHaveCount(2);
  await checked(page);

  await writeFile(page, 'Episode 07/script.md', '---\ntitle: Food Chains\nstatus: in review\n---\n');
  await writeFile(page, 'Trailer/script.md', '---\ntitle: Trailer · Season 2\n---\n');
  await page.evaluate(async () => {
    const root = await (await navigator.storage.getDirectory()).getDirectoryHandle('Video Scripts');
    await root.removeEntry('Old', { recursive: true });
  });
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByRole('link', { name: /Food Chains.*In review/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Trailer · Season 2/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Old one/ })).toHaveCount(0);

  // And the next visit starts from what was found, not from before.
  await page.reload();
  await expect(page.locator('a.row')).toHaveCount(2);
  await expect(page.getByRole('link', { name: /Trailer · Season 2/ })).toBeVisible();
});
