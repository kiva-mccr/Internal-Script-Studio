import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { listFiles, readFile, readJsonFiles, setUp } from './folder';

// Files on comments (RV-11, mock-up 25).
const example = readFileSync('docs/example/Episode 03 - How Photosynthesis Works/script.md', 'utf8');
const COMMENTS = 'Episode 03/.studio/comments';
const FILES = 'Episode 03/.studio/files';
// A 1×1 PNG, so the preview is a real image.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

async function openReview(page: Page) {
  await setUp(page, '#/Episode%2003', { 'Episode 03/script.md': example });
  await expect(page.getByLabel('Dialogue, row 1')).toBeVisible();
  await page.getByRole('button', { name: /^Review/ }).click();
}

// Pastes files into a text box, as pasting a screenshot does. `big` makes a file over the 50 MB limit.
async function paste(page: Page, label: string, files: { name: string; text?: string; big?: boolean }[]) {
  await page.getByLabel(label, { exact: true }).evaluate((el, files) => {
    const data = new DataTransfer();
    for (const f of files) data.items.add(new File([f.big ? new ArrayBuffer(51 * 1024 * 1024) : (f.text ?? '')], f.name));
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
  }, files);
}

const notes = (page: Page) => readJsonFiles(page, COMMENTS);

test('attach files to a comment: × takes one off, and they are kept in .studio/files/', async ({ page }) => {
  await openReview(page);
  await page.getByRole('button', { name: 'Comment on row 1' }).click();
  const form = page.getByRole('form', { name: 'New comment' });
  await form.locator('input[type=file]').setInputFiles([
    { name: 'leaf-real.png', mimeType: 'image/png', buffer: PNG },
    { name: 'stock-licence.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 licence') },
    { name: 'spare.txt', mimeType: 'text/plain', buffer: Buffer.from('spare') },
  ]);
  const list = form.getByRole('list', { name: 'Attached files' });
  await expect(list.getByRole('listitem')).toHaveCount(3);
  await form.getByRole('button', { name: 'Remove spare.txt' }).click();
  await expect(list.getByRole('listitem')).toHaveCount(2);
  await form.getByLabel('Comment', { exact: true }).fill('A real leaf, and the licence.');
  await form.getByRole('button', { name: 'Add comment' }).click();
  await expect(form).toHaveCount(0);

  const card = page.getByRole('article', { name: 'Comment by Sam' });
  await expect(card.getByRole('button', { name: 'Open leaf-real.png' }).locator('img')).toBeVisible();
  await expect(card.getByRole('button', { name: 'leaf-real.png · 1 KB' })).toBeVisible();
  await expect(card.getByRole('button', { name: /stock-licence\.pdf/ })).toContainText('1 KB');
  const [comment] = await notes(page);
  expect(comment.files.map((f: { path: string }) => f.path)).toEqual([
    `.studio/files/${comment.id}/leaf-real.png`, `.studio/files/${comment.id}/stock-licence.pdf`,
  ]);
  expect(await listFiles(page, `${FILES}/${comment.id}`)).toEqual(['leaf-real.png', 'stock-licence.pdf']);
  expect(await readFile(page, `${FILES}/${comment.id}/stock-licence.pdf`)).toBe('%PDF-1.4 licence');

  // Clicking opens it in a new tab (window.open watched, as the new tab's address can't be read with noopener).
  await page.evaluate(() => (window.open = (url?: string | URL) => ((document.body.dataset.opened = String(url)), null)));
  await card.getByRole('button', { name: /stock-licence\.pdf/ }).click();
  await expect(page.locator('body')).toHaveAttribute('data-opened', /^blob:/);
});

test('a comment can be only files; a reply takes a pasted screenshot; too big a file is refused', async ({ page }) => {
  await openReview(page);
  await page.getByRole('button', { name: 'Comment on row 2' }).click();
  await paste(page, 'Comment', [{ name: 'pilot-cut.mov', big: true }]);
  const form = page.getByRole('form', { name: 'New comment' });
  await expect(form.getByRole('alert')).toHaveText(
    'pilot-cut.mov is too big to attach (51 MB; the limit is 50 MB). Put it somewhere shared and paste its link in the comment instead.',
  );
  await paste(page, 'Comment', [{ name: 'notes.txt', text: 'see this' }]);
  await form.getByRole('button', { name: 'Add comment' }).click();
  const card = page.getByRole('article', { name: 'Comment by Sam' });
  // A text file shows its first lines (AP-19), with its name and size under them.
  await expect(card.getByRole('button', { name: 'Open notes.txt' })).toContainText('see this');
  await expect(card.getByRole('button', { name: 'notes.txt · 1 KB' })).toBeVisible();

  await card.getByRole('button', { name: 'Reply' }).click();
  await paste(page, 'Reply', [{ name: 'image.png', text: 'a' }, { name: 'image.png', text: 'b' }]);
  await card.getByRole('button', { name: 'Reply' }).click();
  // Not really pictures (made-up bytes), so no preview: a chip with the size.
  await expect(card.getByRole('button', { name: /image 2\.png/ })).toContainText('1 KB');
  const reply = (await notes(page)).find((n) => n.kind === 'reply');
  expect(reply.text).toBe('');
  expect(await listFiles(page, `${FILES}/${reply.id}`)).toEqual(['image 2.png', 'image.png']);
});

test('a suggestion has no files; editing your comment takes files off and adds new ones', async ({ page }) => {
  await openReview(page);
  await page.getByRole('button', { name: 'Comment on row 1' }).click();
  const form = page.getByRole('form', { name: 'New comment' });
  await paste(page, 'Comment', [{ name: 'first.txt', text: '1' }]);
  await form.getByLabel('Comment', { exact: true }).fill('Have a look.');
  await form.getByRole('button', { name: 'Add comment' }).click();

  const card = page.getByRole('article', { name: 'Comment by Sam' });
  await card.getByRole('button', { name: 'Edit' }).click();
  await card.getByRole('button', { name: 'Remove first.txt' }).click();
  await paste(page, 'Edit comment', [{ name: 'second.txt', text: '2' }]);
  await card.getByRole('button', { name: 'Save' }).click();
  await expect(card.getByTitle('Open second.txt')).toBeVisible();
  await expect(card.getByRole('button', { name: /first\.txt/ })).toHaveCount(0);
  await expect(card).toContainText('edited');
  const all = await notes(page);
  const [comment, edit] = [all.find((n) => n.kind === 'comment'), all.find((n) => n.kind === 'edit')];
  expect(edit.files).toEqual([{ name: 'second.txt', path: `.studio/files/${edit.id}/second.txt`, size: 1 }]);
  expect(await listFiles(page, `${FILES}/${comment.id}`)).toEqual(['first.txt']); // never deleted

  await page.getByRole('button', { name: 'Comment on row 2' }).click();
  await expect(form.getByRole('button', { name: 'Attach file' })).toBeVisible();
  await page.getByLabel('Dialogue, row 2').evaluate((el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    getSelection()!.removeAllRanges();
    getSelection()!.addRange(range);
    el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  });
  await page.getByRole('button', { name: 'Comment on the selected words' }).click();
  await form.getByRole('button', { name: 'Suggest a change' }).click();
  await expect(form.getByRole('button', { name: 'Attach file' })).toHaveCount(0);
});
