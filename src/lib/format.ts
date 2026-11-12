// Formatting in a field (docs/script-format.md): plain marks in script.md, shown as formatting.
// **bold**, *italic*, <u>underline</u>, ~~strikethrough~~, [link](https://…) and $equation$ (LaTeX).

export type Mark = 'bold' | 'italic' | 'underline' | 'strike' | 'link' | 'equation';

const PATTERNS: [RegExp, (m: RegExpExecArray) => string][] = [
  [/\*\*(.+?)\*\*(?!\*)/s, (m) => `<strong>${toHtml(m[1])}</strong>`],
  [/~~(.+?)~~/s, (m) => `<s>${toHtml(m[1])}</s>`],
  [/<u>(.+?)<\/u>/s, (m) => `<u>${toHtml(m[1])}</u>`],
  [/\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)/, (m) => `<a href="${esc(m[2])}" target="_blank" rel="noopener">${toHtml(m[1])}</a>`],
  [/\$([^$\n]+)\$/, (m) => `<span class="math" data-tex="${esc(m[1])}">${esc(m[1])}</span>`],
  [/\*([^*\n]+)\*/, (m) => `<em>${toHtml(m[1])}</em>`],
];

// The field as HTML: everything else escaped. Equations are placeholders that `renderMath` fills in.
export function toHtml(text: string): string {
  let out = '';
  let rest = text;
  for (;;) {
    let best: { m: RegExpExecArray; make: (m: RegExpExecArray) => string } | null = null;
    for (const [re, make] of PATTERNS) {
      const m = re.exec(rest);
      if (m && (!best || m.index < best.m.index)) best = { m, make };
    }
    if (!best) return out + esc(rest);
    out += esc(rest.slice(0, best.m.index)) + best.make(best.m);
    rest = rest.slice(best.m.index + best.m[0].length);
  }
}

// The text as it reads, marks taken out (what a selection in the formatted text gives).
export function plain(text: string): string {
  const div = document.createElement('div');
  div.innerHTML = toHtml(text);
  return div.textContent ?? '';
}

// Takes every mark out of `text`; a link keeps its words.
export function clearMarks(text: string): string {
  return text
    .replace(/\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)/g, '$1')
    .replace(/<\/?u>/g, '')
    .replace(/\*\*|~~|\$/g, '')
    .replace(/\*/g, '');
}

// A selection [start, end) with a mark put on, or taken off when it already has it. Returns the new text and selection.
export function toggle(text: string, start: number, end: number, mark: Mark): { text: string; start: number; end: number } {
  const sel = text.slice(start, end);
  if (mark === 'link') {
    const before = text.slice(0, start) + `[${sel || 'link'}](`;
    return { text: before + 'https://' + ')' + text.slice(end), start: before.length, end: before.length + 8 };
  }
  const [open, close] = { bold: ['**', '**'], italic: ['*', '*'], underline: ['<u>', '</u>'], strike: ['~~', '~~'], equation: ['$', '$'] }[mark];
  let has = text.slice(start - open.length, start) === open && text.slice(end, end + close.length) === close;
  if (mark === 'bold' || mark === 'italic') {
    // Stars on both sides: 1 or 3 is italic, 2 or 3 is bold.
    const n = Math.min(text.slice(0, start).match(/\**$/)![0].length, text.slice(end).match(/^\**/)![0].length);
    has = mark === 'bold' ? n >= 2 : n === 1 || n === 3;
  }
  if (has) {
    return { text: text.slice(0, start - open.length) + sel + text.slice(end + close.length), start: start - open.length, end: end - open.length };
  }
  return { text: text.slice(0, start) + open + sel + close + text.slice(end), start: start + open.length, end: end + open.length };
}

// Fills in the equations under `el` (KaTeX, loaded the first time one is needed).
export async function renderMath(el: HTMLElement) {
  const spots = [...el.querySelectorAll<HTMLElement>('.math:not([data-done])')];
  if (!spots.length) return;
  const [{ default: katex }] = await Promise.all([import('katex'), import('katex/dist/katex.min.css')]);
  for (const spot of spots) {
    katex.render(spot.dataset.tex ?? '', spot, { throwOnError: false });
    spot.dataset.done = '';
  }
}

// A Range over the first place `quote` reads in `el`'s text, across any formatting; null if it isn't there.
export function rangeOf(el: HTMLElement, quote: string): Range | null {
  const at = (el.textContent ?? '').indexOf(quote);
  if (at < 0 || !quote) return null;
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  let seen = 0;
  let started = false;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const len = node.textContent!.length;
    if (!started && at < seen + len) (range.setStart(node, at - seen), (started = true));
    if (started && at + quote.length <= seen + len) {
      range.setEnd(node, at + quote.length - seen);
      return range;
    }
    seen += len;
  }
  return null;
}

function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Lists in the planning panel (AP-24): plain Markdown line starts, "- " bullets, "1. " numbers and "- [ ] " /
// "- [x] " tick boxes.
export type List = 'bullet' | 'number' | 'tick';
const LIST_START = /^(- \[[ xX]\] |- |\d+\. )/;

// The text as it is shown: a bullet, tick box or number in place of its marks.
export function showLists(text: string): string {
  return text.replace(/^- \[ \] /gm, '☐ ').replace(/^- \[[xX]\] /gm, '☑ ').replace(/^- /gm, '• ');
}

// The lines a selection touches made into a list, or taken out of it if they all are one already. A tick box on a
// line that has one is ticked or unticked instead.
export function toggleList(text: string, start: number, end: number, kind: List): { text: string; start: number; end: number } {
  const from = text.lastIndexOf('\n', start - 1) + 1;
  const next = text.indexOf('\n', end > start && text[end - 1] === '\n' ? end - 1 : end);
  const to = next === -1 ? text.length : next;
  const lines = text.slice(from, to).split('\n');
  const is = (line: string) =>
    kind === 'tick' ? /^- \[[ xX]\] /.test(line) : kind === 'number' ? /^\d+\. /.test(line) : /^- (?!\[[ xX]\] )/.test(line);
  const all = lines.every(is);
  const changed = lines.map((line, i) => {
    if (kind === 'tick' && all) return line.replace(/^- \[([ xX])\] /, (_, mark) => (mark === ' ' ? '- [x] ' : '- [ ] '));
    const bare = line.replace(LIST_START, '');
    if (all) return bare;
    return (kind === 'tick' ? '- [ ] ' : kind === 'number' ? `${i + 1}. ` : '- ') + bare;
  }).join('\n');
  // A selection stays on the lines; a caret goes to the end of its line, ready to type.
  const after = from + changed.length;
  return { text: text.slice(0, from) + changed + text.slice(to), start: start === end ? after : from, end: after };
}

// Enter at the end of a list line starts the next item (an empty item ends the list). Null: an ordinary Enter.
export function continueList(text: string, at: number): { text: string; at: number } | null {
  const from = text.lastIndexOf('\n', at - 1) + 1;
  const line = text.slice(from, at);
  const m = LIST_START.exec(line);
  if (!m || text.slice(at).split('\n')[0].trim()) return null;
  if (line === m[0]) return { text: text.slice(0, from) + text.slice(at), at: from };
  const number = /^(\d+)\. /.exec(m[0]);
  const start = number ? `${Number(number[1]) + 1}. ` : m[0].startsWith('- [') ? '- [ ] ' : '- ';
  return { text: text.slice(0, at) + '\n' + start + text.slice(at), at: at + 1 + start.length };
}
