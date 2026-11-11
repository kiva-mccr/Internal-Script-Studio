import { describe, expect, it } from 'vitest';
import { opensReview, parseRoute, routeHash, shareLink } from '../../src/lib/route';

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

describe('shared links (RV-10)', () => {
  it('end in ?review, which opens Review and is not part of the path', () => {
    const link = shareLink('https://example.com/app/#/Season%201/Episode%2003');
    expect(link).toBe('https://example.com/app/#/Season%201/Episode%2003?review');
    const hash = new URL(link).hash;
    expect(opensReview(hash)).toBe(true);
    expect(parseRoute(hash)).toEqual(['Season 1', 'Episode 03']);
  });
  it('are not marked twice', () => {
    expect(shareLink('https://example.com/#/Leaves?review')).toBe('https://example.com/#/Leaves?review');
  });
  it('a plain link opens Write', () => {
    expect(opensReview('#/Leaves')).toBe(false);
  });
});
