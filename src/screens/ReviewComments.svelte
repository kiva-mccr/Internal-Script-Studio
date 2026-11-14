<script lang="ts">
  import { onDestroy } from 'svelte';
  import { Linger } from '../lib/linger.svelte';
  import { slideAway } from '../lib/slide';
  import { quoteGone, threads, type Field, type Note, type Thread } from '../lib/comments';
  import { heading, sortThreads, toSort, SORT_KEY } from '../lib/commentsort';
  import { recall } from '../lib/remember';
  import type { Row } from '../lib/script';
  import AttachBox from './AttachBox.svelte';
  import CommentCard from './CommentCard.svelte';
  import SortSwitch from './SortSwitch.svelte';

  // Review's comments, beside the script (mock-up 4): the new comment box, then the open cards, On hold and Resolved.
  // Review opens the box with `start` (a row's Comment, or the Comment button on selected words).
  let {
    dir,
    notes,
    ends,
    me,
    rows,
    numbers,
    active = $bindable(),
    onAdd,
    onApply,
  }: {
    dir: FileSystemDirectoryHandle; // files on comments (RV-11) are read from it
    notes: Note[];
    ends: string[]; // sends for review and official versions: holds before one are over (RV-19)
    me: string; // Edit and Delete show on what this person wrote (RV-7)
    rows: Row[]; // the script's rows, for sorting by Line and spotting quotes that are gone
    numbers: Map<string, number>; // each row's number
    active: string; // the card picked: its quote is marked brighter in the script
    onAdd: (note: Omit<Note, 'v' | 'id' | 'when' | 'who'>, files?: File[]) => Promise<boolean>;
    onApply: (row: string, field: Field, from: string, to: string) => boolean;
  } = $props();

  const LABELS: Record<Field, string> = { dialogue: 'Dialogue', on_screen: 'On screen', files: 'Images & files' };

  let target = $state<{ row: string; field: Field; quote: string } | null>(null);
  let draft = $state('');
  let draftFiles = $state<File[]>([]);
  let draftMissing = $state('');
  let suggesting = $state(false);
  let showResolved = $state(false);
  let showHeld = $state(false);
  let box = $state<HTMLTextAreaElement>();

  let recent = $state<string[]>([]); // decided here just now: kept in place, with Undo (mock-up 4)
  let gone = $state<string[]>([]); // deleted here just now: kept in place as "… deleted. Undo" (RV-7, mock-up 24)
  // Put on hold here (RV-19): in place with Undo for 5 seconds, then into On hold, sliding away.
  const holding = new Linger();
  onDestroy(() => holding.clear());
  // Deleted ones are kept only while they are in `gone`.
  const all = $derived(
    threads(notes, true, ends)
      .filter((t) => !t.deleted || gone.includes(t.comment.id))
      .map((t) => ({ ...t, replies: t.replies.filter((r) => !r.deleted || gone.includes(r.id)) })),
  );
  const open = $derived(all.filter((t) => !t.deleted && !t.resolved && !t.held));
  let sort = $state(toSort(recall(SORT_KEY))); // RV-16: Line by default, or Time or Type
  const sorted = $derived(sortThreads(all, sort, rows));
  const shown = $derived(sorted.filter((t) => (!t.resolved && !t.held) || recent.includes(t.comment.id) || holding.has(t.comment.id)));
  const held = $derived(sorted.filter((t) => !t.resolved && t.held && !holding.has(t.comment.id)));
  const resolved = $derived(sorted.filter((t) => t.resolved && !recent.includes(t.comment.id)));

  function where(t: Thread): string {
    const n = numbers.get(t.comment.row ?? '');
    return n ? `row ${n}` : 'a deleted row';
  }

  export function start(t: { row: string; field: Field; quote: string }) {
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

  // Deleted ones stay in place as "… deleted. Undo" while their id is in `gone` (RV-7).
  const setGone = (id: string, deleted: boolean) => (gone = deleted ? [...gone, id] : gone.filter((g) => g !== id));
</script>

<aside aria-label="Comments" data-tour="review-cards">
  {#if target}
    <form class="card compose" aria-label="New comment" novalidate onsubmit={send}>
      <div class="who">{suggesting ? 'Suggest a change to' : 'Comment on'} row {numbers.get(target.row)}{target.quote ? ` · ${LABELS[target.field]}` : ''}</div>
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

  <div class="open">
    <h2>Open · {open.length}</h2>
    {#if all.length}<SortSwitch bind:sort />{/if}
  </div>
  {#each shown as t, i (t.comment.id)}
    {#if heading(shown, i, sort)}<h3 class="kind">{heading(shown, i, sort)}</h3>{/if}
    <div class="slot" out:slideAway>{@render card(t)}</div>
  {:else}
    <p class="quiet">No open comments.</p>
  {/each}

  {#if held.length}
    <button class="link" aria-expanded={showHeld} onclick={() => (showHeld = !showHeld)}>
      {showHeld ? '▾' : '▸'} On hold · {held.length}
    </button>
    {#if showHeld}
      <p class="quiet">Back in the open list at the next Send for review or official version.</p>
      {#each held as t (t.comment.id)}<div class="slot" out:slideAway>{@render card(t)}</div>{/each}
    {/if}
  {/if}

  {#if resolved.length}
    <button class="link" aria-expanded={showResolved} onclick={() => (showResolved = !showResolved)}>
      {showResolved ? '▾' : '▸'} Resolved · {resolved.length}
    </button>
    {#if showResolved}{#each resolved as t (t.comment.id)}<div class="slot" out:slideAway>{@render card(t)}</div>{/each}{/if}
  {/if}
</aside>

{#snippet card(t: Thread)}
  <CommentCard {t} {dir} {me} where={where(t)} gone={quoteGone(t.comment, rows)} active={t.comment.id === active} recent={recent.includes(t.comment.id) || holding.has(t.comment.id)}
    onActivate={() => (active = t.comment.id)} {onAdd} {onApply} onDecided={(id) => (recent = [...recent, id])} onHeld={(id) => holding.add(id)} onGone={setGone} />
{/snippet}

<style>
  aside { flex: 1 1 300px; display: flex; flex-direction: column; gap: 12px; position: sticky; top: 16px; }
  h2 { margin: 0; font-size: 14px; font-weight: 600; }
  .open { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 4px 8px; }
  .kind { margin: 4px 0 0; font-size: 12px; font-weight: 600; color: var(--muted); }
  .card { display: flex; flex-direction: column; gap: 10px; padding: 16px; border: 1px solid var(--line); border-radius: 10px; background: #fff; }
  .compose { border-color: var(--accent); }
  .who { display: flex; justify-content: space-between; gap: 8px; font-size: 13px; color: var(--muted); }
  .switch { display: flex; gap: 2px; padding: 3px; border-radius: 8px; background: #f2f2f2; align-self: flex-start; }
  .switch button { min-height: 32px; padding: 0 12px; border: 0; border-radius: 6px; background: none; color: var(--muted); font-size: 13px; }
  .switch button[aria-pressed='true'] { background: #fff; color: var(--ink); box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08); }
  blockquote { margin: 0; padding-left: 10px; border-left: 3px solid #e0b100; font-size: 14px; color: #3d3d3d; }
  textarea { font: inherit; font-size: 14px; padding: 8px 10px; border: 1px solid var(--line-strong); border-radius: 8px; resize: vertical; }
  .actions { display: flex; flex-wrap: wrap; gap: 8px; }
  .small { min-height: 40px; padding: 0 16px; font-size: 14px; }
  .missing { margin: 0; font-size: 13px; color: var(--danger); }
  .quiet { margin: 0; font-size: 13px; color: var(--muted); }
  .slot { display: flex; flex-direction: column; }
</style>
