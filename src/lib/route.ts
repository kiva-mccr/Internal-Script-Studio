// The script a link points at: everything after "#/", as a path inside the picked folder.
// "#/Episode%2003/" -> ["Episode 03"]. No hash, or "#/", is the script list.
// A shared link ends in "?review" (RV-10): it opens the script on the Review tab.

const REVIEW = '?review';

export function parseRoute(hash: string): string[] {
  const path = hash.replace(/^#\/?/, '').split('?')[0];
  return path
    .split('/')
    .filter((part) => part !== '')
    .map((part) => decodeURIComponent(part))
    .filter((part) => part !== '.' && part !== '..');
}

export function routeHash(parts: string[]): string {
  return '#/' + parts.map((part) => encodeURIComponent(part)).join('/');
}

export function opensReview(hash: string): boolean {
  return hash.endsWith(REVIEW);
}

// The link Copy link and Copy for Teams share: this page's address, opening on Review.
export function shareLink(href: string): string {
  const url = new URL(href);
  url.hash = routeHash(parseRoute(url.hash)) + REVIEW;
  return url.href;
}
