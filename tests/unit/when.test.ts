import { describe, expect, it } from 'vitest';
import { ago, at } from '../../src/lib/when';

describe('ago', () => {
  const now = new Date(2026, 10, 9, 15, 0).getTime();
  const min = 60000;
  it('reads like a person would say it', () => {
    expect(ago(now - 10000, now)).toBe('just now');
    expect(ago(now - 12 * min, now)).toBe('12 min ago');
    expect(ago(now - 180 * min, now)).toBe('3 h ago');
    expect(ago(now - 25 * 60 * min, now)).toBe('yesterday');
    expect(ago(now - 4 * 24 * 60 * min, now)).toBe('4 days ago');
    expect(ago(new Date(2026, 9, 28).getTime(), now)).toBe('Oct 28');
    expect(ago(new Date(2025, 9, 28).getTime(), now)).toBe('Oct 28, 2025');
  });
});

describe('at', () => {
  const now = new Date(2026, 10, 9, 15, 0).getTime();
  it('says the day and time', () => {
    expect(at(new Date(2026, 10, 9, 14, 41).getTime(), now)).toBe('Today, 2:41 pm');
    expect(at(new Date(2026, 10, 8, 16, 20).getTime(), now)).toBe('Yesterday, 4:20 pm');
    expect(at(new Date(2026, 10, 6, 9, 12).getTime(), now)).toBe('Nov 6, 9:12 am');
    expect(at(new Date(2025, 10, 6, 9, 12).getTime(), now)).toBe('Nov 6, 2025, 9:12 am');
  });
});
