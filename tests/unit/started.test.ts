import { describe, expect, it } from 'vitest';
import example from '../../docs/example/Episode 03 - How Photosynthesis Works/script.md?raw';
import { parseScript } from '../../src/lib/script';
import { Started } from '../../src/lib/started';

const ROW1 = 'k3f9a';
const ROW2 = 'p8x2m';

describe('Started (AP-38)', () => {
  it("keeps each row's words as they were on opening", () => {
    const started = new Started();
    started.take(parseScript(example));
    expect(started.rows.get(ROW1)).toEqual({ dialogue: 'Every leaf you have ever seen is running a tiny factory.', onScreen: 'Slow push-in on a sunlit leaf.' });
  });

  it("moves a row's words along with someone else's change, field by field", () => {
    const started = new Started();
    started.take(parseScript(example));
    const theirs = example.replace('Slow push-in on a sunlit leaf.', 'Wide shot.');
    started.follow(example, theirs);
    expect(started.rows.get(ROW1)).toEqual({ dialogue: 'Every leaf you have ever seen is running a tiny factory.', onScreen: 'Wide shot.' });
    expect(started.rows.get(ROW2)?.onScreen).toContain('slide in one at a time');
  });

  it('gives a row someone else added their words, and none to a row of your own', () => {
    const started = new Started();
    started.take(parseScript(example));
    const added = example.replace('# Inside the leaf', '## 9 <!-- id: new01 -->\nDialogue:\nAna’s new line.\n\n# Inside the leaf');
    started.follow(example, added);
    expect(started.rows.get('new01')).toEqual({ dialogue: 'Ana’s new line.', onScreen: '' });
    expect(started.rows.has('mine1')).toBe(false);
  });
});
