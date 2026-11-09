import { describe, expect, it } from 'vitest';
import { canOpenFolders, cleanName } from '../../src/lib/remember';

describe('cleanName', () => {
  it('trims and squeezes spaces', () => {
    expect(cleanName('  Sam   Lee ')).toBe('Sam Lee');
  });
});

describe('canOpenFolders', () => {
  it('needs the folder picker', () => {
    expect(canOpenFolders({ showDirectoryPicker: () => {} })).toBe(true);
    expect(canOpenFolders({})).toBe(false);
  });
});
