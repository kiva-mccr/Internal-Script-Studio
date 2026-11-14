import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { readFile, setUp } from './folder';

const example = readFileSync('docs/example/Episode 03 - How Photosynthesis Works/script.md', 'utf8');
const svg = (fill: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="90"><rect width="160" height="90" fill="${fill}"/></svg>`;
// Row 2 gets a second picture only for the timeline.
const script = example.replace('- assets/icons-ingredients.svg\n', '- assets/icons-ingredients.svg\n- assets/sun.svg (timeline)\n');
const files = {
  'Episode 03/script.md': script,
  'Episode 03/assets/icons-ingredients.svg': svg('#2b67a8'),
  'Episode 03/assets/sun.svg': svg('#b5651d'),
};

const timeline = (page: Page) => page.getByRole('region', { name: 'Timeline' });
const saved = (page: Page) => expect.poll(() => readFile(page, 'Episode 03/script.md'), { timeout: 15000 });

test('the timeline lays out the rows; a click lights up the row and opens its pictures', async ({ page }) => {
  await setUp(page, '#/Episode%2003', files);
  const t = timeline(page);
  await expect(t.getByRole('button', { name: /^Row 1 · / })).toBeVisible();
  await expect(t.getByRole('button', { name: /^Intro ·/ })).toBeVisible();
  // A row with no take shows its read time.
  await expect(t.getByText(/no take · read time/).first()).toBeVisible();
  // Hover shows the dialogue.
  const row2 = t.getByRole('button', { name: /^Row 2 · / });
  await expect(row2).toHaveAccessibleName(/sunlight, water, and carbon dioxide/);
  await expect(row2.getByText('Sequence · 2')).toBeVisible();
  await row2.click();
  await expect(page.locator('.row.lit').getByLabel('Dialogue, row 2')).toBeVisible();
  await expect(t.locator('.panel strong')).toHaveText(/^Row 2 · /);
  await expect(t.getByRole('button', { name: /sun\.svg · timeline only/ })).toHaveAttribute('aria-pressed', 'true');
});

test('pictures: collage, leave one out', async ({ page }) => {
  await setUp(page, '#/Episode%2003', files);
  const t = timeline(page);
  await t.getByRole('button', { name: /^Row 2 · / }).click();
  await t.getByRole('button', { name: 'Collage' }).click();
  await expect(t.getByRole('button', { name: /^Row 2 · / }).getByText('Collage')).toBeVisible();
  await saved(page).toContain('Timeline: collage\n');
  await t.getByRole('button', { name: /icons-ingredients\.svg/ }).click();
  await saved(page).toContain('Timeline: collage, without assets/icons-ingredients.svg\n');
});

test('a file only for the timeline is minimised in Files', async ({ page }) => {
  await setUp(page, '#/Episode%2003', files);
  const cell = page.locator('[data-row="p8x2m"]');
  await expect(cell.getByRole('button', { name: 'sun.svg', exact: true })).toHaveCount(0);
  await cell.getByRole('button', { name: '+1 for the timeline' }).click();
  await expect(cell.getByRole('button', { name: 'sun.svg', exact: true })).toBeVisible();
});

test('holds and placeholders: added from the panel, a bar in the script, changed there, ✕ with Undo', async ({ page }) => {
  await setUp(page, '#/Episode%2003', files);
  const t = timeline(page);
  await t.getByRole('button', { name: /^Row 2 · / }).click();
  await t.getByRole('button', { name: '+ Hold' }).click();
  await expect(t.getByRole('button', { name: /^Hold · 2 s/ })).toBeVisible();
  await saved(page).toContain('Timeline: then hold 2 s\n');
  // The bar in the script opens the same editing.
  const bar = page.getByRole('button', { name: 'Hold after row 2, 2 seconds' });
  await expect(bar).toHaveAttribute('aria-expanded', 'true'); // picked on the timeline, so open here too
  await bar.click();
  await expect(bar).toHaveAttribute('aria-expanded', 'false');
  await bar.click();
  await page.locator('.bar').getByRole('button', { name: 'Longer' }).click();
  await expect(page.getByRole('button', { name: 'Hold after row 2, 2.5 seconds' })).toBeVisible();
  await saved(page).toContain('Timeline: then hold 2.5 s\n');
  // A placeholder after row 4, with its words.
  await t.getByRole('button', { name: /^Row 4 · / }).click();
  await t.getByRole('button', { name: '+ Placeholder' }).click();
  await page.locator('.bar').last().getByLabel(/what goes here/).fill('Drone shot over a field');
  await saved(page).toContain('Timeline: then placeholder 3 s "Drone shot over a field"\n');
  // ✕ removes it at once; Undo puts it back.
  await page.getByRole('button', { name: 'Remove this placeholder' }).click();
  await expect(page.getByRole('button', { name: /^Placeholder after row 4/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByRole('button', { name: /^Placeholder after row 4/ })).toBeVisible();
});

test('the timeline can be hidden, and stays hidden', async ({ page }) => {
  await setUp(page, '#/Episode%2003', files);
  const t = timeline(page);
  await t.getByRole('button', { name: '⌄ Hide' }).click();
  await expect(t.getByRole('button', { name: /^Row 1 · / })).toHaveCount(0);
  // Opening the script again (from the list) keeps it hidden.
  await page.getByRole('link', { name: 'Back to Video Scripts' }).click();
  await page.getByRole('link', { name: /How Photosynthesis Works/ }).click();
  await expect(timeline(page).getByRole('button', { name: '⌃ Show' })).toBeVisible();
});

test('cut on a word: a click on a word starts the next picture there', async ({ page }) => {
  await setUp(page, '#/Episode%2003', files);
  const t = timeline(page);
  await t.getByRole('button', { name: /^Row 2 · / }).click();
  const words = t.getByRole('group', { name: 'Cut on a word' });
  await words.getByRole('button', { name: 'water,' }).click();
  await expect(words.getByRole('button', { name: 'water,' })).toHaveAttribute('aria-pressed', 'true');
  await saved(page).toContain('Timeline: cuts at "water"\n');
  // Two pictures: one cut at most.
  await expect(words.getByRole('button', { name: 'carbon' })).toBeDisabled();
  await words.getByRole('button', { name: 'water,' }).click();
  await saved(page).not.toContain('cuts at');
});

test('playing: the timeline pins to the bottom, the preview follows, a hold plays in silence', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('prompter-speed', '400');
    const wav = () => {
      const rate = 8000, n = rate * 1.5, buf = new DataView(new ArrayBuffer(44 + n * 2));
      const text = (at: number, s: string) => [...s].forEach((c, i) => buf.setUint8(at + i, c.charCodeAt(0)));
      text(0, 'RIFF'); buf.setUint32(4, 36 + n * 2, true); text(8, 'WAVEfmt '); buf.setUint32(16, 16, true);
      buf.setUint16(20, 1, true); buf.setUint16(22, 1, true); buf.setUint32(24, rate, true); buf.setUint32(28, rate * 2, true);
      buf.setUint16(32, 2, true); buf.setUint16(34, 16, true); text(36, 'data'); buf.setUint32(40, n * 2, true);
      for (let i = 0.2 * rate; i < 1.3 * rate; i++) buf.setInt16(44 + i * 2, Math.round(8000 * Math.sin(i / 3)), true);
      return new Blob([buf], { type: 'audio/wav' });
    };
    (window as unknown as { studioRecord: () => Promise<{ stop: () => Promise<Blob> }> }).studioRecord = async () => ({ stop: async () => wav() });
  });
  await setUp(page, '#/Episode%2003', { ...files, 'Episode 03/script.md': script.replace('- assets/music-bed.mp3\n', '- assets/music-bed.mp3\n\nTimeline: then hold 1 s\n') });
  await page.getByRole('button', { name: 'Record row 2', exact: true }).click();
  await page.getByRole('button', { name: 'Stop recording row 2' }).click();
  const t = timeline(page);
  // The take shows as a waveform.
  await expect(t.getByRole('img', { name: /^Take, / })).toBeVisible();
  await page.getByRole('button', { name: 'Play from row 2' }).click();
  await expect(page.locator('.timeline.pinned')).toBeVisible();
  await expect(t.getByRole('img', { name: /^Preview: Row 2/ })).toBeVisible();
  await expect(t.getByRole('img', { name: 'Preview: Hold' })).toBeVisible({ timeout: 10000 });
  await expect(page.locator('.bar.lit')).toBeVisible();
  await t.getByRole('button', { name: 'Make the preview big' }).click();
  await expect(page.locator('.preview.big')).toBeVisible();
  await page.keyboard.press('Escape'); // stops it (if the last rows haven't already)
  await expect(page.locator('.timeline.pinned')).toHaveCount(0);
});
