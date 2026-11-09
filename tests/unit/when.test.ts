import { describe, expect, it } from 'vitest';
import { ago } from '../../src/lib/when';

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
