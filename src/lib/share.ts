// Copy for Teams (EX-10): a short message about the script, as formatted text (Teams keeps the bold and the links)
// and as plain text for anywhere else. A snapshot: it says what was true when it was copied.
import { clock, scriptWords, speaking } from './readtime.svelte';
import type { Script } from './script';

export type Facts = {
  title: string;
  link: string;
  status: string; // 'draft', 'in review' or 'approved'
  version: string; // 'v3' while the script is that official version, else ''
  who: string; // who saved last, '' if not known
  when: number; // when, in ms; 0 if not known
  open: number; // open comments
  voice: number; // rows with a voice-over take
};

export type Shared = { html: string; text: string };

// The rows and the read-aloud time of a script's Dialogue, at the speaking speed (AP-12).
export function measure(script: Script): { rows: number; seconds: number } {
  const rows = script.blocks.filter((b) => b.type === 'row');
  return { rows: rows.length, seconds: (scriptWords(script) / speaking.wpm) * 60 };
}

export function share(facts: Facts, script: Script, now = Date.now()): Shared {
  const { rows, seconds } = measure(script);
  const status = facts.status[0].toUpperCase() + facts.status.slice(1);
  const title = facts.title || 'Untitled script';
  const facts1 = [facts.version, `${rows} ${rows === 1 ? 'row' : 'rows'}`, `${clock(seconds)} read aloud`].filter(Boolean);
  const facts2 = [
    facts.when ? `Last edited${facts.who ? ` by ${facts.who}` : ''}, ${day(facts.when, now)}` : '',
    facts.open ? `${facts.open} open ${facts.open === 1 ? 'comment' : 'comments'}` : '',
    facts.voice ? `Voice-over ${facts.voice} of ${rows} rows` : '',
  ].filter(Boolean);
  const link = escape(facts.link);
  const html = [
    `<a href="${link}"><b>${escape(title)}</b></a>`,
    [`<b>${status}</b>`, ...facts1].join(' · '),
    ...(facts2.length ? [escape(facts2.join(' · '))] : []),
    `<a href="${link}">Open in Script Studio</a>`,
  ].join('<br>');
  const text = [title, [status, ...facts1].join(' · '), ...(facts2.length ? [facts2.join(' · ')] : []), facts.link].join('\n');
  return { html: `<p>${html}</p>`, text };
}

// "Nov 10" (and the year if not this one).
function day(time: number, now: number): string {
  const date = new Date(time);
  const sameYear = date.getFullYear() === new Date(now).getFullYear();
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: sameYear ? undefined : 'numeric' });
}

function escape(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
