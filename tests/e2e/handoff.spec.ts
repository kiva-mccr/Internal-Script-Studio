// FX-2: saving survives a page closed at any step (the user asked for this to be robust).
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { changeFile, readFile, setUp, writeChange, writeFile } from './folder';

const example = readFileSync('docs/example/Episode 03 - How Photosynthesis Works/script.md', 'utf8');
const SCRIPT = 'Episode 03/script.md';
const leaf = 'Slow push-in on a sunlit leaf.';
const minutesAgo = (n: number) => new Date(Date.now() - n * 60_000);

async function open(page: Page, files: Record<string, string> = {}) {
  await setUp(page, '#/Episode%2003', { [SCRIPT]: example, ...files });
  await expect(page.getByLabel('Dialogue, row 1')).toBeVisible();
}

test('a change file the keeper never folded in (closed first) is folded in by the next to open', async ({ page }) => {
  await open(page, Object.fromEntries([changeFile('Episode 03', 'Ana', example, example.replace(leaf, 'Ana’s shot.'), minutesAgo(10))]));
  await expect(page.getByLabel('On screen, row 1')).toHaveValue('Ana’s shot.');
  await expect.poll(() => readFile(page, SCRIPT)).toContain('Ana’s shot.');
});

test('a keeper closed after writing script.md but before its note: the changes aren’t asked about again', async ({ page }) => {
  // Ana then Lee changed the same place; script.md already holds Lee's (the newer), but no note says so.
  const ana = example.replace(leaf, 'Ana’s shot.');
  const lee = ana.replace('Ana’s shot.', 'Lee’s shot.');
  await open(page, Object.fromEntries([
    [SCRIPT, lee],
    changeFile('Episode 03', 'Ana', example, ana, minutesAgo(10)),
    changeFile('Episode 03', 'Lee', ana, lee, minutesAgo(9)),
  ]));
  await expect(page.getByLabel('On screen, row 1')).toHaveValue('Lee’s shot.');
  await page.waitForTimeout(6000); // a 5 s check
  await expect(page.getByRole('heading', { name: /both changed the same place/ })).toHaveCount(0);
  expect(await readFile(page, SCRIPT)).toContain('Lee’s shot.');
});

test('a change file still being written is skipped, and folded in once it is whole', async ({ page }) => {
  await open(page);
  await writeFile(page, 'Episode 03/.studio/changes/20991231T000000000Z_aaaaaa_ana.json', '{"v":1,"id":"aa');
  await page.waitForTimeout(6000); // a 5 s check: nothing breaks
  await expect(page.getByRole('status')).toHaveText('Saved');
  await writeChange(page, 'Episode 03', 'Ana', example, example.replace(leaf, 'Ana’s shot.'));
  await expect(page.getByLabel('On screen, row 1')).toHaveValue('Ana’s shot.', { timeout: 10000 });
});

test('typing not saved when the page closed is kept in the browser and saved next time', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('save-every', '60000'));
  await open(page);
  // Every write fails from here on, as if the folder were gone, so leaving can't save it either.
  await page.evaluate(() => {
    FileSystemFileHandle.prototype.createWritable = () => Promise.reject(new DOMException('Gone', 'NotFoundError'));
  });
  await page.getByLabel('Dialogue, row 1').fill('Typed just before closing.');
  // Kept in the browser a second after typing.
  await expect.poll(() => page.evaluate(() => Object.entries(localStorage).find(([k]) => k.startsWith('unsaved:'))?.[1] ?? '')).toContain('Typed just before closing.');
  await page.reload();
  await expect(page.getByLabel('Dialogue, row 1')).toHaveValue('Typed just before closing.');
  await page.keyboard.press('Control+s');
  await expect(page.getByRole('status')).toHaveText('Saved', { timeout: 10000 });
  await expect.poll(() => readFile(page, SCRIPT)).toContain('Typed just before closing.');
});
