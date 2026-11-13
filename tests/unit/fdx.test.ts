import { describe, expect, it } from 'vitest';
import example from '../../docs/example/Episode 03 - How Photosynthesis Works/script.md?raw';
import { runs, toFdx } from '../../src/lib/fdx';
import { parseScript } from '../../src/lib/script';

describe('toFdx', () => {
  const out = toFdx(parseScript(example), 'How Photosynthesis Works', 'v3 · Approved', 'Nov 10, 2026');
  it('is a Final Draft document, every paragraph closed (the e2e test parses it as XML)', () => {
    expect(out.startsWith('<?xml version="1.0" encoding="UTF-8" standalone="no" ?>\n<FinalDraft DocumentType="Script"')).toBe(true);
    expect(out.endsWith('</FinalDraft>\n')).toBe(true);
    expect(out.match(/<Paragraph /g)?.length).toBe(out.match(/<\/Paragraph>/g)?.length);
  });
  it('makes sections scene headings, the row and its files a General line, On screen action, Dialogue NARRATOR', () => {
    expect(out).toContain([
      '<Paragraph Type="Scene Heading"><Text>INTRO</Text></Paragraph>',
      '<Paragraph Type="General"><Text>Row 1 · Files: assets/leaf-closeup.jpg, assets/leaf-push-in.mp4</Text></Paragraph>',
      '<Paragraph Type="Action"><Text>Slow push-in on a sunlit leaf.</Text></Paragraph>',
      '<Paragraph Type="Character"><Text>NARRATOR</Text></Paragraph>',
      '<Paragraph Type="Dialogue"><Text>Every leaf',
    ].join('\n'));
  });
  it('puts the title, authors, version and date on the title page', () => {
    const page = out.slice(out.indexOf('<TitlePage>'));
    for (const line of ['How Photosynthesis Works', 'Written by', 'Kiva, Sam', 'v3 · Approved · Nov 10, 2026']) {
      expect(page).toContain(`<Paragraph Alignment="Center" Type="General"><Text>${line}</Text></Paragraph>`);
    }
  });
});

describe('settings (EX-9)', () => {
  it('names the speaker, makes sections General lines, and leaves the row line out with numbers and files off', () => {
    const out = toFdx(parseScript(example), 'T', 'Draft', 'Nov 1, 2026', { speaker: 'Host', scenes: false, numbers: false, files: false });
    expect(out).toContain([
      '<Paragraph Type="General"><Text>Intro</Text></Paragraph>',
      '<Paragraph Type="Action"><Text>Slow push-in on a sunlit leaf.</Text></Paragraph>',
      '<Paragraph Type="Character"><Text>HOST</Text></Paragraph>',
    ].join('\n'));
    expect(out).not.toContain('Row 1');
  });
});

describe('runs', () => {
  it('carries bold, italic and underline as styles; the rest becomes plain and escaped', () => {
    expect(runs('a **b *bi*** <u>u</u> ~~s~~ [w](https://x.org) $x<y$ & "q"')).toBe(
      '<Text>a </Text><Text Style="Bold">b </Text><Text Style="Bold+Italic">bi</Text><Text> </Text>' +
      '<Text Style="Underline">u</Text><Text> s w (https://x.org) x&lt;y &amp; &quot;q&quot;</Text>');
  });
});
