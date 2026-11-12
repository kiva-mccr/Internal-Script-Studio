<script lang="ts">
  import { tick } from 'svelte';
  import { threads, type Attachment, type Field, type Flag, type Note, type Thread } from '../lib/comments';
  import AttachBox from './AttachBox.svelte';
  import Attached from './Attached.svelte';
  import FlagIcon from './FlagIcon.svelte';
  import { plain, rangeOf, renderMath, toHtml } from '../lib/format';
  import { parseScript, readFileRef, type Row, type Script } from '../lib/script';
  import { keep, recall } from '../lib/remember';
  import { clock, sectionWords, speaking } from '../lib/readtime.svelte';
  import { ago, at } from '../lib/when';
  import { sinceReview, type Version } from '../lib/history';

  // Review (mock-up 4): the script to read, and comments beside it. Select text in a cell to comment or suggest a
  // change, or use Comment on a row; reply and resolve comments, accept or reject suggestions.
  let {
    dir,
    script,
    notes,
    flagged,
    me,
    sent,
    reviewedAt,
    onAdd,
    onApply,
  }: {
    dir: FileSystemDirectoryHandle; // the script's folder: files on comments (RV-11) are read from it
    script: Script;
    notes: Note[];
    flagged: Map<string, Flag>; // flagged rows (AP-9): shown with their note, cleared only in Write
    me: string; // this person's name: Edit and Delete show on what they wrote (RV-7)
    sent?: Version; // the note sent with it for review (RV-8), shown at the top while it is in review
    reviewedAt?: Version; // when the last review ended (RV-4): rows changed since are marked
    // `files`: new files to attach to it (RV-11).
    onAdd: (note: Omit<Note, 'v' | 'id' | 'when' | 'who'>, files?: File[]) => Promise<boolean>;
    // Replaces `from` with `to` in a row's field (Write's text); false if `from` is no longer there.
    onApply: (row: string, field: Field, from: string, to: string) => boolean;
  } = $props();

  const FIELDS: [Field, string][] = [['dialogue', 'Dialogue'], ['on_screen', 'On screen'], ['files', 'Images & files']];
  const label = (field?: Field) => FIELDS.find(([f]) => f === field)?.[1] ?? '';

  let target = $state<{ row: string; field: Field; quote: string } | null>(null);
  let draft = $state('');
  let hideSent = $state(false); // the review note folded to a button (RV-8), until Review is left
  let draftFiles = $state<File[]>([]);
  let draftMissing = $state('');
  let suggesting = $state(false);
  let replying = $state('');
  let reply = $state('');
  let replyFiles = $state<File[]>([]);
  let active = $state('');
  let showResolved = $state(false);
  let box = $state<HTMLTextAreaElement>();

  let recent = $state<string[]>([]); // decided here just now: kept in place, with Undo (mock-up 4)
  let gone = $state<string[]>([]); // deleted here just now: kept in place as "… deleted. Undo" (RV-7, mock-up 24)
  // Deleted ones are kept only while they are in `gone`.
  const all = $derived(
    threads(notes, true)
      .filter((t) => !t.deleted || gone.includes(t.comment.id))
      .map((t) => ({ ...t, replies: t.replies.filter((r) => !r.deleted || gone.includes(r.id)) })),
  );
  const live = $derived(all.filter((t) => !t.deleted));
  const open = $derived(live.filter((t) => !t.resolved));
  const shown = $derived(all.filter((t) => !t.resolved || recent.includes(t.comment.id)));
  const resolved = $derived(all.filter((t) => t.resolved && !recent.includes(t.comment.id)));

  // Editing your own (RV-7): one comment, suggestion or reply at a time, in place.
  let editing = $state('');
  let edit = $state('');
  let editKept = $state<Attachment[]>([]); // files the edited one keeps (RV-11)
  let editFiles = $state<File[]>([]); // and new ones
  let editMissing = $state('');
  const mine = (n: Note, t: Thread) => n.who === me && !t.resolved;

  function startEdit(n: Note) {
    editing = n.id;
    edit = (n.kind === 'suggestion' ? n.replace : n.text) ?? '';
    editKept = n.files ?? [];
    editFiles = [];
    editMissing = '';
  }

  async function saveEdit(e: SubmitEvent, n: Note) {
    e.preventDefault();
    const suggestion = n.kind === 'suggestion';
    const now = suggestion ? edit : edit.trim();
    if (suggestion) {
      if (!now.trim()) return void (editMissing = 'Write something first, or Delete it.');
      if (now === n.quote) return void (editMissing = 'Change the text first.');
      if (now === n.replace) return void (editing = '');
      if (await onAdd({ kind: 'edit', about: n.id, replace: now })) editing = '';
      return;
    }
    const filesChanged = editFiles.length > 0 || editKept.length !== (n.files ?? []).length;
    if (!now && !editKept.length && !editFiles.length) return void (editMissing = 'Write something first, or Delete it.');
    if (now === n.text && !filesChanged) return void (editing = '');
    const entry = { kind: 'edit' as const, about: n.id, text: now, ...(filesChanged ? { files: editKept } : {}) };
    if (await onAdd(entry, editFiles)) editing = '';
  }

  async function remove(n: Note) {
    if (await onAdd({ kind: 'delete', about: n.id })) (gone = [...gone, n.id]), (editing = '');
  }

  async function restore(n: Note) {
    if (await onAdd({ kind: 'undelete', about: n.id })) gone = gone.filter((id) => id !== n.id);
  }
  const words = $derived(sectionWords(script)); // each section's read time (AP-12)
  const numbers = $derived(
    new Map(script.blocks.filter((b): b is Row => b.type === 'row').map((row, i) => [row.id, i + 1])),
  );

  // What a cell shows; files by their names, as in Write (a quote in Images & files is of what is shown).
  const text = (row: Row, field: Field) =>
    field === 'files' ? row.files.map((f) => readFileRef(f).label).join('\n') : field === 'on_screen' ? row.onScreen : row.dialogue;
  let table = $state<HTMLElement>();

  // What's changed since the last review (RV-4, mock-up 28). On unless this person turned it off; Show the edits is
  // remembered too, Only changed rows is not.
  let marking = $state(recall('review-changes') !== 'off');
  let showEdits = $state(!!recall('review-edits'));
  let onlyChanged = $state(false);
  const since = $derived(reviewedAt ? sinceReview(parseScript(reviewedAt.text), script) : null);
  const marks = $derived(marking ? since : null);
  const removedAfter = $derived.by(() => {
    const map = new Map<string, Row[]>();
    for (const { after, row } of marks?.removed ?? []) map.set(after, [...(map.get(after) ?? []), row]);
    return map;
  });
  const plural = (n: number, what: string) => `${n} ${n === 1 ? 'row' : 'rows'} ${what}`;
  const sinceText = $derived.by(() => {
    if (!since || !reviewedAt) return { what: '', when: '' };
    const parts = [since.changed.size && plural(since.changed.size, 'changed'), since.removed.length && plural(since.removed.length, 'removed')];
    const verb = reviewedAt.note.startsWith('Approved') ? 'approved it' : 'sent it back';
    return { what: parts.filter(Boolean).join(' · ') || 'Nothing changed', when: `since ${reviewedAt.who} ${verb} · ${at(Date.parse(reviewedAt.when))}` };
  });
  // Only changed rows: each run of unchanged rows folds to one line, shown at its first row.
  const folds = $derived.by(() => {
    const label = new Map<string, string>();
    const skip = new Set<string>();
    if (!marks || !onlyChanged) return { label, skip };
    let run: Row[] = [];
    const end = () => {
      if (!run.length) return;
      const [a, b] = [numbers.get(run[0].id), numbers.get(run.at(-1)!.id)];
      label.set(run[0].id, run.length === 1 ? `Row ${a} unchanged` : `Rows ${a}–${b} unchanged`);
      run.slice(1).forEach((row) => skip.add(row.id));
      run = [];
    };
    for (const block of script.blocks) {
      if (block.type !== 'row' || marks.changed.has(block.id)) end();
      else {
        run.push(block);
        if (removedAfter.has(block.id)) end(); // a removed row's line sits after it
      }
    }
    end();
    return { label, skip };
  });

  // Each open comment's quote is marked in its cell with the browser's highlights (CSS.highlights), which can
  // cross bold, links and so on without changing the page.
  $effect(() => {
    const list = open;
    const on = active;
    void [script, marks, showEdits, onlyChanged]; // each redraws the cells
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
    draftFiles = [];
    draftMissing = '';
    suggesting = false;
    queueMicrotask(() => box?.focus());
  }

  // Suggesting starts from the selected words, ready to change.
  function suggest(on: boolean) {
    suggesting = on;
    draft = on ? target!.quote : '';
    draftFiles = []; // a suggestion is only words
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
    if (!draft.trim() && !draftFiles.length) return void ((draftMissing = 'Write a comment first.'), box?.focus());
    if (await onAdd({ kind: 'comment', row, field, quote, text: draft.trim() }, draftFiles)) target = null;
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
    if (!reply.trim() && !replyFiles.length) return;
    if (await onAdd({ kind: 'reply', about: t.comment.id, text: reply.trim() }, replyFiles)) (replying = ''), (reply = ''), (replyFiles = []);
  }
</script>

<div class="review">
  <div class="script" bind:this={table}>
    {#if sent && !hideSent}
      <div class="sent" role="note" aria-label="Note from {sent.who}">
        <div>
          <p class="from"><b>{sent.who}</b> sent this for review · {at(Date.parse(sent.when))}</p>
          <p class="message">{sent.message}</p>
        </div>
        <button class="fold" aria-expanded="true" onclick={() => (hideSent = true)}>Hide</button>
      </div>
    {:else if sent}
      <button class="sent-folded" aria-expanded="false" onclick={() => (hideSent = false)}>{sent.who}'s note</button>
    {/if}
    <p class="hint">Select any text to comment or suggest a change. The writer accepts or rejects each suggestion.</p>
    {#if since}
      <div class="changes" class:off={!marking} role="group" aria-label="What's changed">
        <label class="tick"><input type="checkbox" bind:checked={marking} onchange={() => keep('review-changes', marking ? '' : 'off')} /> What's changed</label>
        {#if marking}
          <span class="what"><b>{sinceText.what}</b> {sinceText.when}</span>
          {#if since.changed.size || since.removed.length}
            <label class="tick"><input type="checkbox" bind:checked={onlyChanged} /> Only changed rows</label>
            <label class="tick"><input type="checkbox" bind:checked={showEdits} onchange={() => keep('review-edits', showEdits ? '1' : '')} /> Show the edits</label>
          {/if}
        {:else}
          <span class="what">Off: the script shows as it is, with no marks.</span>
        {/if}
      </div>
    {/if}
    <div class="head grid"><span>#</span><span>Dialogue</span><span>On screen</span><span>Images &amp; files</span></div>
    {@render removedRows('')}
    {#each script.blocks as block, i (i)}
      {#if block.type === 'section'}
        <h3 class="section"><span>{block.title}</span>{#if words.get(block)}<span class="time" title="{words.get(block)} words at {speaking.wpm} words a minute">{clock((words.get(block)! / speaking.wpm) * 60)}</span>{/if}</h3>
      {:else if folds.label.has(block.id)}
        <p class="folded">{folds.label.get(block.id)}</p>
        {@render removedRows(block.id)}
      {:else if !folds.skip.has(block.id)}
        {@const n = numbers.get(block.id)}
        {@const was = marks?.changed.get(block.id)}
        <div class="row grid" class:active={open.some((t) => t.comment.id === active && t.comment.row === block.id)}
          class:changed={was !== undefined}>
          <div class="num">
            <span>{n}</span>
            {#if was !== undefined}<span class="tag">{was ? 'Changed' : 'New'}</span>{/if}
            <button class="add" aria-label="Comment on row {n}" title="Comment on this row"
              onclick={() => start({ row: block.id, field: 'dialogue', quote: '' })}>Comment</button>
          </div>
          {#each FIELDS as [field, name] (field)}
            {#snippet cell()}
              <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
              <p class="cell {field}" aria-label="{name}, row {n}" data-row={block.id} data-field={field}
                onmouseup={(e) => select(block, field, e.currentTarget)}>{@html toHtml(text(block, field))}</p>
            {/snippet}
            {#if showEdits && was && text(was, field) !== text(block, field)}
              <!-- Show the edits (RV-4): the old text struck through above the new, as in History. -->
              <div class="edited"><p class="was {field}" aria-label="{name} before, row {n}">{@html toHtml(text(was, field))}</p>{@render cell()}</div>
            {:else}
              {@render cell()}
            {/if}
          {/each}
          {#if flagged.get(block.id)}
            {@const flag = flagged.get(block.id)!}
            <p class="flag-note" aria-label="Flag, row {n}"><FlagIcon size={13} /><span>{flag.text || 'Flagged'}</span><span class="by">{flag.who}</span></p>
          {/if}
        </div>
        {@render removedRows(block.id)}
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
        {#snippet typing()}
          <textarea bind:this={box} bind:value={draft} oninput={() => (draftMissing = '')} aria-label={suggesting ? 'Replace with' : 'Comment'} rows="3"></textarea>
          {#if draftMissing}<p class="missing" role="alert">{draftMissing}</p>{/if}
        {/snippet}
        {#snippet buttons()}
          <button class="primary small" type="submit">{suggesting ? 'Add suggestion' : 'Add comment'}</button>
          <button class="link" type="button" onclick={() => (target = null)}>Cancel</button>
        {/snippet}
        {#if suggesting}
          {@render typing()}
          <div class="actions">{@render buttons()}</div>
        {:else}
          <AttachBox {dir} bind:files={draftFiles} actions={buttons}>{@render typing()}</AttachBox>
        {/if}
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
  {#if t.deleted}
    <p class="card deleted" data-id={t.comment.id}>{suggestion ? 'Suggestion' : 'Comment'} deleted. <button class="link inline" onclick={() => restore(t.comment)}>Undo</button></p>
  {:else}
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
  <article class="card" data-id={t.comment.id} class:active={t.comment.id === active} class:done={t.resolved} aria-label="{t.comment.kind === 'suggestion' ? 'Suggestion' : 'Comment'} by {t.comment.who}"
    onclick={() => (active = t.comment.id)}>
    <div class="who"><span><strong>{t.comment.who}</strong> {suggestion ? 'suggested' : 'commented'} · {where(t)}</span><span>{@render time(t.comment)}</span></div>
    {#if changed(t) && !t.decision}<p class="quiet">On text that has since changed: “{t.comment.quote}”</p>{/if}
    {#if editing === t.comment.id}
      {#if t.comment.quote}<blockquote>{t.comment.quote}</blockquote>{/if}
      {@render editor(t.comment, suggestion ? 'Replace with' : 'Edit comment')}
    {:else if suggestion}
      <p class="text">Replace “<span class="old">{t.comment.quote}</span>” with “<span class="new">{t.comment.replace}</span>”.</p>
    {:else}
      {#if t.comment.text}<p class="text">{t.comment.text}</p>{/if}
      {#if t.comment.files?.length}<Attached {dir} files={t.comment.files} />{/if}
    {/if}
    {#each t.replies as r (r.id)}
      {#if r.deleted}
        <p class="reply quiet">Reply deleted. <button class="link inline" onclick={() => restore(r)}>Undo</button></p>
      {:else}
        <div class="reply">
          <div class="who"><strong>{r.who}</strong><span class="when">{@render time(r)}{#if mine(r, t) && editing !== r.id}<button class="link inline" onclick={() => startEdit(r)}>Edit</button><button class="link inline" onclick={() => remove(r)}>Delete</button>{/if}</span></div>
          {#if editing === r.id}{@render editor(r, 'Edit reply')}{:else}{#if r.text}<p class="text">{r.text}</p>{/if}{#if r.files?.length}<Attached {dir} files={r.files} />{/if}{/if}
        </div>
      {/if}
    {/each}
    {#if editing === t.comment.id}
      <!-- Its own edit box is open above: no other actions until Save or Cancel. -->
    {:else if replying === t.comment.id}
      <form class="reply-form" onsubmit={(e) => sendReply(e, t)}>
        {#snippet buttons()}
          <button class="primary small" type="submit">Reply</button>
          <button class="link" type="button" onclick={() => (replying = '')}>Cancel</button>
        {/snippet}
        <AttachBox {dir} bind:files={replyFiles} actions={buttons}><textarea bind:value={reply} aria-label="Reply" rows="2"></textarea></AttachBox>
      </form>
    {:else}
      <div class="actions">
        {#if suggestion && t.decision}
          <span class="decided">{t.decision === 'accepted' ? 'Accepted. The script is updated.' : 'Rejected. The original stays.'}</span>
          <button class="link" onclick={() => undo(t)}>Undo</button>
        {:else if suggestion}
          <button class="primary small" onclick={() => decide(t, true)}>Accept</button>
          <button class="outline" onclick={() => decide(t, false)}>Reject</button>
          <button class="link" onclick={() => ((replying = t.comment.id), (reply = ''), (replyFiles = []))}>Reply</button>
          {@render own(t)}
        {:else if !t.resolved}
          <button class="outline" onclick={() => ((replying = t.comment.id), (reply = ''), (replyFiles = []))}>Reply</button>
          <button class="link" onclick={() => onAdd({ kind: 'resolve', about: t.comment.id })}>Resolve</button>
          {@render own(t)}
        {:else}
          <button class="link" onclick={() => onAdd({ kind: 'reopen', about: t.comment.id })}>Reopen</button>
        {/if}
      </div>
    {/if}
  </article>
  {/if}
{/snippet}

<!-- Rows removed since the last review (RV-4): one grey struck line each, where they were. -->
{#snippet removedRows(after: string)}
  {#each removedAfter.get(after) ?? [] as row (row.id)}
    <p class="removed grid"><span class="tag">Removed</span><s>{plain(row.dialogue || row.onScreen || row.files.join(', ')) || '(empty row)'}</s></p>
  {/each}
{/snippet}

{#snippet own(t: Thread)}
  {#if mine(t.comment, t) && editing !== t.comment.id}
    <span class="own">
      <button class="link compact" onclick={() => startEdit(t.comment)}>Edit</button>
      <button class="link compact" onclick={() => remove(t.comment)}>Delete</button>
    </span>
  {/if}
{/snippet}

{#snippet time(n: Note)}
  {ago(Date.parse(n.when))}{#if n.edited}<span title="Edited {ago(Date.parse(n.edited))}"> · edited</span>{/if}
{/snippet}

<!-- The edit box (RV-7): in place, Save and Cancel; Esc cancels. -->
{#snippet editor(n: Note, name: string)}
  <form class="reply-form" novalidate onsubmit={(e) => saveEdit(e, n)}>
    {#snippet typing()}
      <!-- svelte-ignore a11y_autofocus -->
      <textarea bind:value={edit} oninput={() => (editMissing = '')} onkeydown={(e) => e.key === 'Escape' && (editing = '')}
        aria-label={name} rows={n.kind === 'reply' ? 2 : 3} autofocus></textarea>
      {#if editMissing}<p class="missing" role="alert">{editMissing}</p>{/if}
    {/snippet}
    {#snippet buttons()}
      <button class="primary small" type="submit">Save</button>
      <button class="link" type="button" onclick={() => (editing = '')}>Cancel</button>
    {/snippet}
    {#if n.kind === 'suggestion'}
      {@render typing()}
      <div class="actions">{@render buttons()}</div>
    {:else}
      <!-- Editing can take files off or add new ones (RV-11, with RV-7). -->
      <AttachBox {dir} bind:files={editFiles} bind:kept={editKept} actions={buttons}>{@render typing()}</AttachBox>
    {/if}
  </form>
{/snippet}

<style>
  .sent { display: flex; gap: 12px; align-items: flex-start; margin: 0 0 20px; padding: 14px 16px; border: 1px solid #d6e0f7;
    border-radius: 10px; background: #f5f8fe; }
  .sent > div { flex: 1; min-width: 0; }
  .sent p { margin: 0; }
  .sent .from { margin-bottom: 4px; font-size: 13px; color: var(--muted); }
  .from b { color: var(--ink); font-weight: 600; }
  .message { font-size: 15px; line-height: 1.55; white-space: pre-wrap; overflow-wrap: anywhere; }
  .sent .fold, .sent-folded { flex: none; min-height: 44px; padding: 0 12px; border-radius: 8px; color: var(--accent); font-size: 13px; font-weight: 500; }
  .sent .fold { border: 0; background: none; }
  .sent-folded { display: block; margin: 0 0 20px; border: 1px solid #d6e0f7; background: #f5f8fe; }
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
  /* What's changed (RV-4): a blue bar at the row's edge, a grey one for a removed row. */
  .changes { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 12px; margin: 0 0 16px; padding: 4px 8px 4px 4px; border-radius: 8px; background: #eef2fb; font-size: 14px; }
  .changes.off { background: #f2f2f2; }
  .changes .what { flex: 1 1 300px; }
  .changes.off .what { color: var(--muted); }
  .what b { font-weight: 600; }
  .tick { display: inline-flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 10px; cursor: pointer; }
  .tick input { width: 18px; height: 18px; margin: 0; accent-color: var(--accent); }
  .row.changed { box-shadow: inset 4px 0 0 var(--accent); }
  .tag { font-size: 11px; font-weight: 600; color: var(--accent-dark); }
  .removed { align-items: center; margin: 0; padding-top: 8px; padding-bottom: 8px; border-bottom: 1px solid #f0f0f0; box-shadow: inset 4px 0 0 #9a9a9a; }
  .removed .tag { color: var(--muted); }
  .removed s { grid-column: 2 / -1; font-size: 14px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .folded { margin: 0; padding: 8px 12px; border-bottom: 1px solid #f0f0f0; font-size: 13px; color: var(--muted); }
  .edited { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
  .was { margin: 0; line-height: 1.55; white-space: pre-wrap; color: #8a2b2b; text-decoration: line-through; }
  .edited .cell { color: #1b6b3e; }
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
  .actions { display: flex; flex-wrap: wrap; gap: 8px; }
  .own { display: flex; margin-left: auto; }
  .compact { padding: 0 6px; }
  .when { display: inline-flex; align-items: center; gap: 2px; }
  .inline { min-height: 28px; padding: 0 6px; font-size: 13px; }
  .deleted { flex-direction: row; align-items: center; margin: 0; padding: 10px 16px; border-style: dashed; font-size: 13px; color: var(--muted); }
  .small { min-height: 40px; padding: 0 16px; font-size: 14px; }
  .missing { margin: 0; font-size: 13px; color: var(--danger); }
  .quiet { margin: 0; font-size: 13px; color: var(--muted); }
</style>
