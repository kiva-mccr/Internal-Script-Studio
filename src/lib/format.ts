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
