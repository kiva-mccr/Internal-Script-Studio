// Find and replace in a script (AP-32, board 44). It matches the text as it reads (marks taken out), in section
// titles, Dialogue, On screen, and the words of Images & files lines (notes, link names), never a file's name or a
// link's address. Equations are left out (they show as maths, not as their source).
import { readFileRef, type Block } from './script';

export type Field = 'title' | 'dialogue' | 'onScreen' | 'files';
type Options = { matchCase: boolean; wholeWords: boolean };
// One match: where (block, field, and the Files line), and its place in the text as it reads ([start, end)).
export type Spot = { block: number; field: Field; line: number; start: number; end: number };

const ORDER: Field[] = ['title', 'dialogue', 'onScreen', 'files'];

// The marks, as `toHtml` in format.ts reads them (same patterns, same order of preference).
const PATTERNS: { re: RegExp; inner: number; skip?: boolean }[] = [
  { re: /\*\*(.+?)\*\*(?!\*)/s, inner: 2 },
  { re: /~~(.+?)~~/s, inner: 2 },
  { re: /<u>(.+?)<\/u>/s, inner: 3 },
  { re: /\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)/, inner: 1 },
  { re: /\$([^$\n]+)\$/, inner: 1, skip: true },
  { re: /\*([^*\n]+)\*/, inner: 1 },
];

// A field's text as it reads, and for each of its characters where it sits in the raw text (`at`).
export function visible(raw: string): { text: string; at: number[] } {
  const out = { text: '', at: [] as number[] };
  walk(raw, 0, out);
  return out;
}

function walk(raw: string, base: number, out: { text: string; at: number[] }) {
  let rest = raw;
  let offset = base;
  const plain = (s: string, from: number) => {
    out.text += s;
    for (let i = 0; i < s.length; i++) out.at.push(from + i);
  };
  for (;;) {
    let best: { m: RegExpExecArray; p: (typeof PATTERNS)[number] } | null = null;
    for (const p of PATTERNS) {
      const m = p.re.exec(rest);
      if (m && (!best || m.index < best.m.index)) best = { m, p };
    }
    if (!best) return plain(rest, offset);
    const { m, p } = best;
    plain(rest.slice(0, m.index), offset);
    if (!p.skip) walk(m[1], offset + m.index + p.inner, out);
    offset += m.index + m[0].length;
    rest = rest.slice(m.index + m[0].length);
  }
}

// The searchable text of one Files line, and where it starts in the line: plain words, or a link's name.
function fileWords(line: string): { text: string; from: number } | null {
  const ref = readFileRef(line);
  if (ref.kind === 'words') return { text: line, from: 0 };
  if (ref.kind === 'link' && line.startsWith('[') && line[1] !== ']') return { text: ref.label, from: 1 };
  return null;
}

function pattern(query: string, options: Options): RegExp {
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const body = options.wholeWords ? `(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])` : escaped;
  return new RegExp(body, options.matchCase ? 'gu' : 'giu');
}

function matches(text: string, re: RegExp): [number, number][] {
  return [...text.matchAll(re)].filter((m) => m[0]).map((m) => [m.index!, m.index! + m[0].length]);
}

// Every match in the script, in reading order: block by block, then title, Dialogue, On screen, Files.
export function findAll(blocks: Block[], query: string, options: Options): Spot[] {
  if (!query) return [];
  const re = pattern(query, options);
  const spots: Spot[] = [];
  const add = (block: number, field: Field, line: number, text: string) => {
    for (const [start, end] of matches(text, re)) spots.push({ block, field, line, start, end });
  };
  blocks.forEach((b, i) => {
    if (b.type === 'section') return add(i, 'title', 0, b.title);
    add(i, 'dialogue', 0, visible(b.dialogue).text);
    add(i, 'onScreen', 0, visible(b.onScreen).text);
    b.files.forEach((line, j) => {
      const words = fileWords(line);
      if (words) add(i, 'files', j, words.text);
    });
  });
  return spots;
}

// a before b, in reading order.
export function before(a: Spot, b: Spot): boolean {
  const ka = [a.block, ORDER.indexOf(a.field), a.line, a.start];
  const kb = [b.block, ORDER.indexOf(b.field), b.line, b.start];
  for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return ka[i] < kb[i];
  return false;
}

// The replacement as it goes in: unless Match case is on, it takes the capitals of what it replaces (all capitals,
// or a first capital). It never takes capitals away, so a name typed with a capital keeps it.
export function fitCase(found: string, typed: string, matchCase: boolean): string {
  if (matchCase || !typed) return typed;
  const letters = found.replace(/[^\p{L}]/gu, '');
  if (letters.length > 1 && letters === letters.toUpperCase() && letters !== letters.toLowerCase()) return typed.toUpperCase();
  const first = found.match(/\p{L}/u)?.[0];
  if (first && first !== first.toLowerCase()) return typed.replace(/\p{L}/u, (c) => c.toUpperCase());
  return typed;
}

// A field's raw text with the match at [start, end) (as it reads) replaced. Marks inside the match are kept: in
// front of the new words or after them, whichever leaves the rest of the field reading the same.
export function replaceRaw(raw: string, start: number, end: number, words: string): string {
  const { text, at } = visible(raw);
  const from = at[start];
  const to = at[end - 1] + 1;
  const inside = new Set(at.slice(start, end));
  let marks = '';
  for (let i = from; i < to; i++) if (!inside.has(i)) marks += raw[i];
  const head = raw.slice(0, from);
  const tail = raw.slice(to);
  if (!marks) return head + words + tail;
  const want = text.slice(0, start) + words + text.slice(end);
  const tries = [head + marks + words + tail, head + words + marks + tail];
  return tries.find((t) => visible(t).text === want) ?? tries[1];
}

// The text a spot sits in, as it reads.
function spotText(blocks: Block[], spot: Spot): string {
  const b = blocks[spot.block];
  if (b.type === 'section') return b.title;
  if (spot.field === 'files') return fileWords(b.files[spot.line])?.text ?? '';
  return visible(spot.field === 'dialogue' ? b.dialogue : b.onScreen).text;
}

// Replaces one match in place (the blocks are changed). Returns the replacement as it went in.
export function replaceOne(blocks: Block[], spot: Spot, typed: string, matchCase: boolean): string {
  const b = blocks[spot.block];
  const words = fitCase(spotText(blocks, spot).slice(spot.start, spot.end), typed, matchCase);
  if (b.type === 'section') {
    b.title = b.title.slice(0, spot.start) + words + b.title.slice(spot.end);
  } else if (spot.field === 'files') {
    const line = b.files[spot.line];
    const from = fileWords(line)!.from;
    b.files[spot.line] = line.slice(0, from + spot.start) + words + line.slice(from + spot.end);
  } else {
    const key = spot.field === 'dialogue' ? 'dialogue' : 'onScreen';
    b[key] = replaceRaw(b[key], spot.start, spot.end, words);
  }
  return words;
}

// Replaces every match, last first so the places of the others hold. Returns how many, and in how many blocks.
export function replaceAll(blocks: Block[], query: string, typed: string, options: Options): { count: number; blocks: number } {
  const spots = findAll(blocks, query, options);
  for (const spot of [...spots].reverse()) replaceOne(blocks, spot, typed, options.matchCase);
  return { count: spots.length, blocks: new Set(spots.map((s) => s.block)).size };
}

// A DOM range for [start, end) of an element's text, leaving out equations (`.math`), as `visible` does.
export function rangeAt(el: HTMLElement, start: number, end: number): Range | null {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => (node.parentElement?.closest('.math') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  const range = document.createRange();
  let seen = 0;
  let started = false;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const len = node.textContent!.length;
    if (!started && start < seen + len) (range.setStart(node, start - seen), (started = true));
    if (started && end <= seen + len) {
      range.setEnd(node, end - seen);
      return range;
    }
    seen += len;
  }
  return null;
}
