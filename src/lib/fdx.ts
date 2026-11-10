// The script as Final Draft (EX-4): the .fdx XML that Final Draft, Fade In, WriterDuet and Highland open.
// Laid out as Fountain is (EX-3): sections become scene headings, each row's On screen is action and its Dialogue
// is spoken by NARRATOR. The row number, its note and its files go in a General paragraph above the row, since
// Final Draft's own notes are pinned to character positions and easy to get wrong.
import { SPEAKER } from './fountain';
import { frontList, type Script } from './script';

// `stand`: the version and status ("v3 · Approved"). `date`: "Nov 10, 2026". Both go on the title page.
export function toFdx(script: Script, title: string, stand: string, date: string): string {
  const body: string[] = [];
  if (script.intro.trim()) body.push(...paragraphs('Action', script.intro));
  let n = 0;
  for (const block of script.blocks) {
    if (block.type === 'section') {
      body.push(paragraph('Scene Heading', runs(oneLine(block.title).toUpperCase())));
      continue;
    }
    const about = [`Row ${++n}`, block.note.trim() && oneLine(block.note), block.files.length && `Files: ${block.files.map(oneLine).join(', ')}`];
    body.push(paragraph('General', runs(about.filter(Boolean).join(' · '))));
    if (block.onScreen.trim()) body.push(...paragraphs('Action', block.onScreen));
    if (block.dialogue.trim()) body.push(paragraph('Character', runs(SPEAKER)), ...paragraphs('Dialogue', block.dialogue));
  }
  const authors = frontList(script.front, 'authors');
  const front = [title.trim() && oneLine(title), authors.length && 'Written by', authors.length && authors.join(', '), '', `${stand} · ${date}`];
  const titlePage = front.map((line) => `<Paragraph Alignment="Center" Type="General">${runs(line || '')}</Paragraph>`);
  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="no" ?>',
    '<FinalDraft DocumentType="Script" Template="No" Version="5">',
    '<Content>', ...body, '</Content>',
    '<TitlePage><Content>', ...titlePage, '</Content></TitlePage>',
    '</FinalDraft>', '',
  ].join('\n');
}

// One paragraph per line of text; blank lines are dropped (Final Draft spaces paragraphs itself).
function paragraphs(type: string, text: string): string[] {
  return text.trim().split('\n').filter((line) => line.trim()).map((line) => paragraph(type, runs(line.trim())));
}

function paragraph(type: string, inner: string): string {
  return `<Paragraph Type="${type}">${inner}</Paragraph>`;
}

// The app's marks as Final Draft's styled runs: **bold**, *italic*, <u>underline</u>. Strike becomes plain text,
// a link "words (address)", and $tex$ its TeX.
export function runs(text: string): string {
  const plain = text
    .replace(/~~(.+?)~~/g, '$1')
    .replace(/\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)/g, '$1 ($2)')
    .replace(/\$([^$\n]+)\$/g, '$1');
  const style = { Bold: false, Italic: false, Underline: false };
  const out: string[] = [];
  for (const part of plain.split(/(\*\*|\*|<u>|<\/u>)/)) {
    if (part === '**') style.Bold = !style.Bold;
    else if (part === '*') style.Italic = !style.Italic;
    else if (part === '<u>' || part === '</u>') style.Underline = part === '<u>';
    else if (part) {
      const on = Object.entries(style).filter(([, v]) => v).map(([k]) => k).join('+');
      out.push(`<Text${on ? ` Style="${on}"` : ''}>${escape(part)}</Text>`);
    }
  }
  return out.join('') || '<Text></Text>';
}

function escape(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function oneLine(text: string): string {
  return text.replace(/\s*\n\s*/g, ' ').trim();
}
