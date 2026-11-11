import { describe, expect, it } from 'vitest';
import { plan } from '../../src/lib/play.svelte';
import type { Script } from '../../src/lib/script';

const row = (id: string, dialogue: string) => ({ type: 'row' as const, id, dialogue, onScreen: '', files: [], note: '' });
const take = (seconds: number) => ({ by: 'Sam', at: 0, seconds, text: '' });
const script: Script = {
  front: null, intro: '',
  blocks: [row('a', 'one two three'), { type: 'section', title: 'Next', note: '' }, row('b', 'one two three four five'), row('c', ''), row('d', '')],
};

describe('plan', () => {
  it('plays the rows in order, each starting where the last one ends', () => {
    expect(plan(script, { a: take(4), d: take(1.5) }, 150)).toEqual([
      { id: 'a', seconds: 4, take: true, start: 0 },
      { id: 'b', seconds: 2, take: false, start: 4 }, // no take: five words at 150 a minute
      { id: 'd', seconds: 1.5, take: true, start: 6 }, // a take with no dialogue still plays
    ]);
  });
  it('skips a row with no take and no dialogue', () => {
    expect(plan(script, {}, 150).map((s) => s.id)).toEqual(['a', 'b']);
  });
});
