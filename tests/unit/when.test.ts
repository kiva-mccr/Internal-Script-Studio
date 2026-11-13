import { describe, expect, it } from 'vitest';
import { ago, at, sinceDay } from '../../src/lib/when';

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

describe('sinceDay', () => {
  const now = new Date(2026, 10, 12, 15, 0).getTime(); // a Thursday
  it('says the time today, then the day, then the date', () => {
    expect(sinceDay(new Date(2026, 10, 12, 9, 5).getTime(), now)).toBe('since 9:05 am');
    expect(sinceDay(new Date(2026, 10, 11, 18, 0).getTime(), now)).toBe('since yesterday');
    expect(sinceDay(new Date(2026, 10, 10, 18, 0).getTime(), now)).toBe('since Tuesday');
    expect(sinceDay(new Date(2026, 10, 3).getTime(), now)).toBe('since Nov 3');
    expect(sinceDay(new Date(2025, 10, 3).getTime(), now)).toBe('since Nov 3, 2025');
  });
});
