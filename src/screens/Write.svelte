<script lang="ts">
  import { tick } from 'svelte';
  import { clock } from '../lib/readtime';
  import { emptyRow, type Block, type Script } from '../lib/script';
  import type { Player } from '../lib/play.svelte';
  import { keep, recall } from '../lib/remember';
  import { chosenMic } from '../lib/mic';
  import { outdated, wpm, type VoiceOver } from '../lib/voice.svelte';
  import FilesCell from './FilesCell.svelte';
  import TextField from './TextField.svelte';

  // onChange: something was edited (the Editor saves). onDeleted: a row or section was deleted, or a paste made rows,
  // with the blocks as they were before, so the Editor can offer Undo. onNotice: a message for the person.
  // voice: the rows' voice-over takes (AU-1), kept by the Editor; `name` signs a new take.
  // player: Play the script (AU-2), kept by the Editor; canPlay: a row's number plays from that row (onPlayFrom).
  let { script = $bindable(), dir, voice, player, canPlay, name, onChange, onDeleted, onNotice, onPlayFrom }: {
    script: Script; dir: FileSystemDirectoryHandle; voice: VoiceOver; player: Player; canPlay: boolean; name: string;
    onChange: () => void; onPlayFrom: (id: string) => void;
    onDeleted: (before: Block[], what: string) => void; onNotice: (message: string) => void;
  } = $props();

  const numbers = $derived.by(() => {
    const map = new Map<Block, number>();
    let n = 0;
    for (const block of script.blocks) if (block.type === 'row') map.set(block, ++n);
    return map;
  });

  // Columns folded away to a thin strip (AP-17), remembered in this browser for every script, never in the script.
  type Column = 'dialogue' | 'screen' | 'files';
  const COLUMNS: { key: Column; name: string; fr: number }[] = [
    { key: 'dialogue', name: 'Dialogue', fr: 1.25 },
    { key: 'screen', name: 'On screen', fr: 1 },
    { key: 'files', name: 'Images & files', fr: 0.8 },
  ];
  const stored = new Set(recall('write-folded').split(',').filter((c) => COLUMNS.some((col) => col.key === c)));
  // Never all three: the last one open has no fold button, and a stored "all folded" opens Dialogue again.
  if (stored.size === COLUMNS.length) stored.delete('dialogue');
  let folded = $state(stored);
  const columns = $derived(`40px 28px ${COLUMNS.map((c) => (folded.has(c.key) ? '28px' : `minmax(0, ${c.fr}fr)`)).join(' ')}`);

  function fold(key: Column) {
    const next = new Set(folded);
    if (!next.delete(key)) next.add(key);
    folded = next;
    keep('write-folded', [...next].join(','));
  }

  // The running clock while recording.
  let now = $state(Date.now());
  $effect(() => {
    if (!voice.recording) return;
    const tick = setInterval(() => (now = Date.now()), 250);
    return () => clearInterval(tick);
  });

  // The dialogue of the row with that id, kept with its take.
  const lineOf = (id: string) => {
    const row = script.blocks.find((b) => b.type === 'row' && b.id === id);
    return row?.type === 'row' ? row.dialogue : '';
  };

  async function mic(id: string) {
    try {
      if (voice.recording === id) await voice.stop(dir, name, lineOf(id));
      else {
        if (voice.recording) await voice.stop(dir, name, lineOf(voice.recording));
        const fellBack = await voice.start(id);
        now = Date.now();
        if (fellBack) onNotice(`${chosenMic().name || 'The microphone picked in Settings'} isn't plugged in, so this take is recorded with the default microphone.`);
      }
    } catch (e) {
      const blocked = e instanceof DOMException && (e.name === 'NotAllowedError' || e.name === 'NotFoundError');
      onNotice(blocked
        ? 'The microphone is blocked or missing. Allow it in the address bar (the camera and mic icon), then try again.'
        : "The take couldn't be saved in the script's folder. If OneDrive is still syncing, wait a moment and try again.");
    }
  }

  // The page follows the row being played.
  let table = $state<HTMLElement>();
  $effect(() => {
    const row = player.row && table?.querySelector(`[data-row="${player.row}"]`);
    if (!row) return;
    const { top, bottom } = row.getBoundingClientRect();
    // Only when it isn't all in view (under the top bar, which stays up while playing).
    if (top < 140 || bottom > innerHeight) row.scrollIntoView({ block: 'center', behavior: 'smooth' });
  });

  // A row's own ▶: while the script is playing that row, it pauses and carries on.
  async function play(id: string) {
    if (player.row === id) return player.toggle();
    await voice.play(dir, id).catch(() => onNotice("That take couldn't be played. If someone just recorded it, OneDrive may still be syncing."));
  }

  const day = (ms: number) => new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  function move(i: number, by: number) {
    const j = i + by;
    if (j < 0 || j >= script.blocks.length) return;
    [script.blocks[i], script.blocks[j]] = [script.blocks[j], script.blocks[i]];
    onChange();
  }

  function insertRow(at: number) {
    script.blocks.splice(at, 0, emptyRow(script));
    onChange();
  }

  // Several paragraphs pasted into a row's Dialogue (AP-13): the first goes where the cursor is, each other one gets
  // its own row below, and what followed the cursor ends the last one, as in a word processor. Undo puts it back.
  async function pasteRows(block: Block, lines: string[], head: string, tail: string) {
    if (block.type !== 'row') return;
    const before = script.blocks.map((b) => (b === block ? { ...b } : b));
    const at = script.blocks.indexOf(block);
    block.dialogue = head + lines[0];
    // Two or more lines, so the last one is always a new row. Each id is picked once the row before is in.
    const rest = lines.slice(1);
    let id = '';
    rest.forEach((line, k) => {
      const row = { ...emptyRow(script), dialogue: k === rest.length - 1 ? line + tail : line };
      script.blocks.splice(at + 1 + k, 0, row);
      id = row.id;
    });
    const end = rest[rest.length - 1].length;
    onDeleted(before, `Pasted as ${lines.length} rows.`);
    onChange();
    // The cursor goes to the end of what was pasted.
    await tick();
    const box = table?.querySelector<HTMLTextAreaElement>(`[data-row="${id}"] .dialogue textarea`);
    box?.focus();
    box?.setSelectionRange(end, end);
  }

  function remove(i: number) {
    const block = script.blocks[i];
    const what = block.type === 'row' ? `Row ${numbers.get(block)} deleted.` : `Section "${block.title}" deleted (its rows stay).`;
    const before = [...script.blocks];
    script.blocks.splice(i, 1);
    onDeleted(before, what);
    onChange();
  }

  // A new section goes right after the box the cursor is in (after a section's rows, from its title), or at the
  // end when no box is in use (AP-22). It starts empty, with "New section" as grey stand-in text, and takes the cursor.
  let fresh = $state<Block | null>(null);
  function addSection() {
    const box = document.activeElement?.closest<HTMLElement>('[data-block]');
    let at = script.blocks.length;
    if (box && table?.contains(box)) {
      at = Number(box.dataset.block) + 1;
      if (script.blocks[at - 1].type === 'section') while (at < script.blocks.length && script.blocks[at].type === 'row') at++;
    }
    const section: Block = { type: 'section', title: '', note: '' };
    // Rows already following it belong to it; otherwise it gets an empty row to write in.
    script.blocks.splice(at, 0, ...(script.blocks[at]?.type === 'row' ? [section] : [section, emptyRow(script)]));
    fresh = script.blocks[at];
    onChange();
  }

  // An emptied section goes only once the cursor leaves its title, never while still typing in it (AP-22).
  function left(block: Block) {
    if (block.type !== 'section' || block.title.trim() || block.note) return;
    const i = script.blocks.indexOf(block);
    if (i >= 0) script.blocks.splice(i, 1);
    onChange();
  }

  // Keyboard flow (AP-14): Tab and Shift+Tab go from text box to text box (section titles, Dialogue, On screen),
  // past the buttons in between; Ctrl+Enter adds a row below and goes to it; Alt+Up / Alt+Down move the row.
  const BOXES = '.section-title, textarea';
  async function keys(e: KeyboardEvent) {
    const box = e.target as HTMLElement;
    const block = box.closest<HTMLElement>('[data-block]');
    if (!table || !block || !box.matches(BOXES)) return;
    const i = Number(block.dataset.block);
    if (e.key === 'Tab' && !e.ctrlKey && !e.altKey && !e.metaKey) {
      const all = [...table.querySelectorAll<HTMLElement>(BOXES)];
      const next = all[all.indexOf(box) + (e.shiftKey ? -1 : 1)];
      // From the last box the browser carries on as usual (to + Add row).
      if (!next) return;
      e.preventDefault();
      next.focus();
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey) {
      e.preventDefault();
      insertRow(i + 1);
      await tick();
      table.querySelector<HTMLElement>(`[data-block="${i + 1}"] textarea`)?.focus();
    } else if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && e.altKey && !e.ctrlKey && !e.shiftKey && !e.metaKey) {
      e.preventDefault();
      const j = i + (e.key === 'ArrowUp' ? -1 : 1);
      if (j < 0 || j >= script.blocks.length) return;
      // Moving takes the box out of the page for a moment, so the cursor is put back where it was.
      const nth = [...block.querySelectorAll(BOXES)].indexOf(box);
      const [start, end] = box instanceof HTMLTextAreaElement || box instanceof HTMLInputElement
        ? [box.selectionStart ?? 0, box.selectionEnd ?? 0] : [0, 0];
      move(i, j - i);
      await tick();
      const again = table.querySelectorAll<HTMLTextAreaElement | HTMLInputElement>(`[data-block="${j}"] :is(${BOXES})`)[nth];
      again?.focus();
      again?.setSelectionRange(start, end);
    }
  }

  const focusIf = (node: HTMLInputElement, on: boolean) => {
    if (on) { node.focus(); fresh = null; }
  };
</script>

{#if script.intro}<p class="note">{script.intro}</p>{/if}
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="table" bind:this={table} onkeydown={keys}>
  <div class="head grid" style:grid-template-columns={columns}>
    <span>#</span><span></span>
    {#each COLUMNS as col (col.key)}
      {#if folded.has(col.key)}
        <span><button class="unfold" aria-label="Show {col.name}" title="Show {col.name}" onclick={() => fold(col.key)}>›</button></span>
      {:else}
        <span class="heading">{col.name}
          {#if folded.size < COLUMNS.length - 1}
            <button class="fold" aria-label="Fold {col.name} away" title="Fold away" onclick={() => fold(col.key)}>‹</button>
          {/if}
        </span>
      {/if}
    {/each}
  </div>
  {#each script.blocks as block, i (block)}
    {#if block.type === 'section'}
      <div class="section" data-block={i}>
        <input class="section-title" bind:value={block.title} oninput={onChange} onblur={() => left(block)}
          use:focusIf={fresh === block} placeholder="New section" aria-label="Section title" />
        <span class="tools">
          <button aria-label="Move section up" title="Move up" onclick={() => move(i, -1)}>↑</button>
          <button aria-label="Move section down" title="Move down" onclick={() => move(i, 1)}>↓</button>
          <button aria-label="Delete section" title="Delete" onclick={() => remove(i)}>×</button>
        </span>
      </div>
    {:else}
      {@const n = numbers.get(block)}
      {@const take = voice.takes[block.id]}
      {@const recording = voice.recording === block.id}
      {@const here = player.row === block.id}
      {@const sounding = voice.playing === block.id || (here && player.on)}
      <div class="row grid" style:grid-template-columns={columns} class:here data-row={block.id} data-block={i}>
        <div class="num">
          {#if canPlay}
            <button class="from" aria-label="Play from row {n}" title="Play from here" onclick={() => onPlayFrom(block.id)}>{n}</button>
          {:else}
            <span>{n}</span>
          {/if}
          <span class="tools">
            <button aria-label="Move row {n} up" title="Move up" onclick={() => move(i, -1)}>↑</button>
            <button aria-label="Move row {n} down" title="Move down" onclick={() => move(i, 1)}>↓</button>
            <button aria-label="Add a row below row {n}" title="Add a row below" onclick={() => insertRow(i + 1)}>+</button>
            <button aria-label="Delete row {n}" title="Delete" onclick={() => remove(i)}>×</button>
          </span>
        </div>
        <div class="mic-cell">
          <button class="mic" class:has={take} class:on={recording} disabled={!block.id} onclick={() => mic(block.id)}
            aria-label={recording ? `Stop recording row ${n}` : take ? `Record row ${n} again` : `Record row ${n}`}
            title={recording ? 'Stop' : take ? 'Record again' : 'Record'}>
            {#if recording}■{:else}{@render micIcon()}{/if}
          </button>
        </div>
        {#if folded.has('dialogue')}{@render dot(block.dialogue !== '', 'Dialogue')}{:else}
        <div>
          {#if block.note}<p class="note">{block.note}</p>{/if}
          <div class="dialogue"><TextField bind:value={block.dialogue} oninput={onChange} label="Dialogue, row {n}" placeholder="What is said"
            onparagraphs={(lines, head, tail) => pasteRows(block, lines, head, tail)} /></div>
          {#if recording}
            <p class="take rec" role="status">● Recording {clock((now - voice.started) / 1000)} · ■ stops</p>
          {:else if take}
            {@const rate = wpm(take, block.dialogue)}
            <div class="take">
              <button class="play" aria-label="{sounding ? 'Pause' : 'Play'} row {n}" onclick={() => play(block.id)}>
                {sounding ? '❚❚' : '▶'} {clock(take.seconds)}
              </button>
              <span class="bar"><span style:width="{(here ? player.at : voice.playing === block.id ? voice.at : 0) * 100}%"></span></span>
              {#if outdated(take, block.dialogue)}<span class="old" title="The line has changed since this take">Outdated</span>{/if}
              <span class="about">{rate ? `${rate} wpm` : ''}{rate && take.by ? ' · ' : ''}{take.by ? `${take.by}, ${day(take.at)}` : ''}</span>
              <button class="drop" aria-label="Delete the take of row {n}" title="Delete the take"
                onclick={() => voice.remove(dir, block.id).catch(() => onNotice("The take couldn't be deleted."))}>×</button>
            </div>
          {:else if here}
            <p class="take" role="status">
              <span class="bar wait"><span style:width="{player.at * 100}%"></span></span>
              No take yet · waiting its read time, {clock(player.steps[player.i].seconds)}
            </p>
          {/if}
        </div>
        {/if}
        {#if folded.has('screen')}{@render dot(block.onScreen !== '', 'On screen')}{:else}
          <div class="screen"><TextField bind:value={block.onScreen} oninput={onChange} label="On screen, row {n}" placeholder="What the viewer sees" /></div>
        {/if}
        {#if folded.has('files')}{@render dot(block.files.length > 0, 'Images & files')}{:else}
          <FilesCell files={block.files} {dir} {onNotice}
            onChange={(files) => { block.files = files; onChange(); }} />
        {/if}
      </div>
    {/if}
  {/each}
  <div class="adds">
    <button class="link" onclick={() => insertRow(script.blocks.length)}>+ Add row</button>
    <!-- Keeps the cursor in its box on a click, so the section knows where to go. -->
    <button class="link" onmousedown={(e) => e.preventDefault()} onclick={addSection}>+ Add section</button>
  </div>
</div>

<!-- A folded column's cell: a grey dot when the row has something in that column, so nothing is hidden silently. -->
{#snippet dot(has: boolean, name: string)}
  <span class="dot">{#if has}<span title="{name} has something here">•</span>{/if}</span>
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
  .table { min-width: 860px; }
  /* Its columns are set on the element (`columns`), as a folded column is a thin strip. */
  .grid { display: grid; gap: 0 24px; padding-left: 12px; padding-right: 12px; }
  /* Stays at the top while scrolling. No scrolling box around the table, or it would stick to that instead. */
  .head { position: sticky; top: 0; z-index: 2; background: var(--ground); padding-top: 10px; padding-bottom: 10px; font-size: 13px; font-weight: 500; color: var(--muted); border-bottom: 1px solid var(--line); }
  .row { align-items: start; min-height: 64px; padding-top: 20px; padding-bottom: 20px; border-bottom: 1px solid #f0f0f0; }
  /* The row being played (AU-2). */
  .row.here { border-radius: 8px; background: #eef2fb; }
  .from { margin: -4px -8px; padding: 4px 8px; border: 0; border-radius: 6px; background: none; color: inherit; font: inherit; }
  .from:hover { background: #f0f0f0; color: var(--accent); }
  .num { position: relative; font-size: 13px; color: var(--muted); padding-top: 3px; }
  /* Row tools sit over the gutter below the number, so they never make a row taller. */
  .num .tools { position: absolute; top: 24px; left: -6px; display: grid; grid-template-columns: 28px 28px; }
  .tools { display: flex; flex-wrap: wrap; gap: 2px; opacity: 0; }
  .row:hover .tools, .row:focus-within .tools, .section:hover .tools, .section:focus-within .tools { opacity: 1; }
  .tools button { width: 28px; height: 28px; padding: 0; border: 0; border-radius: 6px; background: none; color: var(--muted); font-size: 14px; }
  .tools button:hover { background: #f0f0f0; color: var(--ink); }
  .dialogue { font-size: 17px; }
  .heading { display: flex; align-items: center; gap: 4px; }
  .fold, .unfold { width: 28px; height: 28px; margin: -6px 0; padding: 0; border: 0; border-radius: 6px; background: none;
    color: #8a8a8a; font-size: 16px; }
  .fold:hover, .unfold:hover { background: #f0f0f0; color: var(--ink); }
  .unfold { background: #f2f2f2; color: var(--muted); }
  .dot { text-align: center; color: #b8b8b8; }
  /* The mic sits between the number and the dialogue: grey with no take, blue with one, red while recording. */
  /* Pulled into the gap, so it reads as part of the line it records. */
  .mic-cell { justify-self: end; transform: translateX(16px); margin-top: -3px; }
  .mic { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; padding: 0;
    border: 0; border-radius: 50%; background: none; color: #c4c4c4; font-size: 11px; }
  .mic:hover { background: #f0f0f0; color: var(--muted); }
  .mic.has { color: var(--accent); }
  .mic.on { background: var(--danger); color: #fff; }
  .take { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 6px 0 0; font-size: 13px; color: var(--muted); }
  .take.rec { color: var(--danger); }
  .old { padding: 1px 8px; border-radius: 999px; background: #fff4e5; color: #7a4a00; font-size: 12px; font-weight: 500; }
  .play { display: inline-flex; align-items: center; gap: 6px; min-height: 28px; padding: 0 10px; border: 1px solid var(--accent);
    border-radius: 999px; background: #eef2fb; color: var(--accent); font-size: 13px; font-weight: 500; }
  .bar { flex: 0 1 72px; height: 4px; border-radius: 2px; background: var(--line); overflow: hidden; }
  .bar span { display: block; height: 100%; background: var(--accent); }
  .bar.wait { flex-basis: 72px; }
  .bar.wait span { background: #8a8a8a; }
  .drop { min-height: 28px; padding: 0 6px; border: 0; background: none; color: #8a8a8a; font-size: 15px; opacity: 0; }
  .row:hover .drop, .drop:focus-visible { opacity: 1; }
  .drop:hover { color: var(--danger); }
  .screen { font-size: 15px; color: #3d3d3d; }
  .section { display: flex; align-items: center; gap: 12px; padding: 28px 12px 8px; border-bottom: 1px solid var(--line); }
  .section-title { flex: 1; border: 0; padding: 4px 0; font: inherit; font-size: 18px; font-weight: 600; background: none; }
  .section-title:focus { outline: none; background: #f7f9ff; }
  .section .tools { flex-wrap: nowrap; }
  .note { margin: 0 0 8px; font-size: 13px; color: var(--muted); white-space: pre-wrap; }
  .adds { display: flex; gap: 8px; margin-top: 12px; }
</style>
