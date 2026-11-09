import { expect, test, type Page } from '@playwright/test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { listFiles, readFile, setUp, writeFile } from './folder';

const example = readFileSync('docs/example/Episode 03 - How Photosynthesis Works/script.md', 'utf8');
const SCRIPT = 'Episode 03/script.md';
const leaf = 'Slow push-in on a sunlit leaf.';

async function openExample(page: Page, files: Record<string, string> = {}) {
  await setUp(page, '#/Episode%2003', { [SCRIPT]: example, ...files });
}

const version = (id: string, parents: string[], who: string, when: string, text: string) =>
  JSON.stringify({ v: 1, id, parents, who, when, kind: 'edit', note: '', sha256: sha(text), text });
const sha = (text: string) => createHash('sha256').update(text).digest('hex');

test('saves at the same time to different rows are combined without asking', async ({ page }) => {
  await openExample(page);
  await page.getByLabel('Dialogue, row 1').fill('Mine.');
  await writeFile(page, SCRIPT, example.replace('They turn it into sugar', 'Theirs: sugar'));
  await expect(page.getByRole('status')).toHaveText('Saved');
  await expect(page.getByLabel('Dialogue, row 4')).toHaveValue(/Theirs: sugar/);
  const text = await readFile(page, SCRIPT);
  expect(text).toContain('Dialogue:\nMine.\n');
  expect(text).toContain('Theirs: sugar');
});

test('the same field changed by both: pick one side by side, then save', async ({ page }) => {
  await openExample(page);
  await page.getByLabel('On screen, row 1').fill('Mine.');
  await writeFile(page, SCRIPT, example.replace(leaf, 'Theirs.'));
  await expect(page.getByRole('heading', { name: 'Someone else and you both saved at the same time' })).toBeVisible();
  const save = page.getByRole('button', { name: 'Pick one to save' });
  await expect(save).toBeDisabled();
  const row = page.getByRole('region', { name: 'Row 1 · On screen' });
  await row.getByRole('button', { name: /Someone else’s.*Theirs\./ }).click();
  await page.getByRole('button', { name: 'Save combined version' }).click();
  await expect(page.getByLabel('On screen, row 1')).toHaveValue('Theirs.');
  expect(await readFile(page, SCRIPT)).toBe(example.replace(leaf, 'Theirs.'));
  await page.getByRole('button', { name: 'History' }).click();
  await expect(page.getByRole('navigation', { name: 'Versions' }).getByRole('button').first())
    .toContainText('Combined Someone else’s and your changes');
});

test('“… is editing” shows who else has the script open', async ({ page }) => {
  await openExample(page);
  await expect(page.getByLabel('Dialogue, row 1')).toBeVisible();
  await writeFile(page, 'Episode 03/.studio/editing/ana.json',
    JSON.stringify({ v: 1, who: 'Ana', since: new Date().toISOString(), seen: new Date().toISOString(), last_written: '' }));
  await expect(page.getByText('Ana is editing')).toBeVisible({ timeout: 10000 });
  // Your own file is written, and removed when you leave.
  expect(await listFiles(page, 'Episode 03/.studio/editing')).toContain('sam.json');
  await page.getByRole('link', { name: 'Video Scripts' }).click();
  await expect.poll(() => listFiles(page, 'Episode 03/.studio/editing')).toEqual(['ana.json']);
});

test('two newest versions found on opening are combined', async ({ page }) => {
  const base = version('base0000', [], 'Kiva', '2026-11-09T10:00:00Z', example);
  const lees = version('lee00000', ['base0000'], 'Lee', '2026-11-09T10:05:00Z', example.replace(leaf, 'Lee’s shot.'));
  const anas = version('ana00000', ['base0000'], 'Ana', '2026-11-09T10:05:30Z', example.replace(leaf, 'Ana’s shot.').replace('They turn it into sugar', 'Ana: sugar'));
  await openExample(page, {
    [SCRIPT]: example.replace(leaf, 'Ana’s shot.').replace('They turn it into sugar', 'Ana: sugar'),
    'Episode 03/.studio/versions/20261109T100000Z_base0000.json': base,
    'Episode 03/.studio/versions/20261109T100500Z_lee00000.json': lees,
    'Episode 03/.studio/versions/20261109T100530Z_ana00000.json': anas,
  });
  await expect(page.getByRole('heading', { name: 'Lee and Ana both saved at the same time' })).toBeVisible();
  await expect(page.getByText('Also combined: row 4 (only Ana changed it).')).toBeVisible();
  await page.getByRole('button', { name: /Lee’s.*Lee’s shot\./ }).click();
  await page.getByRole('button', { name: 'Save combined version' }).click();
  await expect(page.getByLabel('On screen, row 1')).toHaveValue('Lee’s shot.');
  await expect(page.getByLabel('Dialogue, row 4')).toHaveValue(/Ana: sugar/);
});

test('a copy OneDrive kept beside script.md is combined, then removed', async ({ page }) => {
  await openExample(page, { 'Episode 03/script-LAPTOP-SAM.md': example.replace('They turn it into sugar', 'From the copy') });
  await expect(page.getByLabel('Dialogue, row 4')).toHaveValue(/From the copy/);
  expect(await readFile(page, SCRIPT)).toContain('From the copy');
  await expect.poll(() => listFiles(page, 'Episode 03')).not.toContain('script-LAPTOP-SAM.md');
});

test('a closed laptop’s last save is credited to its owner, not “outside the app”', async ({ page }) => {
  await openExample(page, {
    [SCRIPT]: example.replace(leaf, 'Lee’s change.'),
    'Episode 03/.studio/versions/20261109T100000Z_base0000.json': version('base0000', [], 'Kiva', '2026-11-09T10:00:00Z', example),
    'Episode 03/.studio/editing/lee.json': JSON.stringify({ v: 1, who: 'Lee', since: '2026-11-09T10:00:00Z', seen: '2026-11-09T10:10:00Z', last_written: sha(example.replace(leaf, 'Lee’s change.')) }),
  });
  await page.getByRole('button', { name: 'History' }).click();
  const newest = page.getByRole('navigation', { name: 'Versions' }).getByRole('button').first();
  await expect(newest).toContainText('Edited row 1');
  await expect(newest).toContainText('Lee ·');
});
