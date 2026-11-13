import { describe, expect, it } from 'vitest';
import {
  emptyRow, frontList, frontValue, paragraphs, parseScript, readFileRef, rows, setFrontValue, withAuthor, writeScript,
} from '../../src/lib/script';

import example from '../../docs/example/Episode 03 - How Photosynthesis Works/script.md?raw';

describe('parseScript and writeScript', () => {
  it('reads the example into sections and rows', () => {
    const script = parseScript(example);
    expect(frontValue(script.front, 'title')).toBe('How Photosynthesis Works');
    expect(script.blocks.filter((b) => b.type === 'section').map((b) => b.type === 'section' && b.title))
      .toEqual(['Intro', 'Inside the leaf', 'Wrap-up']);
    const third = rows(script)[2];
    expect(third.id).toBe('t1q7c');
    expect(third.dialogue).toBe(
      'Inside each cell, tiny parts called chloroplasts catch the light.\n\nThey are packed with chlorophyll, the green that makes leaves look green.',
    );
    expect(third.files).toEqual(['[Chloroplast zoom animation](https://example.com/chloroplast-zoom.mp4)', 'assets/storyboard-p4.pdf', 'assets/cell-micrograph.tif']);
  });

  it('writes the example back exactly', () => {
    expect(writeScript(parseScript(example))).toBe(example);
  });

  it('reads Windows line endings the same', () => {
    expect(parseScript(example.replace(/\n/g, '\r\n'))).toEqual(parseScript(example));
  });

  it('renumbers rows and gives a hand-typed row an id', () => {
    const text = writeScript(parseScript('## 7\nDialogue: Hello\n\n## 3 <!-- id: aaaaa -->\nOn screen:\nA leaf\n'));
    expect(text).toMatch(/^## 1 <!-- id: [a-z0-9]{5} -->\nDialogue:\nHello\n\nOn screen:\n\nFiles:\n\n## 2 <!-- id: aaaaa -->\n/);
  });

  it('keeps a line that looks like a label or heading inside a field', () => {
    const script = parseScript('## 1 <!-- id: aaaaa -->\nDialogue:\n');
    rows(script)[0].dialogue = 'Dialogue: is what the narrator says.\n# not a section';
    const text = writeScript(script);
    expect(text).toContain('\\Dialogue: is what');
    expect(text).toContain('\\# not a section');
    expect(rows(parseScript(text))[0].dialogue).toBe('Dialogue: is what the narrator says.\n# not a section');
  });

  it('keeps text it does not understand', () => {
    const source = 'A note above everything.\n\n## 1 <!-- id: aaaaa -->\nTODO: check timing\n\nDialogue:\nHi\n\nOn screen:\n\nFiles:\n';
    expect(writeScript(parseScript(source))).toBe(source);
  });

  it('reads a script with no front matter and no rows', () => {
    expect(parseScript('')).toEqual({ front: null, intro: '', blocks: [] });
  });

  it('adds a new row with an unused id', () => {
    const script = parseScript(example);
    const row = emptyRow(script);
    expect(rows(script).map((r) => r.id)).not.toContain(row.id);
  });
});

describe('front matter', () => {
  it('reads and sets values', () => {
    expect(frontValue('title: "A: B"\nstatus: draft', 'title')).toBe('A: B');
    expect(setFrontValue('title: X\nstatus: draft', 'status', 'in review')).toBe('title: X\nstatus: in review');
    expect(setFrontValue(null, 'title', 'X')).toBe('title: X');
    expect(frontList('authors: [Kiva, Sam]', 'authors')).toEqual(['Kiva', 'Sam']);
  });
  it('adds a new author once', () => {
    const script = parseScript(example);
    expect(frontList(withAuthor(script, 'Ana').front, 'authors')).toEqual(['Kiva', 'Sam', 'Ana']);
    expect(withAuthor(script, 'Sam')).toBe(script);
  });
});

describe('readFileRef', () => {
  it('tells paths, links and plain words apart', () => {
    expect(readFileRef('assets/leaf closeup.jpg')).toEqual({ kind: 'path', label: 'leaf closeup.jpg', target: 'assets/leaf closeup.jpg' });
    expect(readFileRef('[Zoom](https://x.com/z.mp4)')).toEqual({ kind: 'link', label: 'Zoom', target: 'https://x.com/z.mp4' });
    expect(readFileRef('https://x.com')).toMatchObject({ kind: 'link' });
    expect(readFileRef('Stock shot of a forest (to find)')).toMatchObject({ kind: 'words' });
  });
});

describe('paragraphs (AP-13)', () => {
  it('gives one line per paragraph, dropping blank lines and spaces around them', () => {
    expect(paragraphs('First.\r\n\r\n  Second.  \nThird.\rFourth.\u2029Fifth.\n')).toEqual(['First.', 'Second.', 'Third.', 'Fourth.', 'Fifth.']);
  });

  it('gives one paragraph for one line, and none for blank text', () => {
    expect(paragraphs('Just one line.')).toEqual(['Just one line.']);
    expect(paragraphs(' \n\n ')).toEqual([]);
  });
});
