// The live version (AP-28): the pull request the site was built from, read from the merge commit at build time.

export interface Version { pr: number; title: string; at: string }

/** "Merge pull request #62 from …" with the PR's title as the body, or a squash merge "Title (#62)". */
export function parseMerge(message: string, at: string): Version | null {
  const [subject = '', ...rest] = message.trim().split('\n');
  const merge = /^Merge pull request #(\d+)\b/.exec(subject);
  if (merge) return { pr: Number(merge[1]), title: rest.join(' ').trim() || subject, at };
  const squash = /^(.*) \(#(\d+)\)$/.exec(subject);
  if (squash) return { pr: Number(squash[2]), title: squash[1], at };
  return null;
}

/** "PR #62", or "dev" for a build that is not the live site's. */
export function versionLabel(v: Version | null): string {
  return v ? `PR #${v.pr}` : 'dev';
}

/** The hover text: "Title · live since 12 Nov, 14:20". */
export function versionTip(v: Version | null, locale?: string): string {
  if (!v) return 'Not the live site: built on this computer';
  const when = new Date(v.at).toLocaleString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  return `${v.title} · live since ${when}`;
}
