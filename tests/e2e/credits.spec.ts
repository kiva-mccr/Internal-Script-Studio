import { expect, test, type Page } from '@playwright/test';
import { listFiles, readFile, setUp } from './folder';

// Credits and contacts (AP-31, board 50): people are kept once for the folder (.studio/people/), and each script's
// credits pick from them with a blurb of its own (the script's front matter).
const PEOPLE = '.studio/people';
const row = '## 1 <!-- id: aaaaa -->\nDialogue:\nHello.\n\nOn screen:\n\nFiles:\n';
const jo = { v: 1, id: 'jo000001', name: 'Jo', role: 'Editor', email: '', linkedin: '', who: 'Kiva', when: '2026-11-10T10:00:00.000Z' };
const FILES = {
  'Trailer/script.md': `---\ntitle: Trailer\nauthors: [Kiva]\n---\n\n${row}`,
  'Water Cycle/script.md': `---\ntitle: The Water Cycle\n---\n\n${row}`,
  [`${PEOPLE}/20261110T100000Z_jo000001_aaaaaaaa.json`]: JSON.stringify(jo),
};
const front = async (page: Page, path: string) => (await readFile(page, path)).split('\n---')[0];

async function openCredits(page: Page) {
  await page.getByRole('button', { name: 'More' }).click();
  await page.getByRole('button', { name: 'Credits' }).click();
  return page.getByRole('dialog', { name: 'Credits' });
}

test('credits pick from the folder, someone new joins it, and contact details are shared by every script', async ({ page }) => {
  await setUp(page, '#/Trailer', FILES);
  await expect(page.getByLabel('Dialogue, row 1')).toBeVisible();
  let box = await openCredits(page);
  await expect(box).toContainText('No credits yet.');
  await expect(box).toContainText('0 people on this script');

  // Someone new: added to the folder and here, and their contact details open.
  await box.getByRole('button', { name: '+ Add a person' }).click();
  await expect(box.getByRole('list', { name: 'People in the folder' }).getByRole('button')).toHaveText([/Jo\s*Editor\s*On 0 scripts/]);
  await box.getByLabel('Someone new').fill('Priya');
  await box.getByRole('button', { name: 'Add to the folder and here' }).click();
  await box.getByLabel('Email').fill('priya@example.org');
  await box.getByLabel('LinkedIn').fill('linkedin.com/in/priya');
  await box.getByRole('button', { name: 'Done', exact: true }).first().click();
  await expect(box.getByText('priya@example.org · linkedin.com/in/priya')).toBeVisible();
  await box.getByLabel('What Priya did on this script').fill('Science reviewer');
  await box.getByLabel('What Priya did on this script').blur();

  // Jo from the folder: their usual role fills the blurb.
  await box.getByRole('button', { name: '+ Add a person' }).click();
  await box.getByLabel('Find').fill('edit');
  await box.getByRole('button', { name: /^Jo/ }).click();
  await expect(box.getByLabel('What Jo did on this script')).toHaveValue('Editor');
  await expect(box).toContainText('2 people on this script');
  await box.locator('.foot').getByRole('button', { name: 'Done' }).click();
  await expect(box).toHaveCount(0);

  await expect.poll(() => front(page, 'Trailer/script.md')).toMatch(
    /credits: \[\{"id":"[a-z0-9]{8}","name":"Priya","role":"Science reviewer"\},\{"id":"jo000001","name":"Jo","role":"Editor"\}\]/);
  // Written once, never edited: Priya's adding, her contact details and her usual role are three new files.
  await expect.poll(async () => (await listFiles(page, PEOPLE)).length).toBe(4);

  // Another script: Priya's usual role (her first blurb) fills in, and her details are the same.
  await page.goto('./#/Water%20Cycle');
  box = await openCredits(page);
  await box.getByRole('button', { name: '+ Add a person' }).click();
  await box.getByRole('button', { name: /^Priya/ }).click();
  await expect(box.getByLabel('What Priya did on this script')).toHaveValue('Science reviewer');
  await expect(box.getByText('priya@example.org · linkedin.com/in/priya')).toBeVisible();
  await box.getByRole('button', { name: 'Remove Priya' }).click();
  await expect(box).toContainText('No credits yet.');
  await page.keyboard.press('Escape');
  await expect(box).toHaveCount(0);
});

test('People on the script list: how to reach everyone, the scripts that credit them, and removing someone no script credits', async ({ page }) => {
  const credited = `---\ntitle: Trailer\ncredits: [{"id":"jo000001","name":"Jo","role":"Cut the trailer"}]\n---\n\n${row}`;
  // Two changes to Lee in one second: the newer (by its time, not its file name) counts.
  const lee = { ...jo, id: 'lee00001', name: 'Lee', role: 'Animator', email: 'lee@example.org', linkedin: 'linkedin.com/in/lee', when: '2026-11-10T10:00:01.500Z' };
  const leeBefore = { ...lee, email: 'old@example.org', when: '2026-11-10T10:00:01.200Z' };
  await setUp(page, '', { ...FILES, 'Trailer/script.md': credited, [`${PEOPLE}/20261110T100001Z_lee00001_00000000.json`]: JSON.stringify(lee),
    [`${PEOPLE}/20261110T100001Z_lee00001_zzzzzzzz.json`]: JSON.stringify(leeBefore) });
  await page.getByRole('button', { name: 'People' }).click();
  const box = page.getByRole('dialog', { name: 'People' });
  await expect(box.locator('.name')).toHaveText([/Jo\s*On 1 script$/, /Lee\s*On 0 scripts/]);
  await expect(box.getByRole('link', { name: 'lee@example.org' })).toHaveAttribute('href', 'mailto:lee@example.org');
  await expect(box.getByRole('link', { name: 'LinkedIn' })).toHaveAttribute('href', 'https://linkedin.com/in/lee');

  // Jo: the script that credits them, and new contact details saved for the whole folder.
  await box.getByRole('button', { name: /^Jo/ }).click();
  await expect(box.getByText('Credited on Trailer')).toBeVisible();
  await expect(box.getByRole('button', { name: 'Remove from the folder' })).toHaveCount(0);
  await box.getByLabel('Email').fill('jo@example.org');
  await box.locator('.contact').getByRole('button', { name: 'Done' }).click();
  await expect(box.getByRole('link', { name: 'jo@example.org' })).toBeVisible();

  // Lee: no script credits them, so they can be taken out.
  await box.getByRole('button', { name: /^Lee/ }).click();
  await box.getByRole('button', { name: 'Remove from the folder' }).click();
  await expect(box.locator('.name')).toHaveText([/Jo/]);
  await box.locator('.foot').getByRole('button', { name: 'Done' }).click();

  await page.getByRole('button', { name: 'People' }).click();
  await expect(box.locator('.name')).toHaveText([/Jo/]);
  await expect(box.getByRole('link', { name: 'jo@example.org' })).toBeVisible();
});

test('the credits print after the rows, go on the screenplay title page, and one switch leaves them out', async ({ page }) => {
  const credited = `---\ntitle: Trailer\ncredits: [{"id":"jo000001","name":"Jo","role":"Cut the trailer"}]\n---\n\n${row}`;
  await setUp(page, '#/Trailer', { ...FILES, 'Trailer/script.md': credited });
  await page.getByRole('button', { name: 'Export / Share' }).click();
  await page.getByRole('button', { name: 'Print…' }).click();
  const preview = page.getByRole('region', { name: 'Preview' });
  await expect(preview.locator('.credits')).toHaveText(/Credits\s*Jo\s*Cut the trailer/);
  const sw = page.getByLabel('Credits after the rows');
  await sw.uncheck();
  await expect(preview.locator('.credits')).toHaveCount(0);
  await page.getByRole('button', { name: 'Fountain (.fountain)' }).click();
  await expect(page.getByLabel('Credits on the title page')).not.toBeChecked();
  await expect(preview.locator('pre')).not.toContainText('Credits:');
  await page.getByLabel('Credits on the title page').check();
  await expect(preview.locator('pre')).toContainText('Credits:\n    Jo, Cut the trailer\n');
});
