import { describe, expect, it } from 'vitest';
import example from '../../docs/example/Episode 03 - How Photosynthesis Works/script.md?raw';
import { marks, toFountain } from '../../src/lib/fountain';
import { parseScript } from '../../src/lib/script';

describe('toFountain', () => {
  const out = toFountain(parseScript(example), 'How Photosynthesis Works', 'v3 · Approved', 'Nov 10, 2026');
  it('starts with a title page carrying the version', () => {
    expect(out.startsWith('Title: How Photosynthesis Works\nCredit: Written by\nAuthor: Kiva, Sam\nDraft date: v3 · Approved · Nov 10, 2026\n\n')).toBe(true);
  });
  it('makes sections scene headings, On screen action, Dialogue spoken by NARRATOR, files and numbers notes', () => {
    expect(out).toContain('.INTRO\n\n[[Row 1]] Slow push-in on a sunlit leaf.\n[[Files: assets/leaf-closeup.jpg]]\n\nNARRATOR\nEvery leaf');
    expect(out).toContain('.INSIDE THE LEAF\n');
    expect(out).toContain('[[Files: [Chloroplast zoom animation](https://example.com/chloroplast-zoom.mp4), assets/storyboard-p4.pdf]]');
    expect(out.endsWith('\n')).toBe(true);
    expect(out).not.toMatch(/\n\n\n/);
  });
  it('keeps a dialogue of two paragraphs together', () => {
    expect(out).toMatch(/NARRATOR\nInside each cell[^\n]*\n {2}\nThey are packed/);
  });
});

describe('marks', () => {
  it('carries bold, italic and underline; the rest becomes plain', () => {
    expect(marks('**b** *i* <u>u</u> ~~s~~ [w](https://x.org) $E=mc^2$')).toBe('**b** *i* _u_ s w (https://x.org) E=mc^2');
  });
});

describe('forced action', () => {
  it('marks lines Fountain would misread', () => {
    const script = parseScript('# A\n\n## 1 <!-- id: a1 -->\nOn screen: INT. LAB - DAY\nWIDE SHOT\nCut to:\n');
    expect(toFountain(script, 'T', 'Draft', 'Nov 1, 2026')).toContain('[[Row 1]] !INT. LAB - DAY\n!WIDE SHOT\nCut to:');
  });
});
