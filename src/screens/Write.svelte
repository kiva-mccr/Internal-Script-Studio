<script lang="ts">
  import { tick } from 'svelte';
  import { clock, sectionWords, speaking } from '../lib/readtime.svelte';
  import { emptyRow, type Block, type Script } from '../lib/script';
  import { plain, rangeOf, toHtml } from '../lib/format';
  import type { Marks } from '../lib/visit';
  import { at as when } from '../lib/when';
  import type { Flag, Thread } from '../lib/comments';
  import type { Player } from '../lib/play.svelte';
  import { keep, recall } from '../lib/remember';
  import { chosenMic } from '../lib/mic';
  import type { VoiceOver } from '../lib/voice.svelte';
  import FilesCell from './FilesCell.svelte';
  import Find from './Find.svelte';
  import FlagIcon from './FlagIcon.svelte';
  import Take from './Take.svelte';
  import TextField from './TextField.svelte';

  // onChange: something was edited (the Editor saves). onDeleted: a row or section was deleted, or a paste made rows,
  // with the blocks as they were before, so the Editor can offer Undo. onNotice: a message for the person.
  // voice: the rows' voice-over takes (AU-1), kept by the Editor; `name` signs a new take.
  // player: Play the script (AU-2), kept by the Editor; canPlay: a row's number plays from that row (onPlayFrom).
  // flagged: the flagged rows (AP-9), in row order; onFlag flags a row with a note, or clears it (null).
  // root and folderName: the picked folder and this script's folder name, for "From other scripts…" (AS-1).
  // talk: the open comments and suggestions (RV-13): a bubble on their rows, their quotes marked; talking is the one
  // read in the Comments tab; onTalk opens the tab at one (from a bubble, or a click on its quote).
  // finding: the find and replace bar is open (AP-32; Ctrl+F, or ⋯ in the top bar).
  // visit: rows others changed since this person last looked (RV-15), marked; the rows stay editable as ever.
  // came: a file just added to a row from a comment (RV-12), named under its chip.
  let { script = $bindable(), finding = $bindable(), dir, root, folderName, voice, player, canPlay, name, flagged, talk, talking, visit, came = null, onChange, onDeleted, onNotice, onPlayFrom, onFlag, onTalk }: {
    script: Script; finding: boolean; dir: FileSystemDirectoryHandle; root: FileSystemDirectoryHandle; folderName: string; voice: VoiceOver; player: Player; canPlay: boolean; name: string;
    flagged: Map<string, Flag>; onFlag: (row: string, note: string | null) => Promise<boolean>;
    talk: Thread[]; talking: string; onTalk: (id: string) => void; visit: Marks | null;
    came?: { row: string; line: string; from: string } | null;
    onChange: () => void; onPlayFrom: (id: string) => void;
    onDeleted: (before: Block[], what: string) => void; onNotice: (message: string) => void;
  } = $props();

  const words = $derived(sectionWords(script)); // each section's read time (AP-12)
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

  // Find and replace (AP-32, board 44): Ctrl+F opens the bar; with it open, Ctrl+F from elsewhere comes back to it,
  // and from inside it gives the browser's own find.
  let finder = $state<{ focus: () => void }>();
  let findHeight = $state(0);
  let titles = $state({ found: new Set<number>(), on: -1 });
  function findKey(e: KeyboardEvent) {
    if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey || e.key.toLowerCase() !== 'f') return;
    if (finding && (e.target as HTMLElement).closest?.('.find')) return;
    e.preventDefault();
    if (finding) finder?.focus();
    else finding = true;
  }
  const unfold = (field: 'dialogue' | 'onScreen' | 'files') => {
    const key: Column = field === 'onScreen' ? 'screen' : field;
    if (folded.has(key)) fold(key);
  };

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

  // Flags (AP-9, mock-up 22). A new flag puts the cursor in its note; ‹ › step through them in row order.
  let current = $state(''); // the flag stepped to
  const flagIds = $derived([...flagged.keys()]);
  const at = $derived(flagIds.indexOf(current));

  async function toggleFlag(id: string) {
    if (flagged.has(id)) return void onFlag(id, null);
    if (!(await onFlag(id, ''))) return;
    current = id;
    await tick();
    table?.querySelector<HTMLInputElement>(`[data-row="${id}"] .flag-note input`)?.focus();
  }

  function step(by: number) {
    const count = flagIds.length;
    if (!count) return;
    current = flagIds[at < 0 ? (by > 0 ? 0 : count - 1) : (at + by + count) % count];
    table?.querySelector(`[data-row="${current}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  // A note is written when the box is left or Enter is pressed, not on every key.
  function saveNote(id: string, box: HTMLInputElement) {
    const flag = flagged.get(id);
    if (flag && box.value.trim() !== flag.text) onFlag(id, box.value.trim());
  }


  // Review comments (RV-13): each row's open ones, for its bubble; their quotes are marked yellow in the fields
  // (CSS highlights on the formatted text, so not inside the box while it is being typed in).
  const talkByRow = $derived.by(() => {
    const map = new Map<string, Thread[]>();
    for (const t of talk) if (t.comment.row) map.set(t.comment.row, [...(map.get(t.comment.row) ?? []), t]);
    return map;
  });
  const talkRow = $derived(talk.find((t) => t.comment.id === talking)?.comment.row ?? '');
  const quoted = $derived(JSON.stringify(talk.map((t) => {
    const row = script.blocks.find((b) => b.type === 'row' && b.id === t.comment.row);
    return row?.type === 'row' ? [row.dialogue, row.onScreen] : null;
  })));
  $effect(() => {
    const [list, on] = [talk, talking];
    void [quoted, folded]; // the fields' text, and which are drawn
    tick().then(() => {
      if (!table) return;
      const marks: Range[] = [];
      const onMark: Range[] = [];
      for (const t of list) {
        const { row, field, quote } = t.comment;
        if (!quote || field === 'files') continue;
        const shown = table.querySelector<HTMLElement>(`[data-row="${row}"] ${field === 'on_screen' ? '.screen' : '.dialogue'} .shown`);
        const range = shown ? rangeOf(shown, quote) : null;
        if (range) (t.comment.id === on ? onMark : marks).push(range);
      }
      CSS.highlights.set('comment', new Highlight(...marks));
      CSS.highlights.set('comment-on', new Highlight(...onMark));
    });
    return () => ['comment', 'comment-on'].forEach((name) => CSS.highlights.delete(name));
  });

  // A click in a field, on a quote's words, opens the Comments tab at it.
  function clickQuote(id: string, field: 'dialogue' | 'on_screen', box: HTMLTextAreaElement) {
    const at = box.selectionStart;
    if (box.selectionEnd !== at) return;
    const hit = talkByRow.get(id)?.find((t) => {
      const start = t.comment.field === field && t.comment.quote ? box.value.indexOf(t.comment.quote) : -1;
      return start >= 0 && at >= start && at <= start + t.comment.quote!.length;
    });
    if (hit) onTalk(hit.comment.id);
  }

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

  // A row becomes a section where it is, and a section a row (AP-30, mock-up 39), through the Undo bar. The title is
  // the dialogue as plain text; On screen and files stay in a row under it. Its take, flag and comments are put away
  // as a delete would; a section turned back gets a fresh row.
  function toSection(i: number) {
    const row = script.blocks[i];
    if (row.type !== 'row') return;
    const before = [...script.blocks];
    const what = `Row ${numbers.get(row)} is now a section.`; // before the splice renumbers
    const title = plain(row.dialogue).replace(/\s+/g, ' ').trim();
    const section: Block = { type: 'section', title, note: row.note };
    const rest = row.onScreen || row.files.length ? [{ ...emptyRow(script), onScreen: row.onScreen, files: [...row.files] }] : [];
    script.blocks.splice(i, 1, section, ...rest);
    onDeleted(before, what);
    onChange();
  }

  function toRow(i: number) {
    const section = script.blocks[i];
    if (section.type !== 'section') return;
    const before = [...script.blocks];
    script.blocks.splice(i, 1, { ...emptyRow(script), dialogue: section.title, note: section.note });
    onDeleted(before, `Section "${section.title}" is now a row.`);
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

  // Rows others removed since your last look (RV-15): one grey line each, after the row they followed.
  const removedAfter = $derived.by(() => {
    const map = new Map<string, Block[]>();
    for (const { after, row } of visit?.removed ?? []) map.set(after, [...(map.get(after) ?? []), row]);
    return map;
  });

  const focusIf = (node: HTMLInputElement, on: boolean) => {
    if (on) { node.focus(); fresh = null; }
  };
</script>

<svelte:window onkeydown={findKey} />
{#if finding}
  <div class="find-wrap" bind:offsetHeight={findHeight}>
    <Find bind:this={finder} {script} {table} bind:titles onUnfold={unfold} {onChange} {onDeleted} onClose={() => (finding = false)} />
  </div>
{/if}
{#if script.intro}<p class="note">{script.intro}</p>{/if}
{#if flagIds.length}
  <div class="flags">
    <span role="group" aria-label="Flags">
      <FlagIcon />
      <span class="count">{at < 0 ? '' : `${at + 1} of `}{flagIds.length} flagged</span>
      <button aria-label="Previous flag" title="Previous flag" onclick={() => step(-1)}>‹</button>
      <button aria-label="Next flag" title="Next flag" onclick={() => step(1)}>›</button>
    </span>
  </div>
{/if}
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="table" bind:this={table} onkeydown={keys} style:--find-h="{finding ? findHeight : 0}px">
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
  {@render removedRows('')}
  {#each script.blocks as block, i (block)}
    {#if block.type === 'section'}
      <div class="section" data-block={i}>
        <input class="section-title" class:found={titles.found.has(i)} class:found-on={titles.on === i} bind:value={block.title} oninput={onChange} onblur={() => left(block)}
          use:focusIf={fresh === block} placeholder="New section" aria-label="Section title" />
        {#if words.get(block)}<span class="time" title="{words.get(block)} words at {speaking.wpm} words a minute">{clock((words.get(block)! / speaking.wpm) * 60)}</span>{/if}
        <span class="tools">
          <button aria-label="Move section up" title="Move up" onclick={() => move(i, -1)}>↑</button>
          <button aria-label="Move section down" title="Move down" onclick={() => move(i, 1)}>↓</button>
          <button aria-label="Turn section into a row" title="Turn into a row" onclick={() => toRow(i)}>¶</button>
          <button aria-label="Delete section" title="Delete" onclick={() => remove(i)}>×</button>
        </span>
      </div>
    {:else}
      {@const n = numbers.get(block)}
      {@const take = voice.takes[block.id]}
      {@const recording = voice.recording === block.id}
      {@const here = player.row === block.id}
      {@const sounding = voice.playing === block.id || (here && player.on)}
      {@const flag = flagged.get(block.id)}
      {@const said = talkByRow.get(block.id) ?? []}
      {@const was = visit?.changed.get(block.id)}
      {@const by = was !== undefined ? visit?.by.get(block.id) : undefined}
      <div class="row grid" style:grid-template-columns={columns} class:here class:stepped={flag && current === block.id} class:talking={talkRow === block.id}
        class:visited={by} class:visit-on={by && visit?.on === block.id} style:--down="{(said.length ? 34 : 0) + (by ? 58 : 0)}px"
        data-row={block.id} data-block={i} data-visit={by ? block.id : undefined}>
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
          <span class="tools">
            <button aria-label="Move row {n} up" title="Move up" onclick={() => move(i, -1)}>↑</button>
            <button aria-label="Move row {n} down" title="Move down" onclick={() => move(i, 1)}>↓</button>
            <button aria-label="Add a row below row {n}" title="Add a row below" onclick={() => insertRow(i + 1)}>+</button>
            <button aria-label="Delete row {n}" title="Delete" onclick={() => remove(i)}>×</button>
          </span>
          <button class="flag" class:on={flag} disabled={!block.id} onclick={() => toggleFlag(block.id)}
            aria-label={flag ? `Clear the flag on row ${n}` : `Flag row ${n}`} aria-pressed={!!flag} title={flag ? 'Clear the flag' : 'Flag this row'}>
            <FlagIcon filled={!!flag} size={15} />
          </button>
          <button class="promote" aria-label="Turn row {n} into a section" title="Turn into a section" onclick={() => toSection(i)}>§</button>
        </div>
        <div class="mic-cell">
          <button class="mic" class:has={take} class:on={recording && !voice.cue} class:cue={recording && voice.cue} disabled={!block.id}
            onclick={() => mic(block.id)} aria-label={recording ? `Stop recording row ${n}` : take ? `Record row ${n} again` : `Record row ${n}`}>
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
          <div class="dialogue" onclick={(e) => e.target instanceof HTMLTextAreaElement && clickQuote(block.id, 'dialogue', e.target)}><TextField bind:value={block.dialogue} oninput={onChange} label="Dialogue, row {n}" placeholder="What is said"
            onparagraphs={(lines, head, tail) => pasteRows(block, lines, head, tail)} /></div>
          {#if recording}
            {#if voice.cue}<p class="take" role="status">Getting ready…</p>
            {:else}<p class="take rec" role="status">● Recording {clock((now - voice.started) / 1000)} · ■ stops</p>{/if}
          {:else if take}
            <Take {take} dialogue={block.dialogue} n={n ?? 0} {sounding} at={here ? player.at : voice.playing === block.id ? voice.at : 0}
              onPlay={() => play(block.id)}
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
            <div class="screen" onclick={(e) => e.target instanceof HTMLTextAreaElement && clickQuote(block.id, 'on_screen', e.target)}><TextField bind:value={block.onScreen} oninput={onChange} label="On screen, row {n}" placeholder="What the viewer sees" /></div>
          </div>
        {/if}
        {#if folded.has('files')}{@render dot(block.files.length > 0, 'Images & files')}{:else}
          <FilesCell files={block.files} {dir} {root} here={folderName} row={n ?? 0} {onNotice} came={came?.row === block.id ? came : null}
            onChange={(files) => { block.files = files; onChange(); }} />
        {/if}
        {#if flag}
          <div class="flag-note">
            <label>
              <FlagIcon size={13} />
              <input value={flag.text} aria-label="Flag note, row {n}" placeholder="Add a note (optional), e.g. check this fact"
                onchange={(e) => saveNote(block.id, e.currentTarget)} onkeydown={(e) => e.key === 'Enter' && e.currentTarget.blur()} />
            </label>
            {#if !flag.text}
              <button class="chip" onclick={() => onFlag(block.id, 'Needs a source')}>Needs a source</button>
            {/if}
            <span class="by">{flag.who}</span>
            <button class="clear" onclick={() => onFlag(block.id, null)}>Clear</button>
          </div>
        {/if}
      </div>
      {@render removedRows(block.id)}
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

<!-- Show the edits (RV-15): the old words in their own line above the box, never inside it, so typing is as ever. -->
{#snippet before(text: string, name: string, n: number | undefined)}
  <p class="was" aria-label="{name} before, row {n}">{@html toHtml(text) || '(empty)'}</p>
{/snippet}

{#snippet removedRows(after: string)}
  {#each removedAfter.get(after) ?? [] as row (row)}
    {#if row.type === 'row'}
      <p class="removed"><span class="tag">Removed</span><span class="gone"><s>{plain(row.dialogue || row.onScreen || row.files.join(', ')) || '(empty row)'}</s> · {visit?.by.get(row.id)?.who}</span></p>
    {/if}
  {/each}
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
  .find-wrap { position: sticky; top: 0; z-index: 4; }
  .head { position: sticky; top: var(--find-h, 0px); z-index: 2; background: var(--ground); padding-top: 10px; padding-bottom: 10px; font-size: 13px; font-weight: 500; color: var(--muted); border-bottom: 1px solid var(--line); }
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
  .section { display: flex; align-items: center; gap: 12px; padding: 28px 12px 8px; border-bottom: 1px solid var(--line); }
  .section-title { flex: 1; border: 0; padding: 4px 0; font: inherit; font-size: 18px; font-weight: 600; background: none; }
  .section-title:focus { outline: none; background: #f7f9ff; }
  /* A match in a title (AP-32): highlights can't reach inside a box, so the box is tinted. */
  .section-title.found { border-radius: 4px; background: #fff1a8; }
  .section-title.found-on { background: #ffb547; box-shadow: 0 0 0 2px #c26a00; }
  .section .tools { flex-wrap: nowrap; }
  .time { font-size: 13px; color: var(--muted); font-variant-numeric: tabular-nums; }
  .note { margin: 0 0 8px; font-size: 13px; color: var(--muted); white-space: pre-wrap; }
  .adds { display: flex; gap: 8px; margin-top: 12px; }
  /* Flags (AP-9): amber, like the page's other "come back to this" marks. */
  .flags { display: flex; justify-content: flex-end; margin-bottom: 8px; }
  .flags > span { display: inline-flex; align-items: center; gap: 4px; padding: 0 4px 0 12px; border: 1px solid #f5d9b5;
    border-radius: 8px; background: #fff7ed; color: var(--flag); font-size: 13px; }
  .flags .count { padding: 0 6px 0 2px; font-weight: 500; }
  .flags button { min-width: 36px; min-height: 36px; border: 0; border-radius: 6px; background: none; color: var(--flag); font-size: 16px; }
  .flags button:hover { background: #fdebd3; }
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
  .row.talking { border-radius: 8px; background: #f7f9fe; }
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
  .removed { display: flex; align-items: center; gap: 16px; margin: 0; padding: 8px 12px; border-bottom: 1px solid #f0f0f0;
    box-shadow: inset 4px 0 0 #9a9a9a; font-size: 14px; color: var(--muted); }
  .removed .tag { flex: none; font-size: 11px; font-weight: 600; }
  .removed .gone { min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
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
