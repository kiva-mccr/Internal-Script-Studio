import { describe, expect, it } from 'vitest';
import example from '../../docs/example/Episode 03 - How Photosynthesis Works/script.md?raw';
import type { Version } from '../../src/lib/history';
import { parseScript } from '../../src/lib/script';
import { names, sinceVisit, visitKey } from '../../src/lib/visit';

const version = (id: string, parent: string, who: string, when: string, text: string, kind: Version['kind'] = 'edit'): Version => ({
  v: 1, id, parents: parent ? [parent] : [], who, when, kind, note: '', sha256: '', text,
});
const leaf = example.replace('Slow push-in on a sunlit leaf.', 'Wide shot of a leaf.');
const sugar = leaf.replace('They turn it into sugar', 'They make sugar');
const gone = sugar.replace(/## 2 <!-- id: p8x2m -->[\s\S]*?(?=# Inside)/, '');

describe('sinceVisit', () => {
  const start = version('a', '', 'Sam', '2026-11-10T09:00:00Z', example);
  it("marks other people's changes since the visit, with who made them", () => {
    const versions = [start, version('b', 'a', 'Ana', '2026-11-11T10:00:00Z', leaf), version('c', 'b', 'Jo', '2026-11-11T11:00:00Z', gone)];
    const visit = sinceVisit(versions, parseScript(gone), '2026-11-10T12:00:00Z', 'Sam')!;
    expect([...visit.changed.keys()]).toEqual(['k3f9a', 'b6n0w']);
    expect(visit.changed.get('k3f9a')?.onScreen).toContain('Slow push-in');
    expect(visit.by.get('k3f9a')).toEqual({ who: 'Ana', when: '2026-11-11T10:00:00Z' });
    expect(visit.by.get('b6n0w')?.who).toBe('Jo');
    expect(visit.removed.map((r) => [r.after, r.row.id])).toEqual([['k3f9a', 'p8x2m']]);
    expect(visit.by.get('p8x2m')?.who).toBe('Jo');
  });
  it('leaves out your own changes, also when yours came last', () => {
    const versions = [start, version('b', 'a', 'Ana', '2026-11-11T10:00:00Z', leaf), version('c', 'b', 'Sam', '2026-11-11T11:00:00Z', sugar.replace('Wide shot of a leaf.', 'Wide shot.'))];
    const visit = sinceVisit(versions, parseScript(versions[2].text), '2026-11-10T12:00:00Z', 'Sam');
    expect(visit).toBeNull();
  });
  it('shows nothing on a first visit or with nothing new', () => {
    const versions = [start, version('b', 'a', 'Ana', '2026-11-11T10:00:00Z', leaf)];
    expect(sinceVisit(versions, parseScript(leaf), '', 'Sam')).toBeNull();
    expect(sinceVisit(versions, parseScript(leaf), '2026-11-12T00:00:00Z', 'Sam')).toBeNull();
    expect(sinceVisit(versions, parseScript(leaf), '2026-11-01T00:00:00Z', 'Sam')).toBeNull(); // before History began
  });
  it('credits a merge to the saves it joins', () => {
    const versions = [start, version('b', 'a', 'Ana', '2026-11-11T10:00:00Z', leaf), version('m', 'b', 'Sam', '2026-11-11T11:00:00Z', sugar, 'merge')];
    const visit = sinceVisit(versions, parseScript(sugar), '2026-11-10T12:00:00Z', 'Sam')!;
    expect([...visit.changed.keys()]).toEqual(['k3f9a']); // row 4 is in no version but the merge: left out
  });
});

describe('names and visitKey', () => {
  it('reads like a sentence', () => {
    expect(names(['Ana'])).toBe('Ana');
    expect(names(['Ana', 'Jo', 'Ana'])).toBe('Ana and Jo');
    expect(names(['Ana', 'Jo', 'Kim'])).toBe('Ana, Jo and Kim');
    expect(visitKey('Video Scripts', ['Episode 3'])).toBe('visit:Video Scripts/Episode 3');
  });
});
