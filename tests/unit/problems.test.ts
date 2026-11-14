import { describe, expect, it } from 'vitest';
import { browserName, errorText, hasProblem, problem, problemDetails, setFolderName } from '../../src/lib/problems';

const env = { page: '#/Episode%2003', version: { pr: 124, title: 'Copy details on errors', at: '2026-11-14T09:00:00Z' }, ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0' };

describe('problems', () => {
  it('remembers an error behind its message and returns the message', () => {
    expect(problem('History couldn\'t be read.', 'reading History', new DOMException('gone', 'NotFoundError'))).toBe('History couldn\'t be read.');
    expect(hasProblem('History couldn\'t be read.')).toBe(true);
    expect(hasProblem('Give it a name first.')).toBe(false);
  });

  it('copies the message, what was going on, the error, where, the version and the browser', () => {
    setFolderName('Video Scripts');
    problem('The take couldn\'t be deleted.', 'deleting a take', new TypeError('bad'));
    const lines = problemDetails('The take couldn\'t be deleted.', env).split('\n');
    expect(lines.slice(0, 8)).toEqual([
      'The take couldn\'t be deleted.',
      '',
      'While: deleting a take',
      'Error: TypeError: bad',
      'Folder: Video Scripts',
      'Page: #/Episode 03',
      'App: P2P Script Studio, PR #124 (Copy details on errors)',
      'Browser: Edge 131 on Windows',
    ]);
    expect(lines[8]).toMatch(/^Time: \d{4}-\d\d-\d\dT/);
  });

  it('leaves out an error it was not given', () => {
    problem('Speech recognition stopped working.', 'following your voice');
    expect(problemDetails('Speech recognition stopped working.', env)).not.toContain('Error:');
  });

  it('reads the browser from its user agent', () => {
    expect(browserName('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36')).toBe('Chrome 130 on macOS');
    expect(browserName('something odd')).toBe('Unknown browser');
  });

  it('writes errors in the browser\'s words', () => {
    expect(errorText(new DOMException('no', 'NotReadableError'))).toBe('NotReadableError: no');
    expect(errorText('plain')).toBe('plain');
    expect(errorText(undefined)).toBe('');
  });
});
