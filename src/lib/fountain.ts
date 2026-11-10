// The script as Fountain (EX-3, mock-up 11), the plain-text screenplay format Trelby, Highland and Fade In open.
// Sections become scene headings; each row's On screen is an action line and its Dialogue is spoken by NARRATOR.
// Files and row numbers are kept as [[notes]], which those apps keep but don't print.
import { frontList, type Script } from './script';

export const SPEAKER = 'NARRATOR';

// `stand`: the version and status for the title page, as print shows them ("v3 · Approved"). `date`: "Nov 10, 2026".
export function toFountain(script: Script, title: string, stand: string, date: string): string {
  const out: string[] = [`Title: ${oneLine(title)}`];
  const authors = frontList(script.front, 'authors');
  if (authors.length) out.push('Credit: Written by', `Author: ${authors.join(', ')}`);
  out.push(`Draft date: ${stand} · ${date}`, '');
  if (script.intro.trim()) out.push(action(script.intro), '');
  let n = 0;
  for (const block of script.blocks) {
    if (block.type === 'section') {
      out.push(`.${oneLine(block.title).toUpperCase()}`, '');
      continue;
    }
    const lines = [`[[Row ${++n}]]${block.note.trim() ? ` [[${oneLine(block.note)}]]` : ''}`];
    if (block.onScreen.trim()) lines[0] += ` ${action(block.onScreen)}`;
    if (block.files.length) lines.push(`[[Files: ${block.files.map(oneLine).join(', ')}]]`);
    out.push(lines.join('\n'), '');
    if (block.dialogue.trim()) out.push(SPEAKER, dialogue(block.dialogue), '');
  }
  return out.join('\n').replace(/\n+$/, '\n');
}

// The app's marks as Fountain's: bold and italic are the same, underline is _x_; the rest become plain text.
export function marks(text: string): string {
  return text
    .replace(/<u>(.+?)<\/u>/gs, '_$1_')
    .replace(/~~(.+?)~~/gs, '$1')
    .replace(/\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)/g, '$1 ($2)')
    .replace(/\$([^$\n]+)\$/g, '$1');
}

// Action lines that Fountain would read as something else (a scene heading, a speaker in capitals, a transition,
// a section or note mark) get "!", which forces them to be action.
function action(text: string): string {
  return marks(text.trim())
    .split('\n')
    .map((line) => (forcedAction(line) ? `!${line}` : line))
    .join('\n');
}

function forcedAction(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  if (/^(INT|EXT|EST|INT\.?\/EXT|I\/E)[ .]/i.test(t)) return true;
  if (/^[.>!@#=~]/.test(t) || /TO:$/.test(t)) return true;
  return /[A-Z]/.test(t) && t === t.toUpperCase(); // all capitals reads as a speaker's name
}

// A blank line would end the dialogue: a line of two spaces keeps the paragraphs together.
function dialogue(text: string): string {
  return marks(text.trim())
    .split('\n')
    .map((line) => (line.trim() ? line : '  '))
    .join('\n');
}

function oneLine(text: string): string {
  return text.replace(/\s*\n\s*/g, ' ').trim();
}
