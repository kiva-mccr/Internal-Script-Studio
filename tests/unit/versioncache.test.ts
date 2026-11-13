import { describe, expect, it } from 'vitest';
import { listVersions } from '../../src/lib/history';

// A script folder in memory that counts how often each file's text is read.
function script(files: Record<string, string>) {
  const reads: Record<string, number> = {};
  const versions = {
    async *keys() {
      yield* Object.keys(files);
    },
    async getFileHandle(name: string) {
      if (!(name in files)) throw new DOMException('Gone', 'NotFoundError');
      const text = files[name];
      return {
        getFile: async () => ({
          size: text.length,
          lastModified: 1,
          text: async () => ((reads[name] = (reads[name] ?? 0) + 1), text),
        }),
      };
    },
  };
  const dir = { getDirectoryHandle: async () => ({ getDirectoryHandle: async () => versions }) };
  return { dir: dir as unknown as FileSystemDirectoryHandle, reads };
}
const file = (id: string, when: string) =>
  JSON.stringify({ v: 1, id, parents: [], who: 'Sam', when, kind: 'edit', note: '', sha256: '', text: id });

describe('listVersions remembers what it read (HI-3)', () => {
  it('reads each file once, then only new ones', async () => {
    const files: Record<string, string> = {
      '20261109T144100Z_aaaaaaaa.json': file('aaaaaaaa', '2026-11-09T14:41:00Z'),
      '20261109T150000Z_bbbbbbbb.json': file('bbbbbbbb', '2026-11-09T15:00:00Z'),
    };
    const { dir, reads } = script(files);
    expect((await listVersions(dir)).map((v) => v.id)).toEqual(['aaaaaaaa', 'bbbbbbbb']);
    expect((await listVersions(dir)).map((v) => v.id)).toEqual(['aaaaaaaa', 'bbbbbbbb']);
    files['20261109T160000Z_cccccccc.json'] = file('cccccccc', '2026-11-09T16:00:00Z');
    expect((await listVersions(dir)).map((v) => v.id)).toEqual(['aaaaaaaa', 'bbbbbbbb', 'cccccccc']);
    expect(reads).toEqual({ '20261109T144100Z_aaaaaaaa.json': 1, '20261109T150000Z_bbbbbbbb.json': 1, '20261109T160000Z_cccccccc.json': 1 });
  });

  it('reads a half-synced file again until it is whole', async () => {
    const name = '20261109T144100Z_aaaaaaaa.json';
    const files: Record<string, string> = { [name]: '{"v": 1, "id": "aaa' };
    const { dir, reads } = script(files);
    expect(await listVersions(dir)).toEqual([]);
    files[name] = file('aaaaaaaa', '2026-11-09T14:41:00Z');
    expect((await listVersions(dir)).map((v) => v.id)).toEqual(['aaaaaaaa']);
    expect(reads[name]).toBe(2);
  });

  it('leaves out a file that is gone', async () => {
    const files: Record<string, string> = { '20261109T144100Z_aaaaaaaa.json': file('aaaaaaaa', '2026-11-09T14:41:00Z') };
    const { dir } = script(files);
    await listVersions(dir);
    delete files['20261109T144100Z_aaaaaaaa.json'];
    expect(await listVersions(dir)).toEqual([]);
  });
});
