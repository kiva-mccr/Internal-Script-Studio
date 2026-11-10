import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { readFile, setUp } from './folder';

const example = readFileSync('docs/example/Episode 03 - How Photosynthesis Works/script.md', 'utf8');
const SCRIPT = 'Episode 03/script.md';

async function openExample(page: Page) {
  await setUp(page, '#/Episode%2003', { [SCRIPT]: example });
  await expect(page.getByLabel('Dialogue, row 1')).toBeVisible();
}

// Selects `text` in a Write cell, as a person would.
async function select(page: Page, label: string, text: string) {
  const box = page.getByLabel(label);
  await box.click();
  await box.evaluate((el: HTMLTextAreaElement, text) => {
    const at = el.value.indexOf(text);
    el.setSelectionRange(at, at + text.length);
    el.dispatchEvent(new Event('select'));
  }, text);
}

test('select text, then Bold: saved as marks, shown as bold when not typing', async ({ page }) => {
  await openExample(page);
  await select(page, 'Dialogue, row 1', 'tiny factory');
  const bar = page.getByRole('toolbar', { name: 'Formatting' });
  await bar.getByRole('button', { name: 'Bold' }).click();
  await expect(page.getByLabel('Dialogue, row 1')).toHaveValue('Every leaf you have ever seen is running a **tiny factory**.');
  await page.keyboard.press('Control+i'); // still selected: italic on top
  await expect(page.getByLabel('Dialogue, row 1')).toHaveValue('Every leaf you have ever seen is running a ***tiny factory***.');
  await page.keyboard.press('Control+z'); // the browser's own undo
  await expect(page.getByLabel('Dialogue, row 1')).toHaveValue('Every leaf you have ever seen is running a **tiny factory**.');
  await page.getByLabel('On screen, row 1').click(); // away from the cell
  await expect(bar).toHaveCount(0);
  await expect(page.locator('strong', { hasText: 'tiny factory' })).toBeVisible();
  await expect(page.getByRole('status')).toHaveText('Saved');
  expect(await readFile(page, SCRIPT)).toContain('running a **tiny factory**.');
});

test('a link selects the address to type; Clear takes the marks out', async ({ page }) => {
  await openExample(page);
  await select(page, 'Dialogue, row 1', 'tiny factory');
  await page.getByRole('toolbar').getByRole('button', { name: 'Link' }).click();
  await page.keyboard.type('https://example.com/leaves');
  await expect(page.getByLabel('Dialogue, row 1')).toHaveValue(/\[tiny factory\]\(https:\/\/example\.com\/leaves\)/);
  await page.getByLabel('On screen, row 1').click();
  await expect(page.locator('a', { hasText: 'tiny factory' })).toHaveAttribute('href', 'https://example.com/leaves');
  await select(page, 'Dialogue, row 1', 'running a [tiny factory](https://example.com/leaves)');
  await page.getByRole('button', { name: 'Clear formatting' }).click();
  await expect(page.getByLabel('Dialogue, row 1')).toHaveValue('Every leaf you have ever seen is running a tiny factory.');
});

test('an equation is shown with LaTeX, in Write and in Review', async ({ page }) => {
  await openExample(page);
  await page.getByLabel('On screen, row 4').fill('Glucose: $C_6H_{12}O_6$');
  await page.getByLabel('Dialogue, row 1').click();
  await expect(page.locator('.katex').first()).toBeVisible();
  await page.getByRole('button', { name: /^Review/ }).click();
  await expect(page.getByLabel('On screen, row 4').locator('.katex')).toBeVisible();
  await expect(page.getByLabel('On screen, row 1')).toContainText('Slow push-in');
});
