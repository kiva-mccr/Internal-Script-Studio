<script lang="ts">
  import { problem } from '../lib/problems';
  import { tick } from 'svelte';
  import { fieldText as text, threads, type Field, type Flag, type Note } from '../lib/comments';
  import FlagIcon from './FlagIcon.svelte';
  import ReviewComments from './ReviewComments.svelte';
  import SelectionComment from './SelectionComment.svelte';
  import Take from './Take.svelte';
  import type { Player } from '../lib/play.svelte';
  import type { VoiceOver } from '../lib/voice.svelte';
  import { plain, rangeOf, renderMath, toHtml } from '../lib/format';
  import { parseScript, type Row, type Script } from '../lib/script';
  import { keep, recall } from '../lib/remember';
  import { clock, sectionWords, speaking } from '../lib/readtime.svelte';
  import { at } from '../lib/when';
  import { sinceReview, type Version } from '../lib/history';
  import type { Marks } from '../lib/visit';

  // Review (mock-up 4): the script to read, and comments beside it. Select text in a cell, then its Comment button, to
  // comment or suggest a change, or use Comment on a row; reply and resolve comments, accept or reject suggestions.
  let {
    dir,
    script,
    notes,
    ends,
    flagged,
    me,
    sent,
    reviewedAt,
    visit,
    voice,
    player,
    canPlay,
    onAdd,
    onApply,
    onPlayFrom,
    onNotice,
  }: {
    dir: FileSystemDirectoryHandle; // the script's folder: files on comments (RV-11) are read from it
    script: Script;
    notes: Note[];
    ends: string[]; // sends for review and official versions: holds before one are over (RV-19)
    flagged: Map<string, Flag>; // flagged rows (AP-9): shown with their note, cleared only in Write
    me: string; // this person's name: Edit and Delete show on what they wrote (RV-7)
    sent?: Version; // the note sent with it for review (RV-8), shown at the top while it is in review
    reviewedAt?: Version; // when the last review ended (RV-4): rows changed since are marked
    visit: Marks | null; // changed since you last looked (RV-15): marked instead when there is no reviewedAt
    // `files`: new files to attach to it (RV-11).
    onAdd: (note: Omit<Note, 'v' | 'id' | 'when' | 'who'>, files?: File[]) => Promise<boolean>;
    // Replaces `from` with `to` in a row's field (Write's text); false if `from` is no longer there.
    onApply: (row: string, field: Field, from: string, to: string) => boolean;
    // Takes and Play the script (AU-9), kept by the Editor as for Write, only listened to here.
    voice: VoiceOver;
    player: Player;
    canPlay: boolean; // a row's number plays from that row (onPlayFrom)
    onPlayFrom: (id: string) => void;
    onNotice: (message: string) => void;
  } = $props();

  const FIELDS: [Field, string][] = [['dialogue', 'Dialogue'], ['on_screen', 'On screen'], ['files', 'Images & files']];

  let active = $state(''); // the card picked: its quote is marked brighter
  let hideSent = $state(false); // the review note folded to a button (RV-8), until Review is left
  let comments = $state<ReviewComments>(); // the comments beside the script: `start` opens a new one
  let picker = $state<SelectionComment>(); // the Comment button on selected words (RV-22)
  const start = (t: { row: string; field: Field; quote: string }) => comments?.start(t);
  // Open comments, for marking their quotes (the list itself is ReviewComments').
  const open = $derived(threads(notes, true, ends).filter((t) => !t.deleted && !t.resolved && !t.held));
  const rowList = $derived(script.blocks.filter((b): b is Row => b.type === 'row'));

  const words = $derived(sectionWords(script)); // each section's read time (AP-12)
  const numbers = $derived(new Map(rowList.map((row, i) => [row.id, i + 1])));

  let table = $state<HTMLElement>();

  // Listening (AU-9): a take's ▶ plays it alone, or pauses and carries on the script while it plays that row.
  async function play(id: string) {
    if (player.row === id) return player.toggle();
    await voice.play(dir, id).catch((e) => onNotice(problem("That take couldn't be played. If someone just recorded it, the shared folder may still be syncing.", 'playing a take', e)));
  }

  // The page follows the row being played, as in Write.
  $effect(() => {
    const row = player.row && table?.querySelector(`[data-play="${player.row}"]`);
    if (!row) return;
    const { top, bottom } = row.getBoundingClientRect();
    if (top < 140 || bottom > innerHeight) row.scrollIntoView({ block: 'center', behavior: 'smooth' });
  });

  // What's changed since the last review (RV-4, mock-up 28). On unless this person turned it off; Show the edits is
  // remembered too, Only changed rows is not.
  let marking = $state(recall('review-changes') !== 'off');
  let showEdits = $state(!!recall('review-edits'));
  let onlyChanged = $state(false);
  const since = $derived(reviewedAt ? sinceReview(parseScript(reviewedAt.text), script) : null);
  // With no review round to compare with, the rows others changed since your last look are marked the same way.
  const marks = $derived(since ? (marking ? since : null) : visit);
  const edits = $derived(since ? showEdits : !!visit?.edits);
  const visitBy = (id: string) => (since ? undefined : visit?.by.get(id));
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
    void [script, marks, edits, onlyChanged]; // each redraws the cells
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
</script>

<div class="review">
  <div class="script" bind:this={table}>
    {#if sent && !hideSent}
      <div class="sent" data-tour="review-note" role="note" aria-label="Note from {sent.who}">
        <div>
          <p class="from"><b>{sent.who}</b> sent this for review · {at(Date.parse(sent.when))}</p>
          <p class="message">{sent.message}</p>
        </div>
        <button class="fold" aria-expanded="true" onclick={() => (hideSent = true)}>Hide</button>
      </div>
    {:else if sent}
      <button class="sent-folded" aria-expanded="false" onclick={() => (hideSent = false)}>{sent.who}'s note</button>
    {/if}
    <p class="hint">Select any text, then press Comment, to comment or suggest a change. The writer accepts or rejects each suggestion.</p>
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
        {@const take = voice.takes[block.id]}
        {@const here = player.row === block.id}
        {@const sounding = voice.playing === block.id || (here && player.on)}
        {@const by = was !== undefined ? visitBy(block.id) : undefined}
        <div class="row grid" class:active={open.some((t) => t.comment.id === active && t.comment.row === block.id)}
          class:changed={was !== undefined} class:visit-on={by && visit?.on === block.id} class:here data-play={block.id} data-visit={by ? block.id : undefined} data-tour="review-row">
          <div class="num">
            {#if canPlay && here && player.on}
              <button class="playfrom" aria-label="Pause at row {n}" title="Pause" onclick={() => player.toggle()}>❚❚</button>
            {:else if canPlay}
              <button class="playfrom" aria-label="Play from row {n}" title="Play from here" onclick={() => onPlayFrom(block.id)}><span class="n">{n}</span><span class="go" aria-hidden="true">▶</span></button>
            {:else}
              <span>{n}</span>
            {/if}
            {#if was !== undefined}<span class="tag" title={by ? `${by.who} · ${at(Date.parse(by.when))}` : undefined}>{was ? 'Changed' : 'New'}</span>{/if}
            {#if by}
              <span class="by-who">{by.who}</span>
              <button class="seen" aria-label="Seen, row {n}" title="Seen: clear this mark" onclick={() => visit?.onSeen(block.id)}>✓</button>
            {/if}
            <button class="add" aria-label="Comment on row {n}" title="Comment on this row"
              onclick={() => start({ row: block.id, field: 'dialogue', quote: '' })}>Comment</button>
          </div>
          {#each FIELDS as [field, name] (field)}
            {#snippet cell()}
              <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
              <p class="cell {field}" aria-label="{name}, row {n}" data-row={block.id} data-field={field}
                onmouseup={(e) => picker?.look(block.id, field, e.currentTarget)}>{@html toHtml(text(block, field))}</p>
            {/snippet}
            {#snippet content()}
              {#if edits && was && text(was, field) !== text(block, field)}
                <!-- Show the edits (RV-4): the old text struck through above the new, as in History. -->
                <div class="edited"><p class="was {field}" aria-label="{name} before, row {n}">{@html toHtml(text(was, field))}</p>{@render cell()}</div>
              {:else}
                {@render cell()}
              {/if}
            {/snippet}
            {#if field === 'dialogue' && (take || here)}
              <!-- The take under the dialogue, as in Write but only to listen (AU-9). -->
              <div class="spoken">
                {@render content()}
                {#if take}
                  <Take {take} dialogue={block.dialogue} n={n ?? 0} {sounding} at={here ? player.at : voice.playing === block.id ? voice.at : 0}
                    onPlay={() => play(block.id)} />
                {:else}
                  <p class="waiting" role="status">
                    <span class="bar"><span style:width="{player.at * 100}%"></span></span>
                    No take yet · waiting its read time, {clock(player.steps[player.i].seconds)}
                  </p>
                {/if}
              </div>
            {:else}
              {@render content()}
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
    <SelectionComment bind:this={picker} script={table} onComment={start} />
  </div>

  <ReviewComments bind:this={comments} bind:active {dir} {notes} {ends} {me} rows={rowList} {numbers} {onAdd} {onApply} />
</div>

<!-- Rows removed since the last review (RV-4): one grey struck line each, where they were. -->
{#snippet removedRows(after: string)}
  {#each removedAfter.get(after) ?? [] as row (row.id)}
    <p class="removed grid"><span class="tag">Removed</span><span class="gone"><s>{plain(row.dialogue || row.onScreen || row.files.join(', ')) || '(empty row)'}</s>{#if visitBy(row.id)}{' · '}{visitBy(row.id)?.who}{/if}</span></p>
  {/each}
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
  .script { position: relative; flex: 999 1 640px; min-width: 0; }
  .hint { margin: 0 0 20px; font-size: 14px; color: var(--muted); }
  .grid { display: grid; grid-template-columns: 56px minmax(0, 1.25fr) minmax(0, 1fr) minmax(0, 0.7fr); gap: 20px; padding: 0 12px; }
  .head { position: sticky; top: 0; z-index: 1; background: var(--ground); padding-top: 10px; padding-bottom: 10px; font-size: 13px;
    font-weight: 500; color: var(--muted); border-bottom: 1px solid var(--line); }
  .section { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin: 0; padding: 28px 12px 8px; font-size: 18px; font-weight: 600; border-bottom: 1px solid var(--line); }
  .time { font-size: 13px; font-weight: 400; color: var(--muted); font-variant-numeric: tabular-nums; }
  .row { align-items: start; padding-top: 20px; padding-bottom: 20px; border-bottom: 1px solid #f0f0f0; }
  .row.active { background: #f7f9fe; }
  /* Play the script (AU-9, as in Write): the row being played is tinted; its number turns into ▶ under the mouse. */
  .row.here { border-radius: 8px; background: #eef2fb; }
  .playfrom { margin: -4px -8px; padding: 4px 8px; border: 0; border-radius: 6px; background: none; color: inherit; font: inherit; }
  .playfrom:hover { background: #f0f0f0; color: var(--accent); }
  .playfrom .go, .row:hover .playfrom .n { display: none; }
  .row:hover .playfrom .go { display: inline; color: var(--accent); }
  .row.here .playfrom { color: var(--accent); }
  .spoken { min-width: 0; }
  .waiting { display: flex; align-items: center; gap: 8px; margin: 6px 0 0; font-size: 13px; color: var(--muted); }
  .bar { flex: 0 1 72px; height: 4px; border-radius: 2px; background: var(--line); overflow: hidden; }
  .bar span { display: block; height: 100%; background: #8a8a8a; }
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
  .removed .gone { grid-column: 2 / -1; font-size: 14px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  /* Changed since you last looked (RV-15): who, and ✓ Seen, under the tag; the row stepped to is tinted. */
  .by-who { margin-top: -4px; max-width: 56px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11px; }
  .seen { width: 26px; height: 24px; margin-left: -4px; padding: 0; border: 1px solid #c9d5f2; border-radius: 6px; background: #fff; color: var(--accent); font-size: 13px; }
  .seen:hover { border-color: var(--accent); }
  .row.visit-on { background: #f5f8fe; }
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
  .cell :global(a) { color: var(--accent); }
  .cell :global(s) { color: #8a8a8a; }
</style>
