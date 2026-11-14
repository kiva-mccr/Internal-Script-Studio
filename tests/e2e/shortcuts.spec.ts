import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { setUp } from './folder';

// Keyboard shortcuts (AP-44, board 65): rows in Write, next and previous comment, and changing the keys in Settings.
const example = readFileSync('docs/example/Episode 03 - How Photosynthesis Works/script.md', 'utf8');
const SCRIPT = 'Episode 03/script.md';
const COMMENTS = 'Episode 03/.studio/comments';
const id = (n: number) => example.match(new RegExp(`## ${n} <!-- id: (\\w+) -->`))![1];
const note = (o: Record<string, string>): [string, string] => [`${COMMENTS}/${o.when.replace(/[-:]/g, '')}_${o.id}.json`, JSON.stringify({ v: 1, ...o })];
const NOTES = [
  note({ id: 'ana00001', kind: 'comment', who: 'Ana', when: '2026-11-10T09:00:00Z', row: id(1), field: 'on_screen', quote: 'sunlit leaf', text: 'Could we shoot a real leaf?' }),
  note({ id: 'ana00002', kind: 'suggestion', who: 'Ana', when: '2026-11-10T09:01:00Z', row: id(3), field: 'dialogue', quote: 'catch', replace: 'absorb' }),
  note({ id: 'ben00001', kind: 'comment', who: 'Ben', when: '2026-11-10T09:02:00Z', row: id(4), field: 'dialogue', quote: '', text: 'Say where the oxygen goes too.' }),
];
const draft = example.replace('status: in review', 'status: draft');

async function open(page: Page, files: [string, string][] = []) {
  await setUp(page, '#/Episode%2003', { [SCRIPT]: draft, ...Object.fromEntries(files) });
  await expect(page.getByLabel('Dialogue, row 1')).toBeVisible();
}

const dialogue = (page: Page, n: number) => page.getByLabel(`Dialogue, row ${n}`, { exact: true });

test('Ctrl+Up and Ctrl+Down go to the row above or below in the same column, past section titles', async ({ page }) => {
  await open(page);
  await dialogue(page, 1).focus();
  await page.keyboard.press('Control+ArrowDown');
  await expect(dialogue(page, 2)).toBeFocused();
  // Row 3 is under the "Inside the leaf" title: the title is skipped.
  await page.keyboard.press('Control+ArrowDown');
  await expect(dialogue(page, 3)).toBeFocused();
  await page.keyboard.press('Control+ArrowUp');
  await expect(dialogue(page, 2)).toBeFocused();
  // The cursor lands at the end of the box.
  expect(await dialogue(page, 2).evaluate((b: HTMLTextAreaElement) => b.selectionStart === b.value.length)).toBe(true);

  await page.getByLabel('On screen, row 1', { exact: true }).focus();
  await page.keyboard.press('Control+ArrowDown');
  await expect(page.getByLabel('On screen, row 2', { exact: true })).toBeFocused();
  // The row buttons' hover text names their key.
  await expect(page.getByRole('button', { name: 'Delete row 1' })).toHaveAttribute('title', 'Delete · Ctrl+Shift+Backspace');
});

test('Ctrl+Shift+Enter adds a row above, Ctrl+Shift+Backspace deletes the row, with Undo', async ({ page }) => {
  await open(page);
  const second = await dialogue(page, 2).inputValue();
  await dialogue(page, 2).focus();
  await page.keyboard.press('Control+Shift+Enter');
  await expect(dialogue(page, 2)).toHaveValue('');
  await expect(dialogue(page, 2)).toBeFocused();
  await expect(dialogue(page, 3)).toHaveValue(second);

  // Deleting the empty row: the cursor goes to the row that took its place.
  await page.keyboard.press('Control+Shift+Backspace');
  await expect(dialogue(page, 2)).toHaveValue(second);
  await expect(dialogue(page, 2)).toBeFocused();
  await page.keyboard.press('Control+Shift+Backspace');
  await expect(page.getByText('Row 2 deleted.')).toBeVisible();
  await expect(dialogue(page, 2)).not.toHaveValue(second);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(dialogue(page, 2)).toHaveValue(second);

  // Ctrl+Enter and Alt+Down (AP-14) still work through the same keys.
  await dialogue(page, 1).focus();
  await page.keyboard.press('Alt+ArrowDown');
  await expect(dialogue(page, 1)).toHaveValue(second);
});

test('Alt+N and Alt+P step through the open comments, in Write and in Review', async ({ page }) => {
  await open(page, NOTES);
  await page.getByRole('button', { name: 'Open comments, 3 open' }).click();
  const panel = page.getByRole('complementary', { name: 'Comments' });
  const active = panel.locator('article.card.active');
  // Even while typing in Write.
  await dialogue(page, 2).focus();
  await page.keyboard.press('Alt+N');
  await expect(active).toHaveAttribute('data-id', 'ana00001');
  await page.keyboard.press('Alt+N');
  await expect(active).toHaveAttribute('data-id', 'ana00002');
  await page.keyboard.press('Alt+P');
  await expect(active).toHaveAttribute('data-id', 'ana00001');
  // Round from the first to the last.
  await page.keyboard.press('Alt+P');
  await expect(active).toHaveAttribute('data-id', 'ben00001');

  await page.getByRole('button', { name: /^Review/ }).click();
  await expect(page.getByRole('button', { name: /^Review/ })).toHaveAttribute('aria-current', 'page');
  const cards = page.locator('[data-tour="review-cards"]');
  await expect(cards.locator('article.card')).toHaveCount(3);
  await page.keyboard.press('Alt+N');
  await expect(cards.locator('article.card.active')).toHaveAttribute('data-id', 'ana00001');
  await page.keyboard.press('Alt+N');
  await expect(cards.locator('article.card.active')).toHaveAttribute('data-id', 'ana00002');
});

test('a key can be changed in Settings, kept in this browser, and reset', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'More' }).click();
  await page.getByRole('button', { name: 'Settings' }).click();
  const settings = page.getByRole('dialog', { name: 'Settings' });
  const key = settings.getByRole('button', { name: /^Row below: / });
  await expect(key).toHaveText('Ctrl+↓');

  await key.click();
  await expect(key).toHaveText('Press keys…');
  // A key already used, or one without Ctrl or Alt, is refused in the page.
  await page.keyboard.press('Alt+N');
  await expect(settings.getByRole('status')).toHaveText('Alt+N is already Next comment. Try another.');
  await page.keyboard.press('J');
  await expect(settings.getByRole('status')).toHaveText('Use Ctrl or Alt with it, so typing still works.');
  await page.keyboard.press('Control+B');
  await expect(settings.getByRole('status')).toHaveText('Ctrl+B is bold. Try another.');
  await page.keyboard.press('Alt+J');
  await expect(key).toHaveText('Alt+J');
  // Esc while changing stops changing, and leaves Settings open.
  await key.click();
  await page.keyboard.press('Escape');
  await expect(key).toHaveText('Alt+J');
  await expect(settings).toBeVisible();
  await settings.getByRole('button', { name: 'Done' }).click();

  await dialogue(page, 1).focus();
  await page.keyboard.press('Control+ArrowDown');
  await expect(dialogue(page, 1)).toBeFocused();
  await page.keyboard.press('Alt+J');
  await expect(dialogue(page, 2)).toBeFocused();

  // Kept after a reload, and Reset brings the default back.
  await page.reload();
  await expect(dialogue(page, 1)).toBeVisible();
  await page.getByRole('button', { name: 'More' }).click();
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(key).toHaveText('Alt+J');
  await settings.getByRole('button', { name: 'Reset Row below' }).click();
  await expect(key).toHaveText('Ctrl+↓');
  await expect(settings.getByRole('button', { name: 'Reset Row below' })).toHaveCount(0);
});
