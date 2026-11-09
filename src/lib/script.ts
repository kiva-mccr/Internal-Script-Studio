// Reads script.md into rows and writes it back (docs/script-format.md). What the format does not describe is kept
// as a note and written back as it was.

export type Row = {
  type: 'row';
  id: string;
  dialogue: string;
  onScreen: string;
  files: string[];
  note: string; // text before the row's first label
};
export type Section = { type: 'section'; title: string; note: string };
export type Block = Row | Section;
export type Script = {
  front: string | null; // the lines between the --- lines, kept as typed
  intro: string; // text before the first section or row
  blocks: Block[];
};

const LABELS = { 'Dialogue:': 'dialogue', 'On screen:': 'onScreen', 'Files:': 'files' } as const;
type Field = (typeof LABELS)[keyof typeof LABELS];
const LABEL = /^(Dialogue:|On screen:|Files:)[ \t]?(.*)$/;
const ESCAPED = /^\\(Dialogue:|On screen:|Files:|#)/;
const ROW = /^## (?!#)/;
const SECTION = /^# (?!#)/;
const ID = /<!--\s*id:\s*([a-z0-9]+)\s*-->/;

export function parseScript(source: string): Script {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  let front: string | null = null;
  let i = 0;
  if (lines[0] === '---') {
    const end = lines.indexOf('---', 1);
    if (end > 0) {
      front = lines.slice(1, end).join('\n');
      i = end + 1;
    }
  }

  const script: Script = { front, intro: '', blocks: [] };
  let text: string[] = []; // lines of the note or field being read
  let block: Block | null = null;
  let field: Field | null = null;

  const flush = () => {
    const value = tidy(text);
    text = [];
    if (!block) script.intro = value;
    else if (block.type === 'section' || field === null) block.note = value;
    else if (field === 'files') block.files = fileLines(value);
    else block[field] = value;
  };

  for (; i < lines.length; i++) {
    const line = lines[i];
    if (ROW.test(line) || SECTION.test(line)) {
      flush();
      field = null;
      block = ROW.test(line)
        ? { type: 'row', id: line.match(ID)?.[1] ?? '', dialogue: '', onScreen: '', files: [], note: '' }
        : { type: 'section', title: line.slice(2).trim(), note: '' };
      script.blocks.push(block);
      continue;
    }
    const label = block?.type === 'row' ? line.match(LABEL) : null;
    if (label) {
      flush();
      field = LABELS[label[1] as keyof typeof LABELS];
      text = label[2] ? [label[2]] : [];
      continue;
    }
    text.push(line.replace(ESCAPED, '$1'));
  }
  flush();
  return script;
}

export function writeScript(script: Script): string {
  const used = new Set(rows(script).map((row) => row.id).filter(Boolean));
  const parts: string[] = [];
  if (script.front !== null) parts.push(`---\n${script.front}\n---`);
  if (script.intro) parts.push(script.intro);
  let n = 0;
  for (const block of script.blocks) {
    if (block.type === 'section') {
      parts.push(`# ${block.title}`);
      if (block.note) parts.push(block.note);
      continue;
    }
    if (!block.id) used.add((block.id = newId(used)));
    const row = [`## ${++n} <!-- id: ${block.id} -->`];
    if (block.note) row.push(block.note + '\n');
    row.push(`Dialogue:\n${escape(block.dialogue)}`.trimEnd() + '\n');
    row.push(`On screen:\n${escape(block.onScreen)}`.trimEnd() + '\n');
    row.push(['Files:', ...block.files.map((file) => `- ${file}`)].join('\n'));
    parts.push(row.join('\n'));
  }
  return parts.join('\n\n') + '\n';
}

export function rows(script: Script): Row[] {
  return script.blocks.filter((block): block is Row => block.type === 'row');
}

export function emptyRow(script: Script): Row {
  return { type: 'row', id: newId(new Set(rows(script).map((row) => row.id))), dialogue: '', onScreen: '', files: [], note: '' };
}

// Five lower-case letters and digits, unique in the script.
export function newId(used: Set<string>): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  for (;;) {
    const id = Array.from(crypto.getRandomValues(new Uint8Array(5)), (b) => chars[b % 36]).join('');
    if (!used.has(id)) return id;
  }
}

// --- Front matter: a few `key: value` lines. Only the keys the app uses are read; the rest stay as typed. ---

export function frontValue(front: string | null, key: string): string {
  const line = (front ?? '').split('\n').find((l) => l.startsWith(key + ':'));
  return line ? unquote(line.slice(key.length + 1).trim()) : '';
}

export function setFrontValue(front: string | null, key: string, value: string): string {
  const lines = front === null || front === '' ? [] : front.split('\n');
  const at = lines.findIndex((l) => l.startsWith(key + ':'));
  const line = `${key}: ${value}`;
  if (at >= 0) lines[at] = line;
  else lines.push(line);
  return lines.join('\n');
}

export function frontList(front: string | null, key: string): string[] {
  const value = frontValue(front, key).replace(/^\[|\]$/g, '');
  return value.split(',').map((v) => unquote(v.trim())).filter(Boolean);
}

// Adds a name to `authors` if it is not there yet.
export function withAuthor(script: Script, name: string): Script {
  const authors = frontList(script.front, 'authors');
  if (!name || authors.includes(name)) return script;
  return { ...script, front: setFrontValue(script.front, 'authors', `[${[...authors, name].join(', ')}]`) };
}

// --- A row's Files lines: a path, a [name](link), or plain words. ---

export type FileRef = { kind: 'path' | 'link' | 'words'; label: string; target: string };

export function readFileRef(line: string): FileRef {
  const link = line.match(/^\[([^\]]*)\]\((\S+)\)$/);
  if (link) return { kind: 'link', label: link[1] || link[2], target: link[2] };
  if (/^https?:\/\//.test(line)) return { kind: 'link', label: line, target: line };
  if (/^[^\s]+\.[A-Za-z0-9]{1,5}$/.test(line) || line.startsWith('assets/')) {
    return { kind: 'path', label: line.split('/').at(-1)!, target: line };
  }
  return { kind: 'words', label: line, target: '' };
}

function fileLines(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.replace(/^\s*[-*]\s+/, '').trim())
    .filter(Boolean);
}

// A line in a field that would read as a label or a heading gets a backslash in front.
function escape(text: string): string {
  return text.replace(/^(Dialogue:|On screen:|Files:|#)/gm, '\\$1');
}

// Drops blank lines at both ends.
function tidy(lines: string[]): string {
  return lines.join('\n').replace(/^\s*\n/, '').replace(/\s+$/, '');
}

function unquote(value: string): string {
  return value.replace(/^(["'])(.*)\1$/, '$2');
}
