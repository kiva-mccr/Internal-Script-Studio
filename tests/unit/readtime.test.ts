import { describe, expect, it } from 'vitest';
import { clock, countWords } from '../../src/lib/readtime';

describe('countWords', () => {
  it('counts the words as they read, without marks', () => {
    expect(countWords('Every **leaf** you have *ever* seen.')).toBe(6);
    expect(countWords('Read [the guide](https://example.com) now')).toBe(4);
    expect(countWords('  ')).toBe(0);
    expect(countWords('one\ntwo  three')).toBe(3);
  });
});

describe('clock', () => {
  it('shows minutes and seconds', () => {
    expect(clock(102)).toBe('1:42');
    expect(clock(5.4)).toBe('0:05');
    expect(clock(725)).toBe('12:05');
    expect(clock(-3)).toBe('0:00');
  });
});
