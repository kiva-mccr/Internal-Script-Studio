import { describe, expect, it } from 'vitest';
import { isCopyOf, safeName } from '../../src/lib/folder';

describe('safeName', () => {
  it('drops characters OneDrive refuses', () => {
    expect(safeName('  Episode 05: Why? / Part 1 ')).toBe('Episode 05 Why Part 1');
    expect(safeName('..hidden')).toBe('hidden');
    expect(safeName('***')).toBe('');
  });
});

describe('isCopyOf', () => {
  it('matches the name addAsset gives a copy, with or without a number', () => {
    expect(isCopyOf('assets/leaf-real.jpg', 'leaf-real.jpg')).toBe(true);
    expect(isCopyOf('assets/leaf-real 2.jpg', 'leaf-real.jpg')).toBe(true);
    expect(isCopyOf('assets/Shot 05 notes.pdf', 'Shot 05: notes.pdf')).toBe(true);
  });
  it('does not match other files, links or words', () => {
    expect(isCopyOf('assets/leaf-real-2.jpg', 'leaf-real.jpg')).toBe(false);
    expect(isCopyOf('assets/leaf-real 2.png', 'leaf-real.jpg')).toBe(false);
    expect(isCopyOf('assets/leaf.jpg', 'leaf-real.jpg')).toBe(false);
    expect(isCopyOf('[leaf-real.jpg](https://example.com/leaf-real.jpg)', 'leaf-real.jpg')).toBe(false);
    expect(isCopyOf('leaf-real.jpg', 'leaf-real.jpg')).toBe(false);
  });
});
