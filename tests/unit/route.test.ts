import { describe, expect, it } from 'vitest';
import { parseRoute, routeHash } from '../../src/lib/route';

describe('parseRoute', () => {
  it('reads an empty hash as the list', () => {
    expect(parseRoute('')).toEqual([]);
    expect(parseRoute('#/')).toEqual([]);
  });
  it('decodes each part', () => {
    expect(parseRoute('#/Season%201/Episode%2003')).toEqual(['Season 1', 'Episode 03']);
  });
  it('never climbs out of the folder', () => {
    expect(parseRoute('#/../secret/./x')).toEqual(['secret', 'x']);
  });
  it('round-trips with routeHash', () => {
    const parts = ['Episode 03 - How Photosynthesis Works'];
    expect(parseRoute(routeHash(parts))).toEqual(parts);
  });
});
