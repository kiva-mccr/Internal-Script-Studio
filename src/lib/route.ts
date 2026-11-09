// The script a link points at: everything after "#/", as a path inside the picked folder.
// "#/Episode%2003/" -> ["Episode 03"]. No hash, or "#/", is the script list.

export function parseRoute(hash: string): string[] {
  const path = hash.replace(/^#\/?/, '');
  return path
    .split('/')
    .filter((part) => part !== '')
    .map((part) => decodeURIComponent(part))
    .filter((part) => part !== '.' && part !== '..');
}

export function routeHash(parts: string[]): string {
  return '#/' + parts.map((part) => encodeURIComponent(part)).join('/');
}
