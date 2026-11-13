import { describe, expect, it } from 'vitest';
import { clock, kindName, previewKind, takeLines, unzipEntry, wordText } from '../../src/lib/preview';
import { docx, makeZip } from '../zip';

describe('previews (AP-19)', () => {
  it('picks the kind of preview from the name', () => {
    expect(previewKind('assets/leaf.JPG')).toBe('image');
    expect(previewKind('scan.tiff')).toBe('tif');
    expect(previewKind('clouds.mov')).toBe('video');
    expect(previewKind('birdsong.wav')).toBe('audio');
    expect(previewKind('storyboard.pdf')).toBe('pdf');
    expect(previewKind('notes.md')).toBe('text');
    expect(previewKind('facts.csv')).toBe('text');
    expect(previewKind('expert-notes.docx')).toBe('word');
    expect(previewKind('end-card.pptx')).toBeNull();
    expect(previewKind('old.doc')).toBeNull();
  });

  it('names kinds with no preview', () => {
    expect(kindName('end-card.pptx')).toBe('PowerPoint');
    expect(kindName('budget.XLSX')).toBe('Excel');
    expect(kindName('logo-pack.zip')).toBe('Zip');
    expect(kindName('model.blend')).toBe('BLEND');
    expect(kindName('README')).toBe('File');
  });

  it('keeps the first three lines with words on them', () => {
    expect(takeLines('﻿One\r\n\r\nTwo  \n   \nThree\nFour')).toEqual({ lines: ['One', 'Two', 'Three'], more: true });
    expect(takeLines('Only\n')).toEqual({ lines: ['Only'], more: false });
  });

  it('reads a file out of a zip, packed or stored', async () => {
    for (const deflate of [true, false]) {
      const zip = new Uint8Array(makeZip({ 'a.txt': 'first', 'b/c.txt': 'second file' }, deflate));
      expect(new TextDecoder().decode(await unzipEntry(zip, 'b/c.txt'))).toBe('second file');
      await expect(unzipEntry(zip, 'missing.txt')).rejects.toThrow();
    }
    await expect(unzipEntry(new Uint8Array(100), 'a.txt')).rejects.toThrow('not a zip');
  });

  it("reads a Word file's paragraphs and entities", async () => {
    const text = await wordText(new Uint8Array(docx(['Notes from Dr. Patel', 'Say &quot;carbon dioxide&quot; &amp; not CO2'])));
    expect(takeLines(text).lines).toEqual(['Notes from Dr. Patel', 'Say "carbon dioxide" & not CO2']);
  });

  it('writes lengths as a clock', () => {
    expect(clock(42.4)).toBe('0:42');
    expect(clock(65)).toBe('1:05');
    expect(clock(3723)).toBe('1:02:03');
    expect(clock(NaN)).toBe('');
  });
});
