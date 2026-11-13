import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { readFile, setUp } from './folder';

const example = readFileSync('docs/example/Episode 03 - How Photosynthesis Works/script.md', 'utf8');

test('lists each script with its title and status', async ({ page }) => {
  await setUp(page, '', {
    'Episode 03/script.md': example,
    'Trailer/script.md': '---\ntitle: Trailer · Season 1\n---\n',
    'Not a script/notes.txt': 'hello',
  });
  const rows = page.locator('a.row');
  await expect(rows).toHaveCount(2);
  await expect(page.getByRole('link', { name: /How Photosynthesis Works.*In review/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Trailer · Season 1\s*Draft/ })).toBeVisible();
  await page.getByRole('link', { name: /How Photosynthesis Works/ }).click();
  await expect(page).toHaveURL(/#\/Episode%2003$/);
  await expect(page.getByLabel('Dialogue, row 1')).toBeVisible();
});

test('a new script opens ready to write, with you as its author', async ({ page }) => {
  await setUp(page);
  await page.getByRole('button', { name: 'New script' }).click();
  await page.getByLabel('Name of the new script').fill('Episode 05: Food Chains');
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page).toHaveURL(/#\/Episode%2005%20Food%20Chains$/);
  await expect(page.getByLabel('Dialogue, row 1')).toHaveValue('');
  const text = await readFile(page, 'Episode 05 Food Chains/script.md');
  expect(text).toContain('title: Episode 05: Food Chains');
  expect(text).toContain('authors: [Sam]');
  await page.getByRole('link', { name: 'Video Scripts' }).click();
  await expect(page.getByRole('link', { name: /Episode 05: Food Chains/ })).toBeVisible();
});

test('a name already used is refused plainly', async ({ page }) => {
  await setUp(page, '', { 'Trailer/script.md': '' });
  await page.getByRole('button', { name: 'New script' }).click();
  await page.getByLabel('Name of the new script').fill('trailer');
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByRole('alert')).toHaveText('There is already a script called "trailer".');
});

test("picking one script's folder says which folder to pick", async ({ page }) => {
  await setUp(page, '', { 'script.md': example });
  await expect(page.getByRole('heading', { name: "This is one script's folder" })).toBeVisible();
});

test('an empty name is refused in the page', async ({ page }) => {
  await setUp(page);
  await page.getByRole('button', { name: 'New script' }).click();
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByRole('alert')).toHaveText('Type a name for the script.');
});

// RV-14: what waits for you, from History and comment files written as other people would.
const json = (o: object) => JSON.stringify({ v: 1, ...o });
const version = (id: string, who: string, note: string, when: string) =>
  json({ id, parents: [], who, when, kind: 'review', note, sha256: '', text: '' });
const comment = (id: string, who: string, kind: string, when: string, about?: string) =>
  json({ id, who, kind, when, text: 'Hi', row: 'r1', field: 'dialogue', quote: '', ...(about ? { about } : {}) });

test('For me shows only the scripts waiting for you, with labels saying why', async ({ page }) => {
  await setUp(page, '', {
    'Ep 03/script.md': '---\ntitle: Ep 03\nstatus: in review\n---\n',
    'Ep 03/.studio/versions/20261109T140000Z_a.json': version('a', 'Ana', 'Sent for review', '2026-11-09T14:00:00Z'),
    'Ep 03/.studio/comments/20261109T141000Z_c.json': comment('c', 'Sam', 'comment', '2026-11-09T14:10:00.000Z'),
    'Ep 03/.studio/comments/20261109T142000Z_d.json': comment('d', 'Ana', 'reply', '2026-11-09T14:20:00.000Z', 'c'),
    'Ep 04/script.md': '---\ntitle: Ep 04\nstatus: draft\n---\n',
    'Ep 04/.studio/versions/20261109T140000Z_b.json': version('b', 'Sam', 'Sent for review', '2026-11-09T14:00:00Z'),
    'Ep 04/.studio/versions/20261109T150000Z_e.json': version('e', 'Ana', 'Sent back to writer', '2026-11-09T15:00:00Z'),
    'Ep 05/script.md': '---\ntitle: Ep 05\nstatus: in review\n---\n',
    'Ep 05/.studio/versions/20261109T140000Z_f.json': version('f', 'Sam', 'Sent for review', '2026-11-09T14:00:00Z'),
    'Ep 06/script.md': '---\ntitle: Ep 06\nstatus: approved\n---\n',
  });
  const rows = page.locator('a.row');
  await expect(rows).toHaveCount(4);
  await expect(page.getByRole('link', { name: /Ep 03\s*Your review\s*1 reply/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Ep 04\s*Sent back to you/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'For me 2' })).toBeVisible();

  await page.getByRole('button', { name: /For me/ }).click();
  await expect(rows).toHaveCount(2);
  await expect(page.getByRole('link', { name: /Ep 05/ })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('button', { name: /For me/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(rows).toHaveCount(2);
  await page.getByRole('button', { name: /^All/ }).click();
  await expect(rows).toHaveCount(4);
});

test('For me with nothing waiting says so, with a way back to all', async ({ page }) => {
  await setUp(page, '', { 'Ep 06/script.md': '---\ntitle: Ep 06\nstatus: approved\n---\n' });
  await page.getByRole('button', { name: /For me/ }).click();
  await expect(page.getByRole('heading', { name: 'Nothing waiting for you' })).toBeVisible();
  await page.getByRole('button', { name: 'Show all 1' }).click();
  await expect(page.locator('a.row')).toHaveCount(1);
});
