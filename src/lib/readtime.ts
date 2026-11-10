// Words and speaking time: the teleprompter's speed (EX-2) and, later, read time (AP-12).
import { clearMarks } from './format';

export const SPEED = 150; // words a minute to start with, a calm speaking speed

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
