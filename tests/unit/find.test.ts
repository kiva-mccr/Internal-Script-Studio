import { describe, expect, it } from 'vitest';
import { before, findAll, fitCase, replaceAll, replaceOne, replaceRaw, visible } from '../../src/lib/find';
import type { Block } from '../../src/lib/script';

const row = (id: string, dialogue: string, onScreen = '', files: string[] = []): Block =>
  ({ type: 'row', id, dialogue, onScreen, files, timeline: '', note: '' });
const plain = { matchCase: false, wholeWords: false };

describe('visible', () => {
  it('reads the text without marks, and knows where each letter sits', () => {
    const v = visible('Make **glu**cose and [sugar](https://a.b) $x^2$ *now*');
    expect(v.text).toBe('Make glucose and sugar  now');
    expect(v.at[5]).toBe(7); // the g, after the **
    expect(v.at[8]).toBe(12); // the c, after the closing **
  });
});

describe('findAll', () => {
  const blocks: Block[] = [
    { type: 'section', title: 'Glucose basics', note: '' },
    row('a', 'Leaves make glucose.', 'The word GLUCOSE fades in.', ['glucose-flow.mp4', 'Find a glucose diagram', '[Glucose page](https://x.y/glucose)', 'https://x.y/glucose']),
    row('b', 'Gluco**se** is food; glucoses too.'),
  ];

  it('looks in titles, both text columns and the words of Files lines, never file names or addresses', () => {
    const spots = findAll(blocks, 'glucose', plain);
    expect(spots.map((s) => `${s.block}:${s.field}:${s.line}`)).toEqual([
      '0:title:0', '1:dialogue:0', '1:onScreen:0', '1:files:1', '1:files:2', '2:dialogue:0', '2:dialogue:0',
    ]);
  });

  it('matches across marks in the middle of a word', () => {
    expect(findAll([row('b', 'Gluco**se** is food')], 'glucose', plain)).toEqual([{ block: 0, field: 'dialogue', line: 0, start: 0, end: 7 }]);
  });

  it('keeps to capitals with Match case, and to whole words with Whole words', () => {
    expect(findAll(blocks, 'glucose', { matchCase: true, wholeWords: false })).toHaveLength(3);
    expect(findAll(blocks, 'glucose', { matchCase: false, wholeWords: true })).toHaveLength(6);
  });

  it('finds nothing for nothing, and takes special characters literally', () => {
    expect(findAll(blocks, '', plain)).toEqual([]);
    expect(findAll([row('a', 'Is it (really) 2.5?')], '(really) 2.5?', plain)).toHaveLength(1);
  });

  it('orders spots as they read', () => {
    const [a, b] = findAll(blocks, 'glucose', plain);
    expect(before(a, b)).toBe(true);
    expect(before(b, a)).toBe(false);
  });
});

describe('fitCase', () => {
  it('takes the capitals of what it replaces, unless Match case is on', () => {
    expect(fitCase('glucose', 'sugar', false)).toBe('sugar');
    expect(fitCase('Glucose', 'sugar', false)).toBe('Sugar');
    expect(fitCase('GLUCOSE', 'sugar', false)).toBe('SUGAR');
    expect(fitCase('GLUCOSE', 'sugar', true)).toBe('sugar');
  });
  it('never takes a capital away', () => {
    expect(fitCase('gerald', 'Mira', false)).toBe('Mira');
  });
});

describe('replacing', () => {
  it('keeps marks around and inside the match', () => {
    expect(replaceRaw('Make **glucose** now', 5, 12, 'sugar')).toBe('Make **sugar** now');
    expect(replaceRaw('photo**synthesis**', 0, 14, 'X')).toBe('**X**');
    expect(replaceRaw('**photo**synthesis', 0, 14, 'X')).toBe('**X**');
  });

  it('replaces one match in a link name without touching its address', () => {
    const blocks = [row('a', '', '', ['[Glucose page](https://x.y/glucose)'])];
    const [spot] = findAll(blocks, 'glucose', plain);
    expect(replaceOne(blocks, spot, 'sugar', false)).toBe('Sugar');
    expect((blocks[0] as { files: string[] }).files[0]).toBe('[Sugar page](https://x.y/glucose)');
  });

  it('replaces all, keeping each one\'s capitals, and counts them', () => {
    const blocks: Block[] = [
      { type: 'section', title: 'Glucose', note: '' },
      row('a', 'Make glucose. GLUCOSE!', 'glucose-flow.mp4 shows glucose', ['glucose-flow.mp4']),
    ];
    expect(replaceAll(blocks, 'glucose', 'sugar', plain)).toEqual({ count: 5, blocks: 2 });
    expect(blocks[0]).toMatchObject({ title: 'Sugar' });
    expect(blocks[1]).toMatchObject({ dialogue: 'Make sugar. SUGAR!', onScreen: 'sugar-flow.mp4 shows sugar', files: ['glucose-flow.mp4'] });
  });
});
