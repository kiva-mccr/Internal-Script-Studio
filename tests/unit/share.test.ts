import { describe, expect, it } from 'vitest';
import { measure, share, type Facts } from '../../src/lib/share';
import { parseScript } from '../../src/lib/script';

const script = parseScript(`# Intro\n\n## Leaf\nDialogue: ${'word '.repeat(150).trim()}\nOn screen: A leaf.\n\n## Sun\nDialogue: Three **simple** words\n`);
const now = new Date(2026, 10, 11, 12).getTime();
const facts: Facts = {
  title: 'Leaves & <Light>', link: 'https://example.com/#/Leaves', status: 'approved', version: 'v3',
  who: 'Sam', when: new Date(2026, 10, 10, 9).getTime(), open: 2, voice: 1,
};

describe('share', () => {
  it('counts rows and the read-aloud time of the Dialogue', () => {
    expect(measure(script)).toEqual({ rows: 2, seconds: 61.2 });
  });

  it('writes the facts as plain text, one line each', () => {
    expect(share(facts, script, now).text).toBe(
      'Leaves & <Light>\nApproved · v3 · 2 rows · 1:01 read aloud\nLast edited by Sam, Nov 10 · 2 open comments · Voice-over 1 of 2 rows\nhttps://example.com/#/Leaves',
    );
  });

  it('links the title and escapes what people typed in the HTML', () => {
    const { html } = share(facts, script, now);
    expect(html).toContain('<a href="https://example.com/#/Leaves"><b>Leaves &amp; &lt;Light&gt;</b></a>');
    expect(html).toContain('<b>Approved</b> · v3');
    expect(html).toContain('>Open in Script Studio</a>');
  });

  it('leaves out what there is none of', () => {
    const draft = share({ ...facts, status: 'in review', version: '', who: '', when: 0, open: 0, voice: 0 }, script, now);
    expect(draft.text).toBe('Leaves & <Light>\nIn review · 2 rows · 1:01 read aloud\nhttps://example.com/#/Leaves');
    expect(share({ ...facts, who: '', open: 1 }, script, now).text).toContain('Last edited, Nov 10 · 1 open comment');
  });

  it('gives the year for an edit from another year', () => {
    expect(share({ ...facts, when: new Date(2025, 0, 3).getTime() }, script, now).text).toContain('Jan 3, 2025');
  });
});
