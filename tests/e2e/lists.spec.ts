import { expect, test, type Locator, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { readFile, setUp } from './folder';

// Numbered lists renumber themselves (AP-29), in the planning panel and in the script's cells.
const example = readFileSync('docs/example/Episode 03 - How Photosynthesis Works/script.md', 'utf8');

async function openExample(page: Page) {
  await setUp(page, '#/Episode%2003', { 'Episode 03/script.md': example });
  await expect(page.getByLabel('Dialogue, row 1')).toBeVisible();
}

// Puts the caret just after `text` in a box, as a click there would.
async function caretAfter(box: Locator, text: string) {
  await box.evaluate((el: HTMLTextAreaElement, text) => {
    const at = el.value.indexOf(text) + text.length;
    el.setSelectionRange(at, at);
  }, text);
}

test('the planning panel renumbers on Enter, Delete, paste and Backspace, and Ctrl+Z goes back', async ({ page }) => {
  await openExample(page);
  await page.getByRole('button', { name: 'Open planning' }).click();
  const notes = page.getByLabel('Planning notes');
  await notes.fill('Outline\n1. Hook\n2. Ingredients\n3. Inside the leaf\n4. Payoff');

  // Enter between lines: the lines below move down.
  await caretAfter(notes, 'Ingredients');
  await notes.press('Enter');
  await notes.pressSequentially('Water');
  await expect(notes).toHaveValue('Outline\n1. Hook\n2. Ingredients\n3. Water\n4. Inside the leaf\n5. Payoff');

  // Enter mid-line splits it into two steps.
  await caretAfter(notes, 'Inside');
  await notes.press('Enter');
  await expect(notes).toHaveValue('Outline\n1. Hook\n2. Ingredients\n3. Water\n4. Inside\n5. the leaf\n6. Payoff');

  // Deleting a line closes the gap.
  await notes.evaluate((el: HTMLTextAreaElement) => {
    const at = el.value.indexOf('2. Ingredients\n');
    el.setSelectionRange(at, at + '2. Ingredients\n'.length);
  });
  await notes.press('Delete');
  await expect(notes).toHaveValue('Outline\n1. Hook\n2. Water\n3. Inside\n4. the leaf\n5. Payoff');
  // Ctrl+Z puts the numbers back, then the line.
  await notes.press('Control+z');
  await notes.press('Control+z');
  await expect(notes).toHaveValue('Outline\n1. Hook\n2. Ingredients\n3. Water\n4. Inside\n5. the leaf\n6. Payoff');

  // Lines put in (as a paste does) count the list again.
  await caretAfter(notes, 'Outline\n');
  await page.keyboard.insertText('9. Title card\n');
  await expect(notes).toHaveValue('Outline\n9. Title card\n10. Hook\n11. Ingredients\n12. Water\n13. Inside\n14. the leaf\n15. Payoff');

  // Backspace just after a number takes it off; the list after it keeps counting from its own first line.
  await caretAfter(notes, '11. ');
  await notes.press('Backspace');
  await expect(notes).toHaveValue('Outline\n9. Title card\n10. Hook\nIngredients\n12. Water\n13. Inside\n14. the leaf\n15. Payoff');
  await expect.poll(() => readFile(page, 'Episode 03/plan.md').catch(() => ''), { timeout: 10000 }).toContain('10. Hook\nIngredients\n12. Water');
});

test('a list typed by hand in a cell carries on with Enter and renumbers, with no list buttons', async ({ page }) => {
  await openExample(page);
  const cell = page.getByLabel('Dialogue, row 1');
  await cell.fill('Every plant needs:\n1. sunlight,\n2. water,\n3. and carbon dioxide.');
  await expect(page.getByRole('button', { name: 'Numbered list' })).toHaveCount(0);
  await caretAfter(cell, 'sunlight,');
  await cell.press('Enter');
  await cell.pressSequentially('warmth,');
  await expect(cell).toHaveValue('Every plant needs:\n1. sunlight,\n2. warmth,\n3. water,\n4. and carbon dioxide.');
  // Enter on the empty step ends the list.
  await caretAfter(cell, 'carbon dioxide.');
  await cell.press('Enter');
  await cell.press('Enter');
  await expect(cell).toHaveValue('Every plant needs:\n1. sunlight,\n2. warmth,\n3. water,\n4. and carbon dioxide.\n');
  await expect.poll(() => readFile(page, 'Episode 03/script.md'), { timeout: 10000 }).toContain('2. warmth,\n3. water,');
});
