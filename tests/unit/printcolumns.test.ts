import { describe, expect, it } from 'vitest';
import { readHidden, widths } from '../../src/lib/printcolumns';

const sum = (w: Record<string, number>) => Object.values(w).reduce((a, b) => a + b, 0);

describe('widths', () => {
  it('are the usual widths with every column', () => {
    expect(widths([], false)).toEqual({ num: 4, dialogue: 38, screen: 32, files: 26, notes: 0 });
    expect(widths([], true)).toEqual({ num: 4, dialogue: 29, screen: 23, files: 22, notes: 22 });
  });
  it('give the first hidden column to Dialogue, the next to Notes', () => {
    expect(widths(['files'], true)).toMatchObject({ dialogue: 51, screen: 23, files: 0, notes: 22 });
    expect(widths(['files', 'screen'], true)).toMatchObject({ dialogue: 51, screen: 0, files: 0, notes: 45 });
    expect(widths(['screen', 'files'], true)).toMatchObject({ dialogue: 52, notes: 44 });
  });
  it('give everything to Dialogue with no Notes column', () => {
    expect(widths(['screen', 'files'], false)).toMatchObject({ dialogue: 96 });
    expect(widths(['screen'], false)).toMatchObject({ dialogue: 70, files: 26 });
  });
  it('give Dialogue\'s room to Notes, or else to the first column that prints', () => {
    expect(widths(['dialogue'], true)).toMatchObject({ dialogue: 0, notes: 51 });
    expect(widths(['dialogue'], false)).toMatchObject({ dialogue: 0, screen: 70, files: 26 });
  });
  it('always fill the page', () => {
    for (const notes of [true, false]) for (const hidden of [['dialogue', 'screen'], ['files'], ['dialogue', 'files'], ['screen', 'dialogue']] as const)
      expect(sum(widths([...hidden], notes))).toBe(100);
  });
});

describe('readHidden', () => {
  it('keeps the order, drops anything odd, and one column always prints', () => {
    expect(readHidden('')).toEqual([]);
    expect(readHidden('files,screen')).toEqual(['files', 'screen']);
    expect(readHidden('files,files,notes')).toEqual(['files']);
    expect(readHidden('screen,files,dialogue')).toEqual(['screen', 'files']);
  });
});
