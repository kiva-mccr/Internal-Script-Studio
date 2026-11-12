import { describe, expect, it } from 'vitest';
import { parseMerge, versionLabel, versionTip } from '../../src/lib/version';

describe('the live version', () => {
  it('reads a merge commit', () => {
    const v = parseMerge('Merge pull request #62 from kiva-mccr/claude/x\n\nStart cue and clean-up for takes (AU-4)\n', '2026-11-12T14:20:00Z');
    expect(v).toEqual({ pr: 62, title: 'Start cue and clean-up for takes (AU-4)', at: '2026-11-12T14:20:00Z' });
    expect(versionLabel(v)).toBe('PR #62');
  });

  it('reads a squash merge', () => {
    expect(parseMerge('Show the live version (#63)', 'x')).toEqual({ pr: 63, title: 'Show the live version', at: 'x' });
  });

  it('gives none for an ordinary commit, shown as dev', () => {
    expect(parseMerge('Fix a typo', 'x')).toBeNull();
    expect(versionLabel(null)).toBe('dev');
  });

  it('says the title and when it went live on hover', () => {
    const tip = versionTip({ pr: 62, title: 'Start cue', at: '2026-11-12T14:20:00Z' }, 'en-GB');
    expect(tip).toMatch(/^Start cue · live since 12 Nov, \d\d:20$/);
  });
});
