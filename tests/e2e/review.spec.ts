import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { listFiles, readFile, setUp, writeFile } from './folder';

const example = readFileSync('docs/example/Episode 03 - How Photosynthesis Works/script.md', 'utf8');
const SCRIPT = 'Episode 03/script.md';
const COMMENTS = 'Episode 03/.studio/comments';

async function openReview(page: Page, files: Record<string, string> = {}) {
  await setUp(page, '#/Episode%2003', { [SCRIPT]: example, ...files });
  await expect(page.getByLabel('Dialogue, row 1')).toBeVisible();
  await page.getByRole('button', { name: /^Review/ }).click();
}

// Selects `text` inside a cell, as a person dragging over it would.
async function selectText(page: Page, cell: string, text: string) {
  await page.getByLabel(cell).evaluate((el, text) => {
    const node = [...el.childNodes].find((n) => n.textContent?.includes(text))!;
    const at = node.textContent!.indexOf(text);
    const range = document.createRange();
    range.setStart(node.firstChild ?? node, at);
    range.setEnd(node.firstChild ?? node, at + text.length);
    getSelection()!.removeAllRanges();
    getSelection()!.addRange(range);
    el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  }, text);
}

test('select text to comment on it; the comment is saved as its own file', async ({ page }) => {
  await openReview(page);
  await selectText(page, 'On screen, row 1', 'sunlit leaf');
  const form = page.getByRole('form', { name: 'New comment' });
  await expect(form).toContainText('Comment on row 1 · On screen');
  await form.getByRole('button', { name: 'Comment' }).click();
  await expect(form.getByRole('alert')).toHaveText('Write a comment first.');
  await form.getByLabel('Comment').fill('Could we shoot a real leaf?');
  await form.getByRole('button', { name: 'Comment' }).click();
  await expect(form).toHaveCount(0);
  const card = page.getByRole('article', { name: 'Comment by Sam' });
  await expect(card).toContainText('Sam commented · row 1');
  await expect(card).toContainText('Could we shoot a real leaf?');
  await expect(page.getByLabel('On screen, row 1').locator('mark')).toHaveText('sunlit leaf');
  await expect(page.getByRole('heading', { name: 'Open · 1' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Review/ })).toContainText('1');
  const [file] = await listFiles(page, COMMENTS);
  expect(JSON.parse(await readFile(page, `${COMMENTS}/${file}`))).toMatchObject({
    kind: 'comment', who: 'Sam', field: 'on_screen', quote: 'sunlit leaf', text: 'Could we shoot a real leaf?',
  });
});

test('comment on a whole row, reply, resolve and reopen', async ({ page }) => {
  await openReview(page);
  await page.getByRole('button', { name: 'Comment on row 3' }).click();
  await page.getByLabel('Comment', { exact: true }).fill('Is this too fast?');
  await page.getByRole('form', { name: 'New comment' }).getByRole('button', { name: 'Comment' }).click();
  const card = page.getByRole('article', { name: 'Comment by Sam' });
  await card.getByRole('button', { name: 'Reply' }).click();
  await card.getByLabel('Reply').fill('A little.');
  await card.getByRole('button', { name: 'Reply' }).click();
  await expect(card).toContainText('A little.');
  await card.getByRole('button', { name: 'Resolve' }).click();
  await expect(page.getByRole('heading', { name: 'Open · 0' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Review/ })).toHaveText('Review');
  await page.getByRole('button', { name: /Resolved · 1/ }).click();
  await card.getByRole('button', { name: 'Reopen' }).click();
  await expect(page.getByRole('heading', { name: 'Open · 1' })).toBeVisible();
  expect(await listFiles(page, COMMENTS)).toHaveLength(4); // comment, reply, resolve, reopen: never edited
});

test('someone else’s comment appears, and one on changed text says so', async ({ page }) => {
  const ana = { v: 1, id: 'ana00000', kind: 'comment', who: 'Ana', when: '2026-11-09T10:00:00Z', row: '', field: 'on_screen', quote: 'a plastic tree', text: 'Real leaf?' };
  const rowId = example.match(/## 1 <!-- id: (\w+) -->/)![1];
  await openReview(page, { [`${COMMENTS}/20261109T100000Z_ana00000.json`]: JSON.stringify({ ...ana, row: rowId }) });
  const card = page.getByRole('article', { name: 'Comment by Ana' });
  await expect(card).toContainText('Ana commented · row 1');
  await expect(card).toContainText('On text that has since changed: “a plastic tree”');
  await writeFile(page, `${COMMENTS}/20261109T100100Z_lee00000.json`,
    JSON.stringify({ ...ana, id: 'lee00000', who: 'Lee', quote: 'sunlit', row: rowId, text: 'Morning light?' }));
  await expect(page.getByRole('article', { name: 'Comment by Lee' })).toBeVisible({ timeout: 10000 });
  await expect(page.getByLabel('On screen, row 1').locator('mark')).toHaveText('sunlit');
});
