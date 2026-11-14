import { describe, expect, it } from 'vitest';
import { parseScript, readFileRef, rows, timelineOnly, markTimelineOnly, writeScript, type Row } from '../../src/lib/script';
import { changeChoices, cutPositions, cutTimes, dialogueWords, estimateWords, layout, picks, pictureFiles, readChoices, shots, writeChoices } from '../../src/lib/timeline';

const source = `# Intro

## 1 <!-- id: aaaaa -->
Dialogue:
It needs sunlight, water, and carbon dioxide.

On screen:
Icons slide in.

Files:
- assets/icon-sun.png
- assets/icon-water.png (timeline)
- assets/icon-co2.png (timeline)
- assets/notes.pdf

Timeline: cuts at "water" "carbon", then hold 2 s

## 2 <!-- id: bbbbb -->
Dialogue:
Inside each cell.

On screen:
Zoom in.

Files:
- assets/cell.png
- assets/chloroplast.jpg (timeline)

Timeline: collage, then placeholder 3 s "Drone shot over a field"
`;

describe('the Timeline line in script.md', () => {
  it('reads and writes back exactly', () => {
    const script = parseScript(source);
    expect(rows(script)[0].timeline).toBe('cuts at "water" "carbon", then hold 2 s');
    expect(writeScript(script)).toBe(source);
  });

  it('is left out of a row that has none', () => {
    const script = parseScript(source);
    rows(script)[0].timeline = '';
    expect(writeScript(script)).not.toContain('Timeline: cuts');
  });

  it('a dialogue line starting with Timeline: is written with a backslash', () => {
    const script = parseScript(source);
    rows(script)[1].dialogue = 'Timeline: the history of leaves.';
    const again = parseScript(writeScript(script));
    expect(rows(again)[1].dialogue).toBe('Timeline: the history of leaves.');
    expect(rows(again)[1].timeline).toBe('collage, then placeholder 3 s "Drone shot over a field"');
  });

  it('marks files only for the timeline, and reads them without the mark', () => {
    expect(timelineOnly('assets/icon-water.png (timeline)')).toBe(true);
    expect(timelineOnly('assets/icon-water.png')).toBe(false);
    expect(markTimelineOnly('assets/a.png')).toBe('assets/a.png (timeline)');
    expect(markTimelineOnly('assets/a.png (timeline)')).toBe('assets/a.png (timeline)');
    expect(readFileRef('assets/icon-water.png (timeline)')).toEqual({ kind: 'path', label: 'icon-water.png', target: 'assets/icon-water.png' });
  });
});

describe('readChoices and writeChoices', () => {
  it('reads every part', () => {
    expect(readChoices('collage, without assets/old.png, cuts at "water" "carbon", then placeholder 3 s "A, b"')).toEqual({
      collage: true, without: ['assets/old.png'], cuts: ['water', 'carbon'], after: { kind: 'placeholder', seconds: 3, label: 'A, b' }, rest: [],
    });
    expect(readChoices('').after).toBeNull();
    expect(readChoices('then hold 1.5s').after).toEqual({ kind: 'hold', seconds: 1.5 });
  });

  it('keeps what it does not understand', () => {
    const c = readChoices('sequence, slow zoom');
    expect(c.rest).toEqual(['slow zoom']);
    expect(writeChoices(c)).toBe('slow zoom');
  });

  it('writes only what differs from the default', () => {
    expect(writeChoices(readChoices('sequence'))).toBe('');
    expect(writeChoices({ collage: false, without: [], cuts: ['say "hi"'], after: { kind: 'hold', seconds: 2.25 }, rest: [] })).toBe('cuts at "say ”hi”", then hold 2.3 s');
  });

  it('changes one choice of a row', () => {
    const row = rows(parseScript(source))[1];
    expect(changeChoices(row, (c) => (c.after = null))).toBe('collage');
  });
});

describe('pictures', () => {
  it('a row shows its image and video files, less the ones left out', () => {
    const row = rows(parseScript(source))[0];
    expect(pictureFiles(row).map((p) => [p.path, p.timelineOnly])).toEqual([
      ['assets/icon-sun.png', false], ['assets/icon-water.png', true], ['assets/icon-co2.png', true],
    ]);
    expect(picks({ ...row, timeline: 'without assets/icon-sun.png' })).toEqual(['assets/icon-water.png', 'assets/icon-co2.png']);
  });

  it('a sequence shares the time equally without word timings', () => {
    const c = readChoices('');
    expect(shots(['a', 'b', 'c', 'd'], 8, c, null).map((s) => [s.start, s.seconds])).toEqual([[0, 2], [2, 2], [4, 2], [6, 2]]);
  });

  it('cuts on a word from the take', () => {
    const words = [{ word: 'It', start: 0 }, { word: 'needs', start: 0.3 }, { word: 'sunlight,', start: 0.8 }, { word: 'water,', start: 1.6 }, { word: 'and', start: 2.2 }, { word: 'carbon', start: 2.5 }, { word: 'dioxide.', start: 3 }];
    expect(cutTimes(['water', 'carbon'], words)).toEqual([1.6, 2.5]);
    const c = readChoices('cuts at "water" "carbon"');
    expect(shots(['sun', 'water', 'co2'], 5, c, words).map((s) => [s.start, +s.seconds.toFixed(3)])).toEqual([[0, 1.6], [1.6, 0.9], [2.5, 2.5]]);
    // One cut for three pictures: the rest share what's left.
    const one = readChoices('cuts at "carbon"');
    expect(shots(['a', 'b', 'c'], 5, one, words).map((s) => s.start)).toEqual([0, 2.5, 3.75]);
  });

  it('estimates when each word is said, by letters, marks left out', () => {
    // Sun (3 letters), and (3), water (5): 11 letters over 6 seconds.
    const words = estimateWords('**Sun** and water', 6);
    expect(words.map((w) => w.word)).toEqual(['Sun', 'and', 'water']);
    expect(words.map((w) => w.start)).toEqual([0, expect.closeTo(18 / 11), expect.closeTo(36 / 11)]);
    expect(dialogueWords('It *needs* light.')).toEqual(['It', 'needs', 'light.']);
  });

  it('a layout cuts on the estimated words without a speech model', () => {
    const script = parseScript(source);
    const { blocks } = layout(script, () => ({ seconds: 5, take: true }));
    const first = blocks[0];
    expect(first.kind === 'row' && first.shots.map((s) => s.path)).toEqual(['assets/icon-sun.png', 'assets/icon-water.png', 'assets/icon-co2.png']);
    // "water" and "carbon" come about halfway and two thirds in.
    const starts = first.kind === 'row' ? first.shots.map((s) => +s.start.toFixed(2)) : [];
    expect(starts[0]).toBe(0);
    expect(starts[1]).toBeGreaterThan(2);
    expect(starts[2]).toBeGreaterThan(starts[1]);
  });

  it('finds the cut words in the dialogue', () => {
    expect(cutPositions(['Water', 'and', 'more', 'water', 'carbon'], ['water', 'water'])).toEqual([0, 3]);
  });
});

describe('layout', () => {
  it('lays out rows, holds and placeholders in time, with sections', () => {
    const script = parseScript(source);
    const length = (row: Row) => (row.id === 'aaaaa' ? { seconds: 5, take: true } : { seconds: 4, take: false });
    const { blocks, lanes, total } = layout(script, length);
    expect(blocks.map((b) => [b.kind, b.start, b.seconds])).toEqual([['row', 0, 5], ['hold', 5, 2], ['row', 7, 4], ['placeholder', 11, 3]]);
    expect(total).toBe(14);
    expect(lanes).toEqual([{ title: 'Intro', start: 0, seconds: 14, first: 'aaaaa' }]);
    const second = blocks[2];
    expect(second.kind === 'row' && second.collage).toBe(true);
    expect(blocks[3].kind !== 'row' && blocks[3].label).toBe('Drone shot over a field');
  });

  it('leaves out a row with no time but keeps its hold', () => {
    const { blocks } = layout(parseScript(source), () => ({ seconds: 0, take: false }));
    expect(blocks.map((b) => b.kind)).toEqual(['hold', 'placeholder']);
  });
});

describe('two saves at once', () => {
  it('combines a Timeline change with a Dialogue change to the same row', async () => {
    const { merge } = await import('../../src/lib/merge');
    const mine = source.replace('then hold 2 s', 'then hold 4 s');
    const theirs = source.replace('Inside each cell.', 'Inside every cell.');
    const merged = merge(source, mine, theirs);
    expect(merged.clashes).toEqual([]);
    const text = merged.text({});
    expect(text).toContain('then hold 4 s');
    expect(text).toContain('Inside every cell.');
  });
});
