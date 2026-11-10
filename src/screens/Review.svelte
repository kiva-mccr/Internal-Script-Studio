<script lang="ts">
  import { highlight, threads, type Field, type Note, type Thread } from '../lib/comments';
  import { readFileRef, type Row, type Script } from '../lib/script';
  import { ago } from '../lib/when';

  // Review (mock-up 4): the script to read, and comments beside it. Select text in a cell, or use Comment on a
  // row, to comment; reply and resolve on each comment.
  let {
    script,
    notes,
    onAdd,
  }: {
    script: Script;
    notes: Note[];
    onAdd: (note: Omit<Note, 'v' | 'id' | 'when' | 'who'>) => Promise<boolean>;
  } = $props();

  const FIELDS: [Field, string][] = [['dialogue', 'Dialogue'], ['on_screen', 'On screen'], ['files', 'Images & files']];
  const label = (field?: Field) => FIELDS.find(([f]) => f === field)?.[1] ?? '';

  let target = $state<{ row: string; field: Field; quote: string } | null>(null);
  let draft = $state('');
  let draftMissing = $state(false);
  let replying = $state('');
  let reply = $state('');
  let active = $state('');
  let showResolved = $state(false);
  let box = $state<HTMLTextAreaElement>();

  const all = $derived(threads(notes));
  const open = $derived(all.filter((t) => !t.resolved));
  const resolved = $derived(all.filter((t) => t.resolved));
  const numbers = $derived(
    new Map(script.blocks.filter((b): b is Row => b.type === 'row').map((row, i) => [row.id, i + 1])),
  );

  // What a cell shows; files by their names, as in Write (a quote in Images & files is of what is shown).
  const text = (row: Row, field: Field) =>
    field === 'files' ? row.files.map((f) => readFileRef(f).label).join('\n') : field === 'on_screen' ? row.onScreen : row.dialogue;
  const marks = (row: Row, field: Field) =>
    open.filter((t) => t.comment.row === row.id && t.comment.field === field).map((t) => ({ id: t.comment.id, quote: t.comment.quote ?? '' }));

  function where(t: Thread): string {
    const n = numbers.get(t.comment.row ?? '');
    return n ? `row ${n}` : 'a deleted row';
  }

  // The quote is no longer in its row: the comment is on text that has since changed.
  function changed(t: Thread): boolean {
    const row = script.blocks.find((b): b is Row => b.type === 'row' && b.id === t.comment.row);
    return !!t.comment.quote && (!row || !text(row, t.comment.field ?? 'dialogue').includes(t.comment.quote));
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
    draftMissing = false;
    queueMicrotask(() => box?.focus());
  }

  async function send(e: SubmitEvent) {
    e.preventDefault();
    if (!target) return;
    if (!draft.trim()) return void ((draftMissing = true), box?.focus());
    if (await onAdd({ kind: 'comment', row: target.row, field: target.field, quote: target.quote, text: draft.trim() })) target = null;
  }

  async function sendReply(e: SubmitEvent, t: Thread) {
    e.preventDefault();
    if (!reply.trim()) return;
    if (await onAdd({ kind: 'reply', about: t.comment.id, text: reply.trim() })) (replying = ''), (reply = '');
  }
</script>

<div class="review">
  <div class="script">
    <p class="hint">Select any text to comment on it, or use Comment on a row.</p>
    <div class="head grid"><span>#</span><span>Dialogue</span><span>On screen</span><span>Images &amp; files</span></div>
    {#each script.blocks as block, i (i)}
      {#if block.type === 'section'}
        <h3 class="section">{block.title}</h3>
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
            <p class="cell {field}" aria-label="{name}, row {n}" onmouseup={(e) => select(block, field, e.currentTarget)}>
              {#each highlight(text(block, field), marks(block, field)) as part, j (j)}
                {#if part.id}<mark class:on={part.id === active}>{part.text}</mark>{:else}{part.text}{/if}
              {/each}
            </p>
          {/each}
        </div>
      {/if}
    {/each}
  </div>

  <aside aria-label="Comments">
    {#if target}
      <form class="card compose" aria-label="New comment" novalidate onsubmit={send}>
        <div class="who">Comment on row {numbers.get(target.row)}{target.quote ? ` · ${label(target.field)}` : ''}</div>
        {#if target.quote}<blockquote>{target.quote}</blockquote>{/if}
        <textarea bind:this={box} bind:value={draft} oninput={() => (draftMissing = false)} aria-label="Comment" rows="3"></textarea>
        {#if draftMissing}<p class="missing" role="alert">Write a comment first.</p>{/if}
        <div class="actions">
          <button class="primary small" type="submit">Comment</button>
          <button class="link" type="button" onclick={() => (target = null)}>Cancel</button>
        </div>
      </form>
    {/if}

    <h2>Open · {open.length}</h2>
    {#each open as t (t.comment.id)}
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
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
  <article class="card" class:active={t.comment.id === active} class:done={t.resolved} aria-label="Comment by {t.comment.who}"
    onclick={() => (active = t.comment.id)}>
    <div class="who"><span><strong>{t.comment.who}</strong> commented · {where(t)}</span><span>{ago(Date.parse(t.comment.when))}</span></div>
    {#if changed(t)}<p class="quiet">On text that has since changed: “{t.comment.quote}”</p>{/if}
    <p class="text">{t.comment.text}</p>
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
        {#if !t.resolved}
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
  .section { margin: 0; padding: 28px 12px 8px; font-size: 18px; font-weight: 600; border-bottom: 1px solid var(--line); }
  .row { align-items: start; padding-top: 20px; padding-bottom: 20px; border-bottom: 1px solid #f0f0f0; }
  .row.active { background: #f7f9fe; }
  .num { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; font-size: 13px; color: var(--muted); padding-top: 3px; }
  .add { padding: 2px 6px; margin-left: -6px; border: 0; border-radius: 6px; background: none; color: var(--muted); font-size: 12px; opacity: 0; }
  .row:hover .add, .add:focus { opacity: 1; }
  .add:hover { background: #f0f0f0; color: var(--ink); }
  .cell { margin: 0; line-height: 1.55; white-space: pre-wrap; }
  .dialogue { font-size: 17px; }
  .on_screen { font-size: 15px; color: #3d3d3d; }
  .files { font-size: 13px; color: #3d3d3d; }
  mark { background: #fff1c2; border-bottom: 2px solid #e0b100; color: inherit; }
  mark.on { background: #ffe38a; }
  h2 { margin: 0 0 4px; font-size: 14px; font-weight: 600; }
  .card { display: flex; flex-direction: column; gap: 10px; padding: 16px; border: 1px solid var(--line); border-radius: 10px; background: #fff; }
  .card.active { border-color: #b9c7ee; }
  .card.done { background: #fafafa; }
  .compose { border-color: var(--accent); }
  .who { display: flex; justify-content: space-between; gap: 8px; font-size: 13px; color: var(--muted); }
  .who strong { color: var(--ink); font-weight: 600; }
  .text { margin: 0; font-size: 14px; line-height: 1.5; white-space: pre-wrap; }
  .reply { display: flex; flex-direction: column; gap: 4px; padding-left: 12px; border-left: 2px solid var(--line); }
  blockquote { margin: 0; padding-left: 10px; border-left: 3px solid #e0b100; font-size: 14px; color: #3d3d3d; }
  textarea { font: inherit; font-size: 14px; padding: 8px 10px; border: 1px solid var(--line-strong); border-radius: 8px; resize: vertical; }
  .reply-form { display: flex; flex-direction: column; gap: 8px; }
  .actions { display: flex; gap: 8px; }
  .small { min-height: 40px; padding: 0 16px; font-size: 14px; }
  .missing { margin: 0; font-size: 13px; color: var(--danger); }
  .quiet { margin: 0; font-size: 13px; color: var(--muted); }
</style>
