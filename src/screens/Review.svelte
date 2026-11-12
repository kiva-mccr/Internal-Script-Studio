<script lang="ts">
  import { tick } from 'svelte';
  import { threads, type Field, type Flag, type Note, type Thread } from '../lib/comments';
  import FlagIcon from './FlagIcon.svelte';
  import { plain, rangeOf, renderMath, toHtml } from '../lib/format';
  import { readFileRef, type Row, type Script } from '../lib/script';
  import { clock, sectionWords, speaking } from '../lib/readtime.svelte';
  import { ago } from '../lib/when';

  // Review (mock-up 4): the script to read, and comments beside it. Select text in a cell to comment or suggest a
  // change, or use Comment on a row; reply and resolve comments, accept or reject suggestions.
  let {
    script,
    notes,
    flagged,
    onAdd,
    onApply,
  }: {
    script: Script;
    notes: Note[];
    flagged: Map<string, Flag>; // flagged rows (AP-9): shown with their note, cleared only in Write
    onAdd: (note: Omit<Note, 'v' | 'id' | 'when' | 'who'>) => Promise<boolean>;
    // Replaces `from` with `to` in a row's field (Write's text); false if `from` is no longer there.
    onApply: (row: string, field: Field, from: string, to: string) => boolean;
  } = $props();

  const FIELDS: [Field, string][] = [['dialogue', 'Dialogue'], ['on_screen', 'On screen'], ['files', 'Images & files']];
  const label = (field?: Field) => FIELDS.find(([f]) => f === field)?.[1] ?? '';

  let target = $state<{ row: string; field: Field; quote: string } | null>(null);
  let draft = $state('');
  let draftMissing = $state('');
  let suggesting = $state(false);
  let replying = $state('');
  let reply = $state('');
  let active = $state('');
  let showResolved = $state(false);
  let box = $state<HTMLTextAreaElement>();

  const all = $derived(threads(notes));
  let recent = $state<string[]>([]); // decided here just now: kept in place, with Undo (mock-up 4)
  const open = $derived(all.filter((t) => !t.resolved));
  const shown = $derived(all.filter((t) => !t.resolved || recent.includes(t.comment.id)));
  const resolved = $derived(all.filter((t) => t.resolved && !recent.includes(t.comment.id)));
  const words = $derived(sectionWords(script)); // each section's read time (AP-12)
  const numbers = $derived(
    new Map(script.blocks.filter((b): b is Row => b.type === 'row').map((row, i) => [row.id, i + 1])),
  );

  // What a cell shows; files by their names, as in Write (a quote in Images & files is of what is shown).
  const text = (row: Row, field: Field) =>
    field === 'files' ? row.files.map((f) => readFileRef(f).label).join('\n') : field === 'on_screen' ? row.onScreen : row.dialogue;
  let table = $state<HTMLElement>();

  // Each open comment's quote is marked in its cell with the browser's highlights (CSS.highlights), which can
  // cross bold, links and so on without changing the page.
  $effect(() => {
    const list = open;
    const on = active;
    void script;
    tick().then(async () => {
      if (!table) return;
      await renderMath(table);
      const marks: Record<string, Range[]> = { comment: [], 'comment-on': [], suggestion: [] };
      for (const t of list) {
        const cell = table.querySelector<HTMLElement>(`[data-row="${t.comment.row}"][data-field="${t.comment.field}"]`);
        const range = cell && t.comment.quote ? rangeOf(cell, t.comment.quote) : null;
        if (range) marks[t.comment.id === on ? 'comment-on' : t.comment.kind === 'suggestion' ? 'suggestion' : 'comment'].push(range);
      }
      for (const [name, ranges] of Object.entries(marks)) CSS.highlights.set(name, new Highlight(...ranges));
    });
    return () => ['comment', 'comment-on', 'suggestion'].forEach((name) => CSS.highlights.delete(name));
  });

  function where(t: Thread): string {
    const n = numbers.get(t.comment.row ?? '');
    return n ? `row ${n}` : 'a deleted row';
  }

  // The quote is no longer in its row: the comment is on text that has since changed.
  function changed(t: Thread): boolean {
    const row = script.blocks.find((b): b is Row => b.type === 'row' && b.id === t.comment.row);
    return !!t.comment.quote && (!row || !plain(text(row, t.comment.field ?? 'dialogue')).includes(t.comment.quote));
  }

  function select(row: Row, field: Field, el: HTMLElement) {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !el.contains(sel.anchorNode) || !el.contains(sel.focusNode)) return;
    const quote = sel.toString().trim();
    if (quote) start({ row: row.id, field, quote });
  }

  function start(t: { row: string; field: Field; quote: string }) {
    target = t;
    draft = '';
    draftMissing = '';
    suggesting = false;
    queueMicrotask(() => box?.focus());
  }

  // Suggesting starts from the selected words, ready to change.
  function suggest(on: boolean) {
    suggesting = on;
    draft = on ? target!.quote : '';
    draftMissing = '';
    queueMicrotask(() => box?.focus());
  }

  async function send(e: SubmitEvent) {
    e.preventDefault();
    if (!target) return;
    const { row, field, quote } = target;
    if (suggesting) {
      if (draft === quote) return void ((draftMissing = 'Change the text first.'), box?.focus());
      if (await onAdd({ kind: 'suggestion', row, field, quote, replace: draft })) target = null;
      return;
    }
    if (!draft.trim()) return void ((draftMissing = 'Write a comment first.'), box?.focus());
    if (await onAdd({ kind: 'comment', row, field, quote, text: draft.trim() })) target = null;
  }

  async function decide(t: Thread, accept: boolean) {
    const { row = '', field = 'dialogue', quote = '', replace = '' } = t.comment;
    if (accept && !onApply(row, field, quote, replace)) return;
    if (await onAdd({ kind: accept ? 'accept' : 'reject', about: t.comment.id })) recent = [...recent, t.comment.id];
  }

  // Undo an accept puts the old words back; either way the suggestion is open again.
  async function undo(t: Thread) {
    const { row = '', field = 'dialogue', quote = '', replace = '' } = t.comment;
    if (t.decision === 'accepted' && !onApply(row, field, replace, quote)) return;
    await onAdd({ kind: 'reopen', about: t.comment.id });
  }

  async function sendReply(e: SubmitEvent, t: Thread) {
    e.preventDefault();
    if (!reply.trim()) return;
    if (await onAdd({ kind: 'reply', about: t.comment.id, text: reply.trim() })) (replying = ''), (reply = '');
  }
</script>

<div class="review">
  <div class="script" bind:this={table}>
    <p class="hint">Select any text to comment or suggest a change. The writer accepts or rejects each suggestion.</p>
    <div class="head grid"><span>#</span><span>Dialogue</span><span>On screen</span><span>Images &amp; files</span></div>
    {#each script.blocks as block, i (i)}
      {#if block.type === 'section'}
        <h3 class="section"><span>{block.title}</span>{#if words.get(block)}<span class="time" title="{words.get(block)} words at {speaking.wpm} words a minute">{clock((words.get(block)! / speaking.wpm) * 60)}</span>{/if}</h3>
      {:else}
        {@const n = numbers.get(block.id)}
        <div class="row grid" class:active={open.some((t) => t.comment.id === active && t.comment.row === block.id)}>
          <div class="num">
            <span>{n}</span>
            <button class="add" aria-label="Comment on row {n}" title="Comment on this row"
              onclick={() => start({ row: block.id, field: 'dialogue', quote: '' })}>Comment</button>
          </div>
          {#each FIELDS as [field, name] (field)}
            <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
            <p class="cell {field}" aria-label="{name}, row {n}" data-row={block.id} data-field={field}
              onmouseup={(e) => select(block, field, e.currentTarget)}>{@html toHtml(text(block, field))}</p>
          {/each}
          {#if flagged.get(block.id)}
            {@const flag = flagged.get(block.id)!}
            <p class="flag-note" aria-label="Flag, row {n}"><FlagIcon size={13} /><span>{flag.text || 'Flagged'}</span><span class="by">{flag.who}</span></p>
          {/if}
        </div>
      {/if}
    {/each}
  </div>

  <aside aria-label="Comments">
    {#if target}
      <form class="card compose" aria-label="New comment" novalidate onsubmit={send}>
        <div class="who">{suggesting ? 'Suggest a change to' : 'Comment on'} row {numbers.get(target.row)}{target.quote ? ` · ${label(target.field)}` : ''}</div>
        {#if target.quote && target.field !== 'files'}
          <div class="switch" role="group" aria-label="Comment or suggest">
            <button type="button" aria-pressed={!suggesting} onclick={() => suggest(false)}>Comment</button>
            <button type="button" aria-pressed={suggesting} onclick={() => suggest(true)}>Suggest a change</button>
          </div>
        {/if}
        {#if target.quote}<blockquote>{target.quote}</blockquote>{/if}
        <textarea bind:this={box} bind:value={draft} oninput={() => (draftMissing = '')} aria-label={suggesting ? 'Replace with' : 'Comment'} rows="3"></textarea>
        {#if draftMissing}<p class="missing" role="alert">{draftMissing}</p>{/if}
        <div class="actions">
          <button class="primary small" type="submit">{suggesting ? 'Add suggestion' : 'Add comment'}</button>
          <button class="link" type="button" onclick={() => (target = null)}>Cancel</button>
        </div>
      </form>
    {/if}

    <h2>Open · {open.length}</h2>
    {#each shown as t (t.comment.id)}
      {@render card(t)}
    {:else}
      <p class="quiet">No open comments.</p>
    {/each}

    {#if resolved.length}
      <button class="link" aria-expanded={showResolved} onclick={() => (showResolved = !showResolved)}>
        {showResolved ? '▾' : '▸'} Resolved · {resolved.length}
      </button>
      {#if showResolved}{#each resolved as t (t.comment.id)}{@render card(t)}{/each}{/if}
    {/if}
  </aside>
</div>

{#snippet card(t: Thread)}
  {@const suggestion = t.comment.kind === 'suggestion'}
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
  <article class="card" data-id={t.comment.id} class:active={t.comment.id === active} class:done={t.resolved} aria-label="{t.comment.kind === 'suggestion' ? 'Suggestion' : 'Comment'} by {t.comment.who}"
    onclick={() => (active = t.comment.id)}>
    <div class="who"><span><strong>{t.comment.who}</strong> {suggestion ? 'suggested' : 'commented'} · {where(t)}</span><span>{ago(Date.parse(t.comment.when))}</span></div>
    {#if changed(t) && !t.decision}<p class="quiet">On text that has since changed: “{t.comment.quote}”</p>{/if}
    {#if suggestion}
      <p class="text">Replace “<span class="old">{t.comment.quote}</span>” with “<span class="new">{t.comment.replace}</span>”.</p>
    {:else}
      <p class="text">{t.comment.text}</p>
    {/if}
    {#each t.replies as r (r.id)}
      <div class="reply"><div class="who"><strong>{r.who}</strong><span>{ago(Date.parse(r.when))}</span></div><p class="text">{r.text}</p></div>
    {/each}
    {#if replying === t.comment.id}
      <form class="reply-form" onsubmit={(e) => sendReply(e, t)}>
        <textarea bind:value={reply} aria-label="Reply" rows="2"></textarea>
        <div class="actions">
          <button class="primary small" type="submit">Reply</button>
          <button class="link" type="button" onclick={() => (replying = '')}>Cancel</button>
        </div>
      </form>
    {:else}
      <div class="actions">
        {#if suggestion && t.decision}
          <span class="decided">{t.decision === 'accepted' ? 'Accepted. The script is updated.' : 'Rejected. The original stays.'}</span>
          <button class="link" onclick={() => undo(t)}>Undo</button>
        {:else if suggestion}
          <button class="primary small" onclick={() => decide(t, true)}>Accept</button>
          <button class="outline" onclick={() => decide(t, false)}>Reject</button>
          <button class="link" onclick={() => ((replying = t.comment.id), (reply = ''))}>Reply</button>
        {:else if !t.resolved}
          <button class="outline" onclick={() => ((replying = t.comment.id), (reply = ''))}>Reply</button>
          <button class="link" onclick={() => onAdd({ kind: 'resolve', about: t.comment.id })}>Resolve</button>
        {:else}
          <button class="link" onclick={() => onAdd({ kind: 'reopen', about: t.comment.id })}>Reopen</button>
        {/if}
      </div>
    {/if}
  </article>
{/snippet}

<style>
  .review { display: flex; flex-wrap: wrap; gap: 32px; align-items: flex-start; }
  .script { flex: 999 1 640px; min-width: 0; }
  aside { flex: 1 1 300px; display: flex; flex-direction: column; gap: 12px; position: sticky; top: 16px; }
  .hint { margin: 0 0 20px; font-size: 14px; color: var(--muted); }
  .grid { display: grid; grid-template-columns: 56px minmax(0, 1.25fr) minmax(0, 1fr) minmax(0, 0.7fr); gap: 20px; padding: 0 12px; }
  .head { position: sticky; top: 0; z-index: 1; background: var(--ground); padding-top: 10px; padding-bottom: 10px; font-size: 13px;
    font-weight: 500; color: var(--muted); border-bottom: 1px solid var(--line); }
  .section { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin: 0; padding: 28px 12px 8px; font-size: 18px; font-weight: 600; border-bottom: 1px solid var(--line); }
  .time { font-size: 13px; font-weight: 400; color: var(--muted); font-variant-numeric: tabular-nums; }
  .row { align-items: start; padding-top: 20px; padding-bottom: 20px; border-bottom: 1px solid #f0f0f0; }
  .row.active { background: #f7f9fe; }
  .flag-note { grid-column: 2 / -1; display: flex; align-items: center; gap: 8px; margin: 0; padding: 6px 12px; border-radius: 8px;
    background: #fff7ed; color: var(--flag); font-size: 13px; }
  .flag-note .by { margin-left: auto; font-size: 12px; }
  .num { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; font-size: 13px; color: var(--muted); padding-top: 3px; }
  .add { padding: 2px 6px; margin-left: -6px; border: 0; border-radius: 6px; background: none; color: var(--muted); font-size: 12px; opacity: 0; }
  .row:hover .add, .add:focus { opacity: 1; }
  .add:hover { background: #f0f0f0; color: var(--ink); }
  .cell { margin: 0; line-height: 1.55; white-space: pre-wrap; }
  .dialogue { font-size: 17px; }
  .on_screen { font-size: 15px; color: #3d3d3d; }
  .files { font-size: 13px; color: #3d3d3d; }
  :global(::highlight(comment)) { background: #fff1c2; text-decoration: underline 2px #e0b100; }
  :global(::highlight(suggestion)) { background: #fdecec; color: #8a2b2b; text-decoration: line-through; }
  :global(::highlight(comment-on)) { background: #ffe38a; text-decoration: underline 2px #e0b100; }
  .cell :global(a) { color: var(--accent); }
  .cell :global(s) { color: #8a8a8a; }
  h2 { margin: 0 0 4px; font-size: 14px; font-weight: 600; }
  .card { display: flex; flex-direction: column; gap: 10px; padding: 16px; border: 1px solid var(--line); border-radius: 10px; background: #fff; }
  .card.active { border-color: #b9c7ee; }
  .card.done { background: #fafafa; }
  .compose { border-color: var(--accent); }
  .who { display: flex; justify-content: space-between; gap: 8px; font-size: 13px; color: var(--muted); }
  .who strong { color: var(--ink); font-weight: 600; }
  .text { margin: 0; font-size: 14px; line-height: 1.5; white-space: pre-wrap; }
  .old { color: #8a2b2b; text-decoration: line-through; }
  .new { color: var(--accent); }
  .decided { display: inline-flex; align-items: center; flex: 1; font-size: 14px; color: #3d3d3d; }
  .switch { display: flex; gap: 2px; padding: 3px; border-radius: 8px; background: #f2f2f2; align-self: flex-start; }
  .switch button { min-height: 32px; padding: 0 12px; border: 0; border-radius: 6px; background: none; color: var(--muted); font-size: 13px; }
  .switch button[aria-pressed='true'] { background: #fff; color: var(--ink); box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08); }
  .reply { display: flex; flex-direction: column; gap: 4px; padding-left: 12px; border-left: 2px solid var(--line); }
  blockquote { margin: 0; padding-left: 10px; border-left: 3px solid #e0b100; font-size: 14px; color: #3d3d3d; }
  textarea { font: inherit; font-size: 14px; padding: 8px 10px; border: 1px solid var(--line-strong); border-radius: 8px; resize: vertical; }
  .reply-form { display: flex; flex-direction: column; gap: 8px; }
  .actions { display: flex; gap: 8px; }
  .small { min-height: 40px; padding: 0 16px; font-size: 14px; }
  .missing { margin: 0; font-size: 13px; color: var(--danger); }
  .quiet { margin: 0; font-size: 13px; color: var(--muted); }
</style>
