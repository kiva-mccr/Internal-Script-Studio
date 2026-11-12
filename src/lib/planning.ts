// The planning panel's notes (AP-24): plan.md, a plain Markdown file beside script.md (docs/script-format.md).

const PLAN = 'plan.md';

// The plan's text, '' if the script has none yet.
export async function readPlan(dir: FileSystemDirectoryHandle): Promise<string> {
  try {
    return await (await (await dir.getFileHandle(PLAN)).getFile()).text();
  } catch (e) {
    if ((e as DOMException).name === 'NotFoundError') return '';
    throw e;
  }
}

export async function writePlan(dir: FileSystemDirectoryHandle, text: string): Promise<void> {
  const writable = await (await dir.getFileHandle(PLAN, { create: true })).createWritable();
  await writable.write(text);
  await writable.close();
}

// Two people changed the plan at once: yours, then the lines they added that you don't have, so nothing they
// typed is lost. (What they deleted stays; a plan is notes, so that is the safe side.)
export function combinePlans(base: string, mine: string, theirs: string): string {
  if (theirs === base || theirs === mine) return mine;
  if (mine === base) return theirs;
  const known = new Set([...base.split('\n'), ...mine.split('\n')]);
  const added = theirs.split('\n').filter((line) => line.trim() && !known.has(line));
  return added.length ? mine.replace(/\n*$/, '') + '\n\n' + added.join('\n') + '\n' : mine;
}
