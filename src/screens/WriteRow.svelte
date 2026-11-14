<script lang="ts">
  import { clock } from '../lib/readtime.svelte';
  import type { Row } from '../lib/script';
  import { toHtml } from '../lib/format';
  import type { Marks } from '../lib/visit';
  import type { Words } from '../lib/started';
  import { at as when } from '../lib/when';
  import type { Flag, Thread } from '../lib/comments';
  import type { Player } from '../lib/play.svelte';
  import { chosenMic } from '../lib/mic';
  import type { VoiceOver } from '../lib/voice.svelte';
  import FilesCell from './FilesCell.svelte';
  import FlagIcon from './FlagIcon.svelte';
  import Take from './Take.svelte';
  import TextField from './TextField.svelte';

  // One row of Write (mock-up 3): its number and tools, mic, the three columns, and its flag's note.
  // block: the row, edited in place (onChange). i: its index in the script's blocks (data-block); n: its number.
  // columns: the grid's columns; folded: the columns folded away (AP-17). stepped: the flag stepped to (AP-9).
  // said: its open comments (RV-13); talking: its card is being read. visit: RV-15's marks. came: RV-12's file.
  // start: its words when the script was opened (AP-38); onPutBack puts a cell's back (Write's, for the Undo bar).
  // onMove, onInsert, onRemove, onToSection and onToggleFlag are Write's (they change the blocks round it);
  // onMic: the mic (Write stops a take on another row first). onPaste: two or more paragraphs pasted into Dialogue (AP-13).
  let { block = $bindable(), i, n, columns, folded, dir, root, folderName, voice, player, canPlay, name, flag, stepped, said, talking, visit, came, start,
    onChange, onPutBack, onNotice, onPlayFrom, onFlag, onTalk, onMove, onInsert, onRemove, onToSection, onToggleFlag, onMic, onPaste }: {
    block: Row; i: number; n: number | undefined; columns: string; folded: Set<string>; dir: FileSystemDirectoryHandle; root: FileSystemDirectoryHandle;
    folderName: string; voice: VoiceOver; player: Player; canPlay: boolean; name: string; flag: Flag | undefined; stepped: boolean;
    said: Thread[]; talking: boolean; visit: Marks | null; came: { row: string; line: string; from: string } | null;
    start: Words | undefined; onPutBack: (field: 'dialogue' | 'onScreen') => void;
    onChange: () => void; onNotice: (message: string) => void; onPlayFrom: (id: string) => void;
    onFlag: (row: string, note: string | null) => Promise<boolean>; onTalk: (id: string) => void;
    onMove: (by: number) => void; onInsert: () => void; onRemove: () => void; onToSection: () => void; onToggleFlag: () => void; onMic: () => void;
    onPaste: (lines: string[], head: string, tail: string) => void;
  } = $props();

  const take = $derived(voice.takes[block.id]);
  const recording = $derived(voice.recording === block.id);
  const here = $derived(player.row === block.id);
  const sounding = $derived(voice.playing === block.id || (here && player.on));
  const was = $derived(visit?.changed.get(block.id));
  const by = $derived(was !== undefined ? visit?.by.get(block.id) : undefined);

  // Before you started (AP-38): which cells show their old words. Closed at first; open while you keep typing.
  let opened = $state({ dialogue: false, onScreen: false });

  // The running clock while recording.
  let now = $state(Date.now());
  $effect(() => {
    if (!recording) return;
    now = Date.now();
    const tick = setInterval(() => (now = Date.now()), 250);
    return () => clearInterval(tick);
  });

  // A row's own ▶: while the script is playing that row, it pauses and carries on.
  async function play() {
    if (here) return player.toggle();
    await voice.play(dir, block.id).catch(() => onNotice("That take couldn't be played. If someone just recorded it, the shared folder may still be syncing."));
  }

  // A note is written when the box is left or Enter is pressed, not on every key.
  function saveNote(box: HTMLInputElement) {
    if (flag && box.value.trim() !== flag.text) onFlag(block.id, box.value.trim());
  }

  // A click in a field, on a quote's words, opens the Comments tab at it.
  function clickQuote(field: 'dialogue' | 'on_screen', box: HTMLTextAreaElement) {
    const at = box.selectionStart;
    if (box.selectionEnd !== at) return;
    const hit = said.find((t) => {
      const start = t.comment.field === field && t.comment.quote ? box.value.indexOf(t.comment.quote) : -1;
      return start >= 0 && at >= start && at <= start + t.comment.quote!.length;
    });
    if (hit) onTalk(hit.comment.id);
  }
</script>

<div class="row grid" style:grid-template-columns={columns} class:here class:stepped={flag && stepped} class:talking
  class:visited={by} class:visit-on={by && visit?.on === block.id} style:--down="{(said.length ? 34 : 0) + (by ? 58 : 0)}px"
  data-row={block.id} data-block={i} data-visit={by ? block.id : undefined} data-tour="row">
  <div class="num">
    {#if canPlay}
      {#if here && player.on}
        <button class="from" aria-label="Pause at row {n}" title="Pause" onclick={() => player.toggle()}>❚❚</button>
      {:else}
        <button class="from" aria-label="Play from row {n}" title="Play from here" onclick={() => onPlayFrom(block.id)}><span class="n">{n}</span><span class="go" aria-hidden="true">▶</span></button>
      {/if}
    {:else}
      <span>{n}</span>
    {/if}
    {#if said.length}
      {@const kinds = said.every((t) => t.comment.kind === 'suggestion') ? 'suggestion' : said.some((t) => t.comment.kind === 'suggestion') ? 'comment or suggestion' : 'comment'}
      <button class="bubble" aria-label="{said.length} open {kinds}{said.length === 1 ? '' : 's'} on row {n}" title="Open in Comments"
        onclick={() => onTalk(said[0].comment.id)}>
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2z" /></svg>{said.length}
      </button>
    {/if}
    {#if by}
      <span class="mark" title="{by.who} · {when(Date.parse(by.when))}"><b>{was ? 'Changed' : 'New'}</b><span>{by.who}</span></span>
      <button class="seen" aria-label="Seen, row {n}" title="Seen: clear this mark" onclick={() => visit?.onSeen(block.id)}>✓</button>
    {/if}
    <span class="tools" data-tour="row-tools">
      <button aria-label="Move row {n} up" title="Move up" onclick={() => onMove(-1)}>↑</button>
      <button aria-label="Move row {n} down" title="Move down" onclick={() => onMove(1)}>↓</button>
      <button aria-label="Add a row below row {n}" title="Add a row below" onclick={onInsert}>+</button>
      <button aria-label="Delete row {n}" title="Delete" onclick={onRemove}>×</button>
    </span>
    <button class="flag" data-tour-with="row-tools" class:on={flag} disabled={!block.id} onclick={onToggleFlag}
      aria-label={flag ? `Clear the flag on row ${n}` : `Flag row ${n}`} aria-pressed={!!flag} title={flag ? 'Clear the flag' : 'Flag this row'}>
      <FlagIcon filled={!!flag} size={15} />
    </button>
    <button class="promote" data-tour-with="row-tools" aria-label="Turn row {n} into a section" title="Turn into a section" onclick={onToSection}>§</button>
  </div>
  <div class="mic-cell">
    <button data-tour="take" class="mic" class:has={take} class:on={recording && !voice.cue} class:cue={recording && voice.cue} disabled={!block.id}
      onclick={onMic} aria-label={recording ? `Stop recording row ${n}` : take ? `Record row ${n} again` : `Record row ${n}`}>
      {#if recording && voice.cue}
        <svg class="ring" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="14" /></svg>{@render micIcon()}
      {:else if recording}■{:else}{@render micIcon()}{/if}
    </button>
  </div>
  {#if folded.has('dialogue')}{@render dot(block.dialogue !== '', 'Dialogue')}{:else}
  <div>
    {#if block.note}<p class="note">{block.note}</p>{/if}
    {#if visit?.edits && was && was.dialogue !== block.dialogue}{@render before(was.dialogue, 'Dialogue', n)}{/if}
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div class="dialogue" onclick={(e) => e.target instanceof HTMLTextAreaElement && clickQuote('dialogue', e.target)}><TextField bind:value={block.dialogue} oninput={onChange} label="Dialogue, row {n}" placeholder="What is said"
      onparagraphs={onPaste} /></div>
    {@render started('dialogue', 'Dialogue')}
    {#if recording}
      {#if voice.cue}<p class="take" role="status">Getting ready…</p>
      {:else}<p class="take rec" role="status">● Recording {clock((now - voice.started) / 1000)} · ■ stops</p>{/if}
    {:else if take}
      <Take {take} dialogue={block.dialogue} n={n ?? 0} {sounding} at={here ? player.at : voice.playing === block.id ? voice.at : 0}
        onPlay={play}
        onCurrent={() => voice.current(dir, block.id, block.dialogue).catch(() => onNotice("Outdated couldn't be hidden."))}
        onDrop={() => voice.remove(dir, block.id).catch(() => onNotice("The take couldn't be deleted."))} />
    {:else if here}
      <p class="take" role="status">
        <span class="bar"><span style:width="{player.at * 100}%"></span></span>
        No take yet · waiting its read time, {clock(player.steps[player.i].seconds)}
      </p>
    {/if}
  </div>
  {/if}
  {#if folded.has('screen')}{@render dot(block.onScreen !== '', 'On screen')}{:else}
    <div>
      {#if visit?.edits && was && was.onScreen !== block.onScreen}{@render before(was.onScreen, 'On screen', n)}{/if}
      <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
      <div class="screen" onclick={(e) => e.target instanceof HTMLTextAreaElement && clickQuote('on_screen', e.target)}><TextField bind:value={block.onScreen} oninput={onChange} label="On screen, row {n}" placeholder="What the viewer sees" /></div>
      {@render started('onScreen', 'On screen')}
    </div>
  {/if}
  {#if folded.has('files')}{@render dot(block.files.length > 0, 'Images & files')}{:else}
    <FilesCell files={block.files} {dir} {root} here={folderName} row={n ?? 0} {onNotice} {came}
      onChange={(files) => { block.files = files; onChange(); }} />
  {/if}
  {#if flag}
    <div class="flag-note">
      <label>
        <FlagIcon size={13} />
        <input value={flag.text} aria-label="Flag note, row {n}" placeholder="Add a note (optional), e.g. check this fact"
          onchange={(e) => saveNote(e.currentTarget)} onkeydown={(e) => e.key === 'Enter' && e.currentTarget.blur()} />
      </label>
      {#if !flag.text}
        <button class="chip" onclick={() => onFlag(block.id, 'Needs a source')}>Needs a source</button>
      {/if}
      <span class="by">{flag.who}</span>
      <button class="clear" onclick={() => onFlag(block.id, null)}>Clear</button>
    </div>
  {/if}
</div>

<!-- A folded column's cell: a grey dot when the row has something in that column, so nothing is hidden silently. -->
{#snippet dot(has: boolean, name: string)}
  <span class="dot">{#if has}<span title="{name} has something here">•</span>{/if}</span>
{/snippet}

<!-- Show the edits (RV-15): the old words in their own line above the box, never inside it, so typing is as ever. -->
{#snippet before(text: string, name: string, n: number | undefined)}
  <p class="was" aria-label="{name} before, row {n}">{@html toHtml(text) || '(empty)'}</p>
{/snippet}

<!-- Before you started (AP-38, board 54): under a cell you changed, its words as they were when the script was opened,
     plain, in a grey box under the box you type in, with Put it back. -->
{#snippet started(field: 'dialogue' | 'onScreen', name: string)}
  {#if start && start[field] !== block[field]}
    <div class="start">
      <button class="open" aria-expanded={opened[field]} aria-label="Before you started: row {n} {name}" onclick={() => (opened[field] = !opened[field])}>
        {opened[field] ? '▾' : '▸'} Before you started
      </button>
      {#if opened[field]}
        <button class="back" aria-label="Put back row {n} {name}" onclick={() => onPutBack(field)}>Put it back</button>
        <p class="old" class:big={field === 'dialogue'} aria-label="Row {n} {name} as it was">{@html toHtml(start[field]) || '(empty)'}</p>
      {/if}
    </div>
  {/if}
{/snippet}

{#snippet micIcon()}
  <!-- The user's mic, drawn as a shape so it takes the text's colour: a capsule in a cradle on a stand. -->
  <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
    <rect x="8" y="2" width="8" height="13" rx="4" fill="currentColor" />
    <path d="M5 11a7 7 0 0 0 14 0" fill="none" stroke="currentColor" stroke-width="2" />
    <path d="M12 18v4" stroke="currentColor" stroke-width="2" />
  </svg>
{/snippet}

<style>
  /* Its columns are set on the element (`columns`), as a folded column is a thin strip. */
  .grid { display: grid; gap: 0 24px; padding-left: 12px; padding-right: 12px; }
  .row { align-items: start; min-height: calc(64px + var(--down, 0px)); padding-top: 20px; padding-bottom: 20px; border-bottom: 1px solid #f0f0f0; }
  /* The row being played (AU-2). */
  .row.here { border-radius: 8px; background: #eef2fb; }
  .from { margin: -4px -8px; padding: 4px 8px; border: 0; border-radius: 6px; background: none; color: inherit; font: inherit; }
  .from:hover { background: #f0f0f0; color: var(--accent); }
  /* The number turns into ▶ while the mouse is anywhere on the row (AU-7), so playing from here can be found. */
  .from .go, .row:hover .from .n { display: none; }
  .row:hover .from .go { display: inline; color: var(--accent); }
  .row.here .from { color: var(--accent); }
  .num { position: relative; font-size: 13px; color: var(--muted); padding-top: 3px; }
  /* Row tools sit over the gutter below the number, so they never make a row taller. */
  .num .tools { position: absolute; top: calc(24px + var(--down, 0px)); left: -6px; display: grid; grid-template-columns: 28px 28px; }
  .tools { display: flex; flex-wrap: wrap; gap: 2px; opacity: 0; }
  .row:hover .tools, .row:focus-within .tools { opacity: 1; }
  .tools button { width: 28px; height: 28px; padding: 0; border: 0; border-radius: 6px; background: none; color: var(--muted); font-size: 14px; }
  .tools button:hover { background: #f0f0f0; color: var(--ink); }
  .dialogue { font-size: 17px; }
  .dot { text-align: center; color: #b8b8b8; }
  /* The mic sits between the number and the dialogue: grey with no take, blue with one, red while recording. */
  /* Pulled into the gap, so it reads as part of the line it records. */
  .mic-cell { justify-self: end; transform: translateX(16px); margin-top: -3px; }
  .mic { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; padding: 0;
    border: 0; border-radius: 50%; background: none; color: #c4c4c4; font-size: 11px; }
  .mic:hover { background: #f0f0f0; color: var(--muted); }
  .mic.has { color: var(--accent); }
  .mic.on { background: var(--danger); color: #fff; }
  /* AU-4: recording from the click; a red ring fills round the mic for a second, then ■ is the cue to read. */
  .mic.cue { position: relative; color: var(--danger); }
  .ring { position: absolute; inset: -3px; width: 34px; height: 34px; transform: rotate(-90deg); fill: none;
    stroke: var(--danger); stroke-width: 2.5; stroke-linecap: round; stroke-dasharray: 88; animation: fill-ring 1s linear forwards; }
  @keyframes fill-ring { from { stroke-dashoffset: 88; } to { stroke-dashoffset: 0; } }
  .take { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 6px 0 0; font-size: 13px; color: var(--muted); }
  .take.rec { color: var(--danger); }
  /* A row with no take while the script plays over it; the take's own bar is in Take.svelte. */
  .bar { flex: 0 1 72px; height: 4px; border-radius: 2px; background: var(--line); overflow: hidden; }
  .bar span { display: block; height: 100%; background: #8a8a8a; }
  .screen { font-size: 15px; color: #3d3d3d; }
  .note { margin: 0 0 8px; font-size: 13px; color: var(--muted); white-space: pre-wrap; }
  /* In the third slot of the tools' top line, clear of the mic; seen on hover and focus, always once flagged. */
  .flag { position: absolute; top: calc(24px + var(--down, 0px)); left: 50px; display: inline-flex; align-items: center; justify-content: center;
    width: 28px; height: 28px; padding: 0; border: 0; border-radius: 6px; background: none; color: #8a8a8a; opacity: 0; }
  .row:hover .flag, .flag:focus-visible, .flag.on { opacity: 1; }
  .flag:hover { background: #f0f0f0; color: var(--ink); }
  .flag.on { color: var(--flag-mark); }
  /* Turn into a section (AP-30): under the flag, seen like the other row tools. */
  .promote { position: absolute; top: calc(54px + var(--down, 0px)); left: 50px; width: 28px; height: 28px; padding: 0; border: 0; border-radius: 6px;
    background: none; color: var(--muted); font-size: 14px; opacity: 0; }
  .row:hover .promote, .row:focus-within .promote { opacity: 1; }
  .promote:hover { background: #f0f0f0; color: var(--ink); }
  .row.stepped { border-radius: 8px; background: #fffbf5; }
  /* Review comments (RV-13, board 37): a blue bubble with the count under the number; the tools move down to clear it. */
  .bubble { display: flex; width: fit-content; align-items: center; gap: 3px; min-height: 28px; margin: 4px 0 0 -6px; padding: 0 6px; border: 1px solid #c9d6f5;
    border-radius: 6px; background: #eef2fb; color: var(--accent); font-size: 12px; font-weight: 600; }
  .bubble:hover { border-color: var(--accent); }
  .row.talking { border-radius: 8px; background: #eef3fd; box-shadow: inset 3px 0 0 var(--accent); }
  /* Changed since you last looked (RV-15, board 45): RV-4's blue bar, "Changed" or "New" and who, ✓ Seen under it. */
  .row.visited { box-shadow: inset 4px 0 0 var(--accent); }
  .row.visit-on { background: #f5f8fe; }
  .mark { display: flex; flex-direction: column; margin-top: 4px; font-size: 11px; line-height: 1.3; color: var(--muted); }
  .mark b { font-weight: 600; color: var(--accent-dark); }
  .mark span { max-width: 64px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .seen { display: flex; align-items: center; justify-content: center; width: 26px; height: 24px; margin: 2px 0 0 -4px; padding: 0;
    border: 1px solid #c9d5f2; border-radius: 6px; background: #fff; color: var(--accent); font-size: 13px; }
  .seen:hover { border-color: var(--accent); }
  .was { margin: 0 0 4px; font-size: 14px; line-height: 1.5; white-space: pre-wrap; color: #8a2b2b; text-decoration: line-through; }
  /* Before you started (AP-38): small and grey under the cell; the old words read as plainly as the new. */
  .start { display: flex; flex-wrap: wrap; align-items: center; gap: 0 4px; margin-top: 4px; }
  .start button { min-height: 28px; padding: 0 8px; border: 0; border-radius: 6px; background: none; font-size: 13px; font-weight: 500; }
  .start .open { margin-left: -8px; color: var(--muted); }
  .start .back { color: var(--accent-dark); }
  .start button:hover { background: #f0f0f0; }
  .old { flex: 1 0 100%; margin: 2px 0 0 -8px; padding: 6px 8px; border-radius: 6px; background: #f5f5f5; color: var(--muted);
    font-size: 15px; line-height: 1.55; white-space: pre-wrap; }
  .old.big { font-size: 17px; }
  .flag-note { grid-column: 3 / -1; display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 10px;
    padding: 2px 4px 2px 12px; border-radius: 8px; background: #fff7ed; color: var(--flag); font-size: 13px; }
  .flag-note label { display: flex; flex: 1 1 280px; align-items: center; gap: 8px; min-width: 0; }
  .flag-note input { flex: 1; min-width: 0; min-height: 32px; border: 0; background: none; color: var(--ink); font: inherit; font-size: 14px; }
  .flag-note input::placeholder { color: #a07850; }
  .chip { min-height: 30px; padding: 0 10px; border: 1px solid #f5d9b5; border-radius: 999px; background: #fff; color: var(--flag); font-size: 13px; font-weight: 500; }
  .by { font-size: 12px; }
  .clear { min-height: 30px; padding: 0 10px; border: 0; border-radius: 6px; background: none; color: var(--flag); font-size: 13px; font-weight: 500; }
  .clear:hover, .chip:hover { background: #fdebd3; }
</style>
