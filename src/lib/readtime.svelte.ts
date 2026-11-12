// Words and speaking time: read time (AP-12) and the teleprompter's speed (EX-2) share one speaking speed.
import { clearMarks } from './format';
import { keep, recall } from './remember';
import { rows, type Block, type Script } from './script';

export const SPEED = 150; // words a minute to start with, a calm speaking speed
const KEY = 'prompter-speed'; // the teleprompter's key from before AP-12, so a speed already set is kept

// The speaking speed in words a minute, set in Settings or the teleprompter and kept in this browser. Kept as
// state, so every time on the page follows a change.
export const speaking = $state({ wpm: speedFrom(recall(KEY)) });

export function speedFrom(text: string): number {
  const n = Math.round(Number(text));
  return n > 0 ? Math.min(400, Math.max(60, n)) : SPEED;
}

// Kept between 60 and 400; something that isn't a number leaves the speed as it was.
export function setSpeed(wpm: number): void {
  if (!(wpm > 0)) return;
  speaking.wpm = speedFrom(String(wpm));
  keep(KEY, String(speaking.wpm));
}

// The words a field reads as, marks taken out (an equation counts as one word).
export function countWords(text: string): number {
  const words = clearMarks(text).trim();
  return words ? words.split(/\s+/).length : 0;
}

// Seconds as "1:42", or "12:05".
export function clock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// The dialogue's words in each section (its rows, up to the next section). Rows before the first section aren't
// in one. On screen and Files don't count: read time is what is spoken.
export function sectionWords(script: Script): Map<Block, number> {
  const words = new Map<Block, number>();
  let section: Block | null = null;
  for (const block of script.blocks) {
    if (block.type === 'section') words.set((section = block), 0);
    else if (section) words.set(section, (words.get(section) ?? 0) + countWords(block.dialogue));
  }
  return words;
}

// The whole script's dialogue words.
export function scriptWords(script: Script): number {
  return rows(script).reduce((sum, row) => sum + countWords(row.dialogue), 0);
}
