// Copy details (AP-41): what went wrong behind a message, kept so the small copy icon beside it can copy it.

import { versionLabel, type Version } from './version';

interface Problem { doing: string; error: unknown; at: Date }

// Keyed by the message shown, so a screen keeps its message as plain text and the icon looks the details up.
const problems = new Map<string, Problem>();
let folderName = '';

/** Remembers why `message` is shown and returns it: `error = problem("… couldn't be read …", 'reading History', e)`. */
export function problem(message: string, doing: string, error?: unknown): string {
  problems.set(message, { doing, error, at: new Date() });
  return message;
}

/** Whether `message` came from `problem` (hints such as "Give it a name first." didn't, so get no icon). */
export function hasProblem(message: string): boolean {
  return problems.has(message);
}

/** The open folder's name, for the details (its name only, never its full path). */
export function setFolderName(name: string) {
  folderName = name;
}

/** The browser's own words: "NotReadableError: The requested file could not be read…". */
export function errorText(e: unknown): string {
  if (e instanceof Error) return `${e.name}: ${e.message}`;
  return e === undefined ? '' : String(e);
}

/** "Edge 131 on Windows", from the browser's user agent. */
export function browserName(ua: string): string {
  const match = (re: RegExp, name: string) => { const m = re.exec(ua); return m ? `${name} ${m[1]}` : ''; };
  const brand = match(/Edg\/(\d+)/, 'Edge') || match(/Chrome\/(\d+)/, 'Chrome') || match(/Firefox\/(\d+)/, 'Firefox')
    || match(/Version\/(\d+).*Safari/, 'Safari') || 'Unknown browser';
  const os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS'
    : /Mac OS X/.test(ua) ? 'macOS' : /CrOS/.test(ua) ? 'ChromeOS' : /Linux/.test(ua) ? 'Linux' : '';
  return os ? `${brand} on ${os}` : brand;
}

/** The plain text the icon copies: the message, then what the app was doing, the error, where, version, browser. */
export function problemDetails(message: string, env: { page: string; version: Version | null; ua: string }): string {
  const p = problems.get(message);
  const lines = [message, ''];
  if (p?.doing) lines.push(`While: ${p.doing}`);
  const error = errorText(p?.error);
  if (error) lines.push(`Error: ${error}`);
  if (folderName) lines.push(`Folder: ${folderName}`);
  lines.push(`Page: ${safeDecode(env.page) || '#/'}`);
  lines.push(`App: P2P Script Studio, ${env.version ? `${versionLabel(env.version)} (${env.version.title})` : 'dev build'}`);
  lines.push(`Browser: ${browserName(env.ua)}`);
  const at = p?.at ?? new Date();
  lines.push(`Time: ${at.toISOString()}`);
  return lines.join('\n');
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}
