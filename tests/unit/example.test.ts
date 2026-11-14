import { describe, expect, it } from 'vitest';
import sent from '../../docs/example/Episode 03 - How Photosynthesis Works/script.md?raw';
import { samsVersion } from '../../src/lib/example';
import { parseScript, writeScript } from '../../src/lib/script';

// The example opens on Sam's version (AP-47): docs/example's text with the timeline's lines and a slower zoom.
describe('samsVersion', () => {
  it('adds the timeline lines in the script format, leaving the dialogue as recorded', () => {
    const text = samsVersion(sent);
    expect(writeScript(parseScript(text))).toBe(text);
    expect(text).toContain('Timeline: cuts at "running"');
    expect(text).toContain('Timeline: then hold 2 s');
    expect(text).toContain('- assets/zoom-sketch.svg (timeline)');
    expect(text).toContain('Timeline: then placeholder 3 s "Time-lapse of a seedling growing"');
    const dialogue = (t: string) => parseScript(t).blocks.flatMap((b) => (b.type === 'row' ? [b.dialogue] : []));
    expect(dialogue(text)).toEqual(dialogue(sent));
  });
});
