<script lang="ts">
  import { problem } from '../lib/problems';
  import CopyDetails from './CopyDetails.svelte';
  import { onMount } from 'svelte';
  import { changes, holdEnds, isOfficial, isSend, listVersions, officialNumber, officialNumbers, summary, type Version } from '../lib/history';
  import { threads, type Note, type Thread } from '../lib/comments';
  import { renderMath, toHtml } from '../lib/format';
  import { cellKey, placeComments, stateText } from '../lib/historycomments';
  import { parseScript, rows } from '../lib/script';
  import { at } from '../lib/when';
  import Attached from './Attached.svelte';

  let {
    dir,
    notes,
    onRestore,
    onPublish,
    onOpen,
  }: {
    dir: FileSystemDirectoryHandle;
    notes: Note[];
    onRestore: (version: Version) => void;
    onPublish: (name: string) => Promise<Version | null>;
    onOpen: (id: string) => void; // a still-open comment, in Review
  } = $props();

  let versions = $state<Version[] | null>(null); // newest first
  let picked = $state(0);
  let error = $state('');
  let open = $state<Record<number, boolean>>({}); // folded groups opened, by the index of their first version
  let publishing = $state(false);
  let officialName = $state('');
  let nameMissing = $state(false);
  let nameInput = $state<HTMLInputElement>();
  let repliesOpen = $state<Record<string, boolean>>({}); // comments whose replies are shown, by id

  onMount(load);

  // HI-3: the newest 50 first. After the first "Show 50 older", the next ones come as the end scrolls near.
  const PAGE = 50;
  let shown = $state(PAGE);
  let auto = $state(false);
  const older = $derived(Math.max((versions?.length ?? 0) - shown, 0));
  function showOlder() {
    shown += PAGE;
    auto = true;
  }
  // Watched again after each load: when older saves fold into one line, the end can still be in sight.
  function nearEnd(node: HTMLElement, _shown: number) {
    const watch = new IntersectionObserver((seen) => seen.some((s) => s.isIntersecting) && showOlder(), { rootMargin: '400px' });
    watch.observe(node);
    return {
      update() {
        watch.unobserve(node);
        watch.observe(node);
      },
      destroy: () => watch.disconnect(),
    };
  }

  async function load() {
    try {
      versions = (await listVersions(dir)).reverse();
      // With official versions, History opens on the newest one.
      const newestOfficial = versions.findIndex(isOfficial);
      picked = Math.max(newestOfficial, 0);
      shown = Math.max(PAGE, picked + 1);
    } catch (e) {
      error = problem("History couldn't be read. If the shared folder is still syncing, wait a moment and try again.", 'reading History', e);
    }
  }

  const numbers = $derived(officialNumbers([...(versions ?? [])].reverse()));
  const nextNumber = $derived(numbers.size + 1);

  // Without official versions: every version. With them: the official ones and the sends for review, and the small
  // saves between them folded into one line until opened.
  type Item = { kind: 'one'; i: number } | { kind: 'group'; first: number; list: number[]; label: string };
  const items = $derived.by((): Item[] => {
    const list = (versions ?? []).slice(0, shown);
    if (!numbers.size) return list.map((_, i) => ({ kind: 'one', i }));
    const out: Item[] = [];
    let group: number[] = [];
    const flush = (label: string) => {
      if (group.length) out.push({ kind: 'group', first: group[0], list: group, label: `${count(group.length)} ${label}` });
      group = [];
    };
    list.forEach((v, i) => {
      if (!isOfficial(v) && !isSend(v)) return void group.push(i);
      flush(isOfficial(v) ? `since v${numbers.get(v.id)}` : 'since sent for review');
      out.push({ kind: 'one', i });
    });
    flush('before v1');
    return out;
  });

  const count = (n: number) => (n === 1 ? '1 change' : `${n} changes`);

  // A send for review that made no version, because nothing had changed since the newest one (RV-9): its number.
  function still(i: number): number {
    const v = versions![i];
    return isSend(v) && !v.official ? officialNumber(versions!.slice(i + 1).reverse(), v.text) : 0;
  }

  // The version a version is compared with: for an official one, the official one before it; otherwise its first
  // parent, else the one before it in time.
  function before(i: number): Version | undefined {
    const list = versions!;
    const n = numbers.get(list[i].id);
    if (n && n > 1) return list.find((v) => numbers.get(v.id) === n - 1);
    const parent = list[i].parents[0];
    return (parent && list.find((v) => v.id === parent)) || list[i + 1];
  }

  function title(i: number): string {
    const v = versions![i];
    const n = numbers.get(v.id);
    if (n) return `v${n} · ${v.note}`;
    return still(i) ? `${v.note} (still v${still(i)})` : summary(v, before(i));
  }

  function startPublish() {
    publishing = true;
    officialName = '';
    nameMissing = false;
    queueMicrotask(() => nameInput?.focus());
  }

  async function publish(e: SubmitEvent) {
    e.preventDefault();
    const name = officialName.trim();
    if (!name) return void ((nameMissing = true), nameInput?.focus());
    if (!(await onPublish(name))) return;
    publishing = false;
    await load();
  }

  function math(node: HTMLElement, _text: string) {
    renderMath(node);
    return { update: () => renderMath(node) };
  }

  const selected = $derived(versions?.[picked]);
  const selectedChanges = $derived(versions && selected ? changes(before(picked)?.text, selected.text) : []);
  const selectedNumber = $derived(selected ? numbers.get(selected.id) : undefined);

  // Comments in History (RV-6, board 48): each on the version whose change it led to, or on the one current when it
  // was made. A version shows those of every version since the one it is compared with (an official one gathers
  // the small saves folded under it).
  const placed = $derived(placeComments([...(versions ?? [])].reverse(), threads(notes, false, holdEnds(versions ?? []))));
  function covered(i: number): number[] {
    const b = before(i);
    const end = b ? versions!.indexOf(b) : versions!.length;
    return Array.from({ length: Math.max(end - i, 1) }, (_, k) => i + k);
  }
  function commentCount(i: number): number {
    return covered(i).reduce((n, k) => {
      const p = placed.get(versions![k].id);
      return n + (p ? p.open.length + [...p.changed.values()].reduce((m, list) => m + list.length, 0) : 0);
    }, 0);
  }
  const why = $derived.by(() => {
    const under = new Map<number, Thread[]>();
    const rest: Thread[] = [];
    if (!versions || !selected) return { under, rest };
    for (const k of covered(picked)) {
      const p = placed.get(versions[k].id);
      if (!p) continue;
      for (const [key, list] of p.changed) {
        const i = selectedChanges.findIndex((c) => c.row && (c.field ? key === cellKey(c.row, c.field) : key.startsWith(`${c.row}:`)));
        if (i < 0) rest.push(...list);
        else under.set(i, [...(under.get(i) ?? []), ...list]);
      }
      rest.push(...p.open);
    }
    const byTime = (a: Thread, b: Thread) => (a.comment.when < b.comment.when ? -1 : 1);
    for (const list of under.values()) list.sort(byTime);
    return { under, rest: rest.sort(byTime) };
  });
  const rowNumbers = $derived(new Map(selected ? rows(parseScript(selected.text)).map((r, i) => [r.id, i + 1]) : []));
  const FIELD = { dialogue: 'Dialogue', on_screen: 'On screen', files: 'Images & files' };
  function cell(t: Thread): string {
    const n = rowNumbers.get(t.comment.row ?? '');
    return n ? `row ${n}, ${FIELD[t.comment.field ?? 'dialogue']}` : 'a removed row';
  }
  // An accepted suggestion says so in its change's header.
  function heading(where: string, list: Thread[] | undefined): string {
    const t = list?.find((t) => t.decision === 'accepted');
    return t ? `${where} · ${t.comment.who}’s suggestion, accepted${t.by ? ` by ${t.by}` : ''}` : where;
  }
</script>

{#if error}
  <p class="error" role="alert">{error}<CopyDetails message={error} /></p>
{:else if versions && versions.length === 0}
  <p class="empty">No history yet.<span class="help"> It starts with the next save.</span></p>
{:else if versions && selected}
  {#snippet entry(i: number)}
    {@const version = versions![i]}
    {@const n = numbers.get(version.id)}
    {@const c = commentCount(i)}
    <button class="entry" class:official={n} class:picked={i === picked} aria-current={i === picked ? 'true' : undefined}
      onclick={() => (picked = i)}>
      <span class="note">{#if n}<span class="tag">v{n}</span>{version.note}{:else}{title(i)}{/if}</span>
      <span class="meta">{version.kind === 'official' ? 'Published by ' : ''}{version.who} · {at(Date.parse(version.when))}{c ? ` · ${c === 1 ? '1 comment' : `${c} comments`}` : ''}</span>
      {#if version.message}<span class="message">{version.message}</span>{/if}
    </button>
  {/snippet}
  <div class="history">
    <div class="versions">
      <div class="nav-top">
        <h2>Versions</h2>
        <button class="primary small" data-tour="publish" onclick={startPublish}>Publish official version</button>
      </div>
      <nav aria-label="Versions" data-tour="versions">
        {#each items as item (item.kind === 'one' ? versions[item.i].id : `g${item.first}`)}
          {#if item.kind === 'one'}
            {@render entry(item.i)}
          {:else}
            <div class="group">
              <button class="fold" aria-expanded={!!open[item.first]} onclick={() => (open[item.first] = !open[item.first])}>
                <span aria-hidden="true">{open[item.first] ? '▾' : '▸'}</span> {item.label}
              </button>
              {#if open[item.first]}
                {#each item.list as i (versions[i].id)}{@render entry(i)}{/each}
              {/if}
            </div>
          {/if}
        {/each}
      </nav>
      {#if older}
        <div class="more">
          <p class="meta">Showing the newest {shown.toLocaleString('en-US')} of {versions.length.toLocaleString('en-US')} versions.{auto ? ' Older ones load as you scroll.' : ''}</p>
          {#if auto}
            <div use:nearEnd={shown} aria-hidden="true"></div>
          {:else}
            <button class="outline" onclick={showOlder}>Show {Math.min(PAGE, older)} older</button>
          {/if}
        </div>
      {/if}
    </div>
    <section class="detail" aria-label="Changes">
      {#if publishing}
        <form class="publish" aria-label="Publish official version" novalidate onsubmit={publish}>
          <h2>Publish official version</h2>
          <label>Name it
            <input bind:this={nameInput} bind:value={officialName} oninput={() => (nameMissing = false)} placeholder="Final for recording" />
          </label>
          {#if nameMissing}<p class="missing" role="alert">Give it a name first.</p>{/if}
          <p class="meta">It becomes v{nextNumber}: the script as it is now, kept and shown in History. Everyone sees it.</p>
          <div class="actions">
            <button class="primary" type="submit">Publish v{nextNumber}</button>
            <button class="link" type="button" onclick={() => (publishing = false)}>Cancel</button>
          </div>
        </form>
      {/if}
      <div class="top">
        <h2>{title(picked)}</h2>
        {#if picked > 0}
          <button class="outline" onclick={() => onRestore(selected)}>Restore this version</button>
        {/if}
      </div>
      <p class="meta">
        {selected.kind === 'official' ? 'Published by ' : ''}{selected.who} · {at(Date.parse(selected.when))}{before(picked)
          ? ` · changes compared with ${selectedNumber && selectedNumber > 1 ? `v${selectedNumber - 1}` : 'the version before'}`
          : ''}
        {#if picked === 0}<br />This is the current version.{/if}
      </p>
      {#snippet thread(t: Thread, inRest: boolean)}
        {@const suggestion = t.comment.kind === 'suggestion'}
        <div class="comment" role="group" aria-label="{suggestion ? 'Suggestion' : 'Comment'} by {t.comment.who}">
          <div class="who"><span><strong>{t.comment.who}</strong> {suggestion ? 'suggested' : 'commented'}{inRest ? ` · ${cell(t)}` : ''} · {at(Date.parse(t.comment.when))}{t.comment.edited ? ' · edited' : ''}</span><span class="state">{stateText(t)}</span></div>
          {#if suggestion}
            <p class="text">Replace “<span class="was">{t.comment.quote}</span>” with “<span class="is">{t.comment.replace}</span>”.</p>
          {:else}
            {#if t.comment.quote}<blockquote>{t.comment.quote}</blockquote>{/if}
            {#if t.comment.text}<p class="text">{t.comment.text}</p>{/if}
            {#if t.comment.files?.length}<Attached {dir} files={t.comment.files} />{/if}
          {/if}
          {#if t.replies.length}
            {@const shown = !!repliesOpen[t.comment.id]}
            <button class="link replies" aria-expanded={shown} onclick={() => (repliesOpen[t.comment.id] = !shown)}>
              {shown ? 'Hide ' : ''}{t.replies.length === 1 ? '1 reply' : `${t.replies.length} replies`}
            </button>
            {#if shown}
              {#each t.replies as r (r.id)}
                <div class="reply">
                  <div class="who"><span><strong>{r.who}</strong> · {at(Date.parse(r.when))}{r.edited ? ' · edited' : ''}</span></div>
                  {#if r.text}<p class="text">{r.text}</p>{/if}
                  {#if r.files?.length}<Attached {dir} files={r.files} />{/if}
                </div>
              {/each}
            {/if}
          {/if}
          {#if inRest && !t.resolved && !t.held}<button class="link" onclick={() => onOpen(t.comment.id)}>Open in Review</button>{/if}
        </div>
      {/snippet}
      {#each selectedChanges as change, i (i)}
        <div class="change" data-tour="changes">
          <div class="where">{heading(change.where, why.under.get(i))}</div>
          <div class="body">
            {#if change.old}<p class="old"><span class="sign" aria-label="Removed">−</span><span class="struck" use:math={change.old}>{@html toHtml(change.old)}</span></p>{/if}
            {#if change.new}<p class="new"><span class="sign" aria-label="Added">+</span><span use:math={change.new}>{@html toHtml(change.new)}</span></p>{/if}
          </div>
          {#if why.under.get(i)?.length}
            <div class="why">{#each why.under.get(i)! as t (t.comment.id)}{@render thread(t, false)}{/each}</div>
          {/if}
        </div>
      {:else}
        <p class="meta">Nothing in the rows changed.</p>
      {/each}
      {#if why.rest.length}
        <section class="rest" aria-label="Comments with no change yet">
          <h3>Comments on this version, nothing changed for them yet</h3>
          {#each why.rest as t (t.comment.id)}<div class="card">{@render thread(t, true)}</div>{/each}
        </section>
      {/if}
    </section>
  </div>
{/if}

<style>
  .history { display: flex; flex-wrap: wrap; gap: 40px; align-items: flex-start; }
  .versions { flex: 1 1 280px; }
  nav { display: flex; flex-direction: column; gap: 4px; }
  h2 { margin: 0; font-size: 14px; font-weight: 600; }
  .nav-top { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 8px; }
  .versions .nav-top h2 { margin: 0; }
  .small { min-height: 36px; padding: 0 12px; font-size: 13px; }
  .group { display: flex; flex-direction: column; gap: 2px; padding: 6px 8px; border: 1px dashed var(--line-strong); border-radius: 8px; }
  .more { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; margin-top: 8px; padding: 14px 14px 0; border-top: 1px solid var(--line); }
  .fold { min-height: 32px; padding: 0 6px; border: 0; background: none; color: var(--muted); font-size: 13px; font-weight: 500; text-align: left; }
  .tag { margin-right: 8px; padding: 2px 8px; border-radius: 999px; background: #e7f4ec; color: #1b6b3e; font-size: 12px; font-weight: 600; }
  .entry.official { min-height: 64px; }
  .entry.official .note { font-weight: 600; }
  .publish { display: flex; flex-direction: column; gap: 10px; padding: 16px 20px; border: 1px solid var(--line); border-radius: 10px; background: #fafafa; }
  .publish h2 { font-size: 16px; }
  .publish label { display: flex; flex-direction: column; gap: 6px; font-size: 14px; font-weight: 500; }
  .publish input { font: inherit; font-size: 16px; font-weight: 400; padding: 10px 12px; border: 1px solid var(--line-strong); border-radius: 8px; background: #fff; }
  .missing { margin: 0; font-size: 13px; color: var(--danger); }
  .actions { display: flex; gap: 8px; }
  .versions button.entry { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; min-height: 56px; padding: 10px 14px;
    border: 0; border-radius: 8px; background: none; text-align: left; }
  .versions button.entry:hover { background: #f7f7f7; }
  .versions button.entry.picked { background: #f0f3fc; }
  .note { font-size: 14px; font-weight: 500; color: var(--ink); }
  .message { margin-top: 4px; padding-left: 10px; border-left: 2px solid var(--line-strong); font-size: 13px; line-height: 1.5;
    color: var(--ink); white-space: pre-wrap; overflow-wrap: anywhere; }
  .meta { margin: 0; font-size: 13px; color: var(--muted); line-height: 1.5; }
  .detail { flex: 999 1 560px; min-width: 0; display: flex; flex-direction: column; gap: 16px; }
  .top { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; }
  .top h2 { font-size: 20px; }
  .change { border: 1px solid var(--line); border-radius: 10px; overflow: hidden; }
  .where { padding: 10px 16px; font-size: 13px; color: var(--muted); background: #fafafa; border-bottom: 1px solid var(--line); }
  .body { display: flex; flex-direction: column; gap: 8px; padding: 16px; }
  .body p { margin: 0; font-size: 15px; line-height: 1.55; white-space: pre-wrap; }
  .old { color: #8a2b2b; }
  .struck { text-decoration: line-through; }
  .new { color: #1b6b3e; }
  .sign { display: inline-block; width: 18px; font-weight: 600; }
  .why { display: flex; flex-direction: column; gap: 12px; padding: 12px 16px 16px; border-top: 1px dashed var(--line); }
  .rest { display: flex; flex-direction: column; gap: 12px; margin-top: 8px; }
  .rest h3 { margin: 0; font-size: 14px; font-weight: 600; }
  .card { padding: 14px 16px; border: 1px solid var(--line); border-radius: 10px; }
  .comment { display: flex; flex-direction: column; gap: 6px; }
  .comment .who { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 4px 8px; font-size: 13px; color: var(--muted); }
  .comment strong { color: var(--ink); font-weight: 600; }
  .state { padding: 1px 8px; border-radius: 999px; background: #f2f2f2; color: #3d3d3d; font-size: 12px; font-weight: 500; }
  .comment blockquote { margin: 0; padding-left: 10px; border-left: 3px solid #e0b100; font-size: 13px; color: #3d3d3d; }
  .comment .text { margin: 0; font-size: 14px; line-height: 1.5; white-space: pre-wrap; overflow-wrap: anywhere; }
  .was { color: #8a2b2b; text-decoration: line-through; }
  .is { color: var(--accent); }
  .comment .link { align-self: flex-start; min-height: 32px; padding: 0 4px; color: var(--accent); font-size: 13px; }
  .reply { display: flex; flex-direction: column; gap: 2px; padding-left: 12px; border-left: 2px solid var(--line); }
  .empty, .error { color: var(--muted); }
  .error { color: var(--danger); }
</style>
