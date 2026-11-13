import { describe, expect, it } from 'vitest';
import example from '../../docs/example/Episode 03 - How Photosynthesis Works/script.md?raw';
import { threads, type Note } from '../../src/lib/comments';
import type { Version } from '../../src/lib/history';
import { placeComments, stateText } from '../../src/lib/historycomments';

const version = (id: string, parent: string, when: string, text: string): Version => ({
  v: 1, id, parents: parent ? [parent] : [], who: 'Sam', when: `2026-11-09T${when}Z`, kind: 'edit', note: '', sha256: '', text,
});
const note = (id: string, kind: Note['kind'], when: string, extra: Partial<Note> = {}): Note => ({
  v: 1, id, kind, who: 'Ana', when: `2026-11-09T${when}.500Z`, ...extra,
});

const absorb = example.replace('chloroplasts catch the light', 'chloroplasts absorb the light');
const fade = absorb.replace('slide in one at a time', 'fade in one at a time');
const versions = [
  version('one', '', '10:00:00', example),
  version('two', 'one', '11:00:00', absorb),
  version('three', 'two', '12:00:00', fade),
];

describe('placeComments', () => {
  it('puts a comment under the first change to its cell after it, else on the version current when it was made', () => {
    const placed = placeComments(versions, threads([
      note('c', 'comment', '10:30:00', { row: 't1q7c', field: 'dialogue', quote: 'catch', text: 'Absorb?' }),
      note('s', 'suggestion', '10:40:00', { row: 'p8x2m', field: 'on_screen', quote: 'slide in', replace: 'fade in' }),
      note('o', 'comment', '11:30:00', { row: 'k3f9a', field: 'on_screen', quote: '', text: 'Real leaf?' }),
      note('e', 'comment', '09:00:00', { row: 'k3f9a', field: 'dialogue', text: 'Before History' }),
      note('x', 'comment', '10:10:00', { row: 'b6n0w', field: 'dialogue', text: 'Deleted' }),
      note('d', 'delete', '10:11:00', { about: 'x' }),
    ]));
    expect([...placed.get('two')!.changed]).toEqual([['t1q7c:dialogue', [expect.objectContaining({ comment: expect.objectContaining({ id: 'c' }) })]]]);
    // made before "two", but "two" didn't touch row 2's On screen: "three" did
    expect([...placed.get('three')!.changed.keys()]).toEqual(['p8x2m:on_screen']);
    expect(placed.get('two')!.open.map((t) => t.comment.id)).toEqual(['o']);
    expect(placed.get('one')!.open.map((t) => t.comment.id)).toEqual(['e']); // older than every version
    expect(placed.get('one')!.changed.size).toBe(0);
  });

  it('counts a removed row as a change to each of its cells', () => {
    const removed = example.replace(/## 2 <!-- id: p8x2m -->[\s\S]*?(?=# Inside)/, '');
    const placed = placeComments([versions[0], version('gone', 'one', '11:00:00', removed)], threads([
      note('c', 'comment', '10:30:00', { row: 'p8x2m', field: 'files', text: 'Wrong icons' }),
    ]));
    expect([...placed.get('gone')!.changed.keys()]).toEqual(['p8x2m:files']);
  });
});

describe('stateText', () => {
  it('says where a comment or suggestion stands, and who decided', () => {
    const list = threads([
      note('a', 'comment', '10:00:00'),
      note('b', 'comment', '10:01:00'),
      note('s', 'suggestion', '10:02:00', { quote: 'x', replace: 'y' }),
      note('r', 'resolve', '10:03:00', { about: 'b', who: 'Sam' }),
      note('k', 'accept', '10:04:00', { about: 's', who: 'Sam' }),
    ]);
    expect(list.map(stateText)).toEqual(['Accepted by Sam', 'Resolved by Sam', 'Open']);
  });
});
