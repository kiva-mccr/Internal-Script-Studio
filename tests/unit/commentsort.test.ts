import { describe, expect, it } from 'vitest';
import { threads, type Note } from '../../src/lib/comments';
import { heading, sortThreads, toSort } from '../../src/lib/commentsort';
import type { Row } from '../../src/lib/script';

const row = (id: string, dialogue: string, onScreen = ''): Row => ({ type: 'row', id, dialogue, onScreen, files: [] }) as unknown as Row;
const rows = [row('r1', 'Every leaf is a tiny kitchen.', 'A sunlit leaf.'), row('r2', 'It needs sunlight and water.')];
const note = (id: string, kind: Note['kind'], min: string, extra: Partial<Note>): Note => ({
  v: 1, id, kind, who: 'Ana', when: `2026-11-09T14:${min}:00Z`, ...extra,
});
const list = threads([
  note('words2', 'comment', '00', { row: 'r2', field: 'dialogue', quote: 'water', text: 'x' }),
  note('screen1', 'comment', '01', { row: 'r1', field: 'on_screen', quote: 'sunlit', text: 'x' }),
  note('gone', 'comment', '02', { row: 'deleted', field: 'dialogue', quote: 'old', text: 'x' }),
  note('late1', 'comment', '03', { row: 'r1', field: 'dialogue', quote: 'kitchen', text: 'x' }),
  note('whole2', 'comment', '04', { row: 'r2', field: 'dialogue', quote: '', text: 'x' }),
  note('early1', 'suggestion', '05', { row: 'r1', field: 'dialogue', quote: 'Every', replace: 'Each' }),
  note('whole1', 'comment', '06', { row: 'r1', text: 'x' }),
]);
const ids = (how: 'line' | 'time' | 'type') => sortThreads(list, how, rows).map((t) => t.comment.id);

describe('sortThreads (RV-16)', () => {
  it('in line order: by row, the whole row first, then by column and place in the text, deleted rows last', () => {
    expect(ids('line')).toEqual(['whole1', 'early1', 'late1', 'screen1', 'whole2', 'words2', 'gone']);
  });
  it('by time: newest first', () => {
    expect(ids('time')).toEqual(['whole1', 'early1', 'whole2', 'late1', 'gone', 'screen1', 'words2']);
  });
  it('by type: suggestions, comments on words, comments on a whole row, each in line order, with headings', () => {
    const sorted = sortThreads(list, 'type', rows);
    expect(sorted.map((t) => t.comment.id)).toEqual(['early1', 'late1', 'screen1', 'words2', 'gone', 'whole1', 'whole2']);
    expect(sorted.map((_, i) => heading(sorted, i, 'type'))).toEqual(['Suggestions · 1', 'On words · 4', '', '', '', 'On a whole row · 2', '']);
    expect(heading(sorted, 0, 'line')).toBe('');
  });
  it('reads a remembered choice, Line when there is none', () => {
    expect([toSort(''), toSort('time'), toSort('type'), toSort('odd')]).toEqual(['line', 'time', 'type', 'line']);
  });
});
