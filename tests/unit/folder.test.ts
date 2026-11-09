import { describe, expect, it } from 'vitest';
import { safeName } from '../../src/lib/folder';

describe('safeName', () => {
  it('drops characters OneDrive refuses', () => {
    expect(safeName('  Episode 05: Why? / Part 1 ')).toBe('Episode 05 Why Part 1');
    expect(safeName('..hidden')).toBe('hidden');
    expect(safeName('***')).toBe('');
  });
});
