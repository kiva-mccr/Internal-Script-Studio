import { describe, expect, it } from 'vitest';
import example from '../../docs/example/Episode 03 - How Photosynthesis Works/script.md?raw';
import { toFdx } from '../../src/lib/fdx';
import { toFountain } from '../../src/lib/fountain';
import { merge } from '../../src/lib/merge';
import { contactLine, linkedinUrl, mergeCredits, readCredits, shownCredits, writeCredits, type Credit } from '../../src/lib/people';
import { parseScript, writeScript } from '../../src/lib/script';
import { share } from '../../src/lib/share';

const kiva: Credit = { id: 'k1', name: 'Kiva', role: 'Writer' };
const sam: Credit = { id: 's1', name: 'Sam', role: 'Narrator' };
const lee: Credit = { id: 'l1', name: 'Lee', role: 'Animated the leaf, and the "chloroplast"' };
const withCredits = (text: string, credits: Credit[]) => {
  const script = parseScript(text);
  script.front = writeCredits(script.front, credits);
  return writeScript(script);
};

describe('credits in the front matter', () => {
  it('are one line of JSON that reads back the same, and the line goes when there are none', () => {
    const front = writeCredits('title: X\nstatus: draft', [kiva, lee])!;
    expect(front.split('\n')).toHaveLength(3);
    expect(front).toContain('credits: [{"id":"k1","name":"Kiva","role":"Writer"},');
    expect(readCredits(front)).toEqual([kiva, lee]);
    expect(writeCredits(front, [])).toBe('title: X\nstatus: draft');
    expect(writeCredits(null, [])).toBeNull();
  });
  it('a line that cannot be read gives no credits, and nameless ones are left out of exports', () => {
    expect(readCredits('credits: [oops')).toEqual([]);
    expect(readCredits('title: X')).toEqual([]);
    expect(shownCredits(writeCredits('', [kiva, { id: 'x', name: ' ', role: '' }]))).toEqual([kiva]);
  });
  it('keep the rest of the script as it was', () => {
    const text = withCredits(example, [kiva]);
    expect(withCredits(text, [])).toBe(example);
  });
});

describe('two saves at once', () => {
  it('takes the side that changed', () => {
    expect(mergeCredits([kiva], [kiva, sam], [kiva])).toEqual([kiva, sam]);
    expect(mergeCredits([kiva], [kiva], [])).toEqual([]);
  });
  it('when both changed, keeps theirs with yours on top', () => {
    // They added Lee; you added Sam and changed Kiva's blurb.
    const mine = [{ ...kiva, role: 'Wrote it' }, sam];
    expect(mergeCredits([kiva], mine, [kiva, lee])).toEqual([{ ...kiva, role: 'Wrote it' }, lee, sam]);
    // You took Kiva out; they added Lee.
    expect(mergeCredits([kiva, sam], [sam], [kiva, sam, lee])).toEqual([sam, lee]);
  });
  it('are combined by lib/merge without a clash', () => {
    const base = withCredits(example, [kiva]);
    const result = merge(base, withCredits(example, [kiva, sam]), withCredits(example, [kiva, lee]));
    expect(result.clashes).toEqual([]);
    expect(readCredits(parseScript(result.text({})).front)).toEqual([kiva, lee, sam]);
  });
});

describe('credits in exports', () => {
  const script = parseScript(example);
  it('Fountain lists them on the title page', () => {
    const out = toFountain(script, 'How Photosynthesis Works', 'Draft', 'Nov 13, 2026', undefined, [kiva, { id: 'x', name: 'Jo', role: '' }]);
    expect(out).toContain('Author: Kiva, Sam\nCredits:\n    Kiva, Writer\n    Jo\nDraft date:');
    expect(toFountain(script, 'T', 'Draft', 'Nov 13, 2026')).not.toContain('Credits:');
  });
  it('Final Draft lists them on the title page', () => {
    const out = toFdx(script, 'T', 'Draft', 'Nov 13, 2026', undefined, [lee]);
    expect(out).toContain('<Text>Credits</Text></Paragraph>\n<Paragraph Alignment="Center" Type="General"><Text>Lee, Animated the leaf, and the &quot;chloroplast&quot;</Text>');
  });
  it('Copy for Teams adds one line of names and blurbs', () => {
    const shared = share({ title: 'T', link: 'https://x.org', status: 'draft', version: '', who: '', when: 0, open: 0, voice: 0 },
      parseScript(withCredits(example, [kiva, sam])));
    expect(shared.text).toContain('\nCredits: Kiva, Writer · Sam, Narrator\n');
    expect(shared.html).toContain('<br>Credits: Kiva, Writer · Sam, Narrator<br>');
  });
});

describe('contact details', () => {
  it('show on one line, and LinkedIn becomes a link', () => {
    expect(contactLine({ email: 'sam@example.org', linkedin: 'linkedin.com/in/sam' })).toBe('sam@example.org · linkedin.com/in/sam');
    expect(contactLine({ email: '', linkedin: '' })).toBe('');
    expect(linkedinUrl('linkedin.com/in/sam')).toBe('https://linkedin.com/in/sam');
    expect(linkedinUrl('https://www.linkedin.com/in/sam')).toBe('https://www.linkedin.com/in/sam');
  });
});
