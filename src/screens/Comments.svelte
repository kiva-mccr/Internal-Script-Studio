<script lang="ts">
  import { onDestroy, tick, untrack } from 'svelte';
  import { quoteGone, threads, type Attachment, type Field, type Note } from '../lib/comments';
  import type { Version } from '../lib/history';
  import type { Row, Script } from '../lib/script';
  import { ago } from '../lib/when';
  import CommentCard from './CommentCard.svelte';

  // Write's Comments tab (RV-13, board 37 idea A): the writer replies, resolves and accepts or rejects suggestions
  // beside the text. New comments are started in Review. A card takes you to its row (onShow).
  let {
    dir,
    script,
    notes,
    me,
    back,
    active = $bindable(),
    goTo = 0,
    onAdd,
    onApply,
    onShow,
    onUse,
  }: {
    dir: FileSystemDirectoryHandle;
    script: Script;
    notes: Note[];
    me: string;
    back?: Version; // the send back (its note at the top), while the script is a draft again
    active: string; // the card being read; its quote is marked darker in Write
    goTo?: number; // bumped each time Write asks for `active` (a bubble or a quote), even the same one again (RV-17)
    onAdd: (note: Omit<Note, 'v' | 'id' | 'when' | 'who'>, files?: File[]) => Promise<boolean>;
    onApply: (row: string, field: Field, from: string, to: string) => boolean;
    onShow: (row: string) => void;
    onUse: (row: string, item: Attachment, from: string) => Promise<boolean>; // "Use in script" (RV-12)
  } = $props();

  const LABELS: Record<Field, string> = { dialogue: 'Dialogue', on_screen: 'On screen', files: 'Images & files' };
  let recent = $state<string[]>([]); // decided or resolved here: kept in place with Undo for a few seconds (RV-18)
  let gone = $state<string[]>([]); // deleted here: kept as "… deleted. Undo"
  let showResolved = $state(false);
  const all = $derived(
    threads(notes, true)
      .filter((t) => !t.deleted || gone.includes(t.comment.id))
      .map((t) => ({ ...t, replies: t.replies.filter((r) => !r.deleted || gone.includes(r.id)) })),
  );
  const shown = $derived(all.filter((t) => !t.resolved || recent.includes(t.comment.id)));
  const resolved = $derived(all.filter((t) => t.resolved && !recent.includes(t.comment.id)));
  const rows = $derived(script.blocks.filter((b): b is Row => b.type === 'row'));
  const numbers = $derived(new Map(rows.map((row, i) => [row.id, i + 1])));

  // "Use in script" (RV-12) on an open card's files, into its row; none for a deleted row.
  function use(c: Note) {
    const row = rows.find((r) => r.id === c.row);
    if (!row) return undefined;
    return { row: numbers.get(row.id)!, lines: row.files, add: (item: Attachment, from: string) => onUse(row.id, item, from) };
  }

  function where(c: Note) {
    const n = numbers.get(c.row ?? '');
    if (!n) return 'a deleted row';
    return c.quote ? `row ${n}, ${LABELS[c.field ?? 'dialogue']}` : `row ${n}`;
  }

  // Decided or resolved here: in place with Undo for 5 seconds, then into Resolved by itself (RV-18). Undo within
  // that time leaves it open; deciding it again starts a new wait.
  const WAIT = 5000;
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  function decided(id: string) {
    clearTimeout(timers.get(id));
    recent = [...recent.filter((r) => r !== id), id];
    timers.set(id, setTimeout(() => (timers.delete(id), (recent = recent.filter((r) => r !== id))), WAIT));
  }
  onDestroy(() => timers.forEach(clearTimeout));

  // A bubble or a quote in Write picked a card: bring it into view in the panel, every time it is asked for, even
  // when it is already the one being read (RV-17), and flash its outline so the eye finds it (RV-20).
  let list = $state<HTMLElement>();
  $effect(() => {
    void goTo;
    const id = untrack(() => active);
    tick().then(() => {
      const card = list?.querySelector<HTMLElement>(`[data-id="${id}"]`);
      if (!card) return;
      card.scrollIntoView({ block: 'nearest' });
      if (!matchMedia('(prefers-reduced-motion: reduce)').matches)
        card.animate([{ boxShadow: '0 0 0 1px #2a5bd7, 0 0 0 10px #b9cbf5' }, {}], { duration: 700, easing: 'ease-out' });
    });
  });
</script>

<div class="comments" bind:this={list}>
  {#if back}
    <div class="back" role="note" aria-label="Note from {back.who}">
      <p><b>{back.who}</b> sent it back · {ago(Date.parse(back.when))}</p>
      {#if back.message}<p class="message">{back.message}</p>{/if}
    </div>
  {/if}
  {#each shown as t (t.comment.id)}
    <CommentCard {t} {dir} {me} where={where(t.comment)} gone={quoteGone(t.comment, rows)} active={t.comment.id === active}
      recent={recent.includes(t.comment.id)} undoResolve use={t.resolved ? undefined : use(t.comment)} onActivate={() => ((active = t.comment.id), t.comment.row && onShow(t.comment.row))}
      {onAdd} {onApply} onDecided={decided}
      onGone={(id, deleted) => (gone = deleted ? [...gone, id] : gone.filter((g) => g !== id))} />
  {:else}
    <p class="quiet">No open comments.</p>
  {/each}
  {#if resolved.length}
    <button class="link" aria-expanded={showResolved} onclick={() => (showResolved = !showResolved)}>
      {showResolved ? '▾' : '▸'} Resolved · {resolved.length}
    </button>
    {#if showResolved}
      {#each resolved as t (t.comment.id)}
        <CommentCard {t} {dir} {me} where={where(t.comment)} gone={quoteGone(t.comment, rows)} active={false} onActivate={() => {}}
          {onAdd} {onApply} onDecided={() => {}} onGone={() => {}} />
      {/each}
    {/if}
  {/if}
  <p class="quiet">Click a card to go to its row. New comments are started in Review.</p>
</div>

<style>
  .comments { display: flex; flex-direction: column; gap: 10px; }
  .back { padding: 10px 12px; border-radius: 8px; background: #fff4e5; font-size: 13px; line-height: 1.5; color: #3d3d3d; }
  .back p { margin: 0; }
  .back b { color: var(--ink); font-weight: 600; }
  .message { margin-top: 2px; white-space: pre-wrap; overflow-wrap: anywhere; }
  .link { align-self: flex-start; }
  .quiet { margin: 0; font-size: 12px; color: var(--muted); }
</style>
