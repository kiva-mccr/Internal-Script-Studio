<script lang="ts">
  import { problem } from '../lib/problems';
  import { tick } from 'svelte';
  import { clock, sectionWords, speaking } from '../lib/readtime.svelte';
  import { emptyRow, type Block, type Script } from '../lib/script';
  import { plain, rangeOf } from '../lib/format';
  import type { Marks } from '../lib/visit';
  import type { Words } from '../lib/started';
  import type { Flag, Thread } from '../lib/comments';
  import type { Player } from '../lib/play.svelte';
  import { keep, recall } from '../lib/remember';
  import { chosenMic } from '../lib/mic';
  import type { VoiceOver } from '../lib/voice.svelte';
  import Find from './Find.svelte';
  import FlagIcon from './FlagIcon.svelte';
  import WriteRow from './WriteRow.svelte';

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
  // started: each row's words when the script was opened (AP-38), shown under a cell you changed; Put it back.
  let { script = $bindable(), finding = $bindable(), dir, root, folderName, voice, player, canPlay, name, flagged, talk, talking, visit, came = null, started, onChange, onDeleted, onNotice, onPlayFrom, onFlag, onTalk }: {
    script: Script; finding: boolean; dir: FileSystemDirectoryHandle; root: FileSystemDirectoryHandle; folderName: string; voice: VoiceOver; player: Player; canPlay: boolean; name: string;
    flagged: Map<string, Flag>; onFlag: (row: string, note: string | null) => Promise<boolean>;
    talk: Thread[]; talking: string; onTalk: (id: string) => void; visit: Marks | null; started: ReadonlyMap<string, Words>;
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
        if (fellBack) onNotice(`${chosenMic().name || 'The microphone picked in Settings'} isn't plugged in, so this take is recorded with the default microphone.`);
      }
    } catch (e) {
      const blocked = e instanceof DOMException && (e.name === 'NotAllowedError' || e.name === 'NotFoundError');
      onNotice(problem(blocked
        ? 'The microphone is blocked or missing. Allow it in the address bar (the camera and mic icon), then try again.'
        : "The take couldn't be saved in the script's folder. If the shared folder is still syncing, wait a moment and try again.", 'recording a take', e));
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

  // Put it back (AP-38): a cell's words as they were when the script was opened, through the Undo bar.
  function putBack(block: Block, field: 'dialogue' | 'onScreen') {
    const was = block.type === 'row' && started.get(block.id);
    if (!was) return;
    const before = script.blocks.map((b) => (b === block ? { ...b } : b));
    block[field] = was[field];
    onDeleted(before, `Row ${numbers.get(block)}: ${field === 'dialogue' ? 'Dialogue' : 'On screen'} put back.`);
    onChange();
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
      <WriteRow bind:block={() => block, (b) => (script.blocks[i] = b)} {i} n={numbers.get(block)} {columns} {folded} {dir} {root} {folderName} {voice} {player} {canPlay} {name}
        flag={flagged.get(block.id)} stepped={current === block.id} said={talkByRow.get(block.id) ?? []} talking={talkRow === block.id} {visit}
        came={came?.row === block.id ? came : null} start={started.get(block.id)} onPutBack={(field) => putBack(block, field)} {onChange} {onNotice} {onPlayFrom} {onFlag} {onTalk}
        onMove={(by) => move(i, by)} onInsert={() => insertRow(i + 1)} onRemove={() => remove(i)} onToSection={() => toSection(i)}
        onToggleFlag={() => toggleFlag(block.id)} onMic={() => mic(block.id)} onPaste={(lines, head, tail) => pasteRows(block, lines, head, tail)} />
      {@render removedRows(block.id)}
    {/if}
  {/each}
  <div class="adds">
    <button class="link" onclick={() => insertRow(script.blocks.length)}>+ Add row</button>
    <!-- Keeps the cursor in its box on a click, so the section knows where to go. -->
    <button class="link" onmousedown={(e) => e.preventDefault()} onclick={addSection}>+ Add section</button>
  </div>
</div>

{#snippet removedRows(after: string)}
  {#each removedAfter.get(after) ?? [] as row (row)}
    {#if row.type === 'row'}
      <p class="removed"><span class="tag">Removed</span><span class="gone"><s>{plain(row.dialogue || row.onScreen || row.files.join(', ')) || '(empty row)'}</s> · {visit?.by.get(row.id)?.who}</span></p>
    {/if}
  {/each}
{/snippet}

<style>
  .table { min-width: 860px; }
  /* Its columns are set on the element (`columns`), as a folded column is a thin strip. */
  .grid { display: grid; gap: 0 24px; padding-left: 12px; padding-right: 12px; }
  /* Stays at the top while scrolling. No scrolling box around the table, or it would stick to that instead. */
  .find-wrap { position: sticky; top: 0; z-index: 4; }
  .head { position: sticky; top: var(--find-h, 0px); z-index: 2; background: var(--ground); padding-top: 10px; padding-bottom: 10px; font-size: 13px; font-weight: 500; color: var(--muted); border-bottom: 1px solid var(--line); }
  .tools { display: flex; flex-wrap: wrap; gap: 2px; opacity: 0; }
  .section:hover .tools, .section:focus-within .tools { opacity: 1; }
  .tools button { width: 28px; height: 28px; padding: 0; border: 0; border-radius: 6px; background: none; color: var(--muted); font-size: 14px; }
  .tools button:hover { background: #f0f0f0; color: var(--ink); }
  .heading { display: flex; align-items: center; gap: 4px; }
  .fold, .unfold { width: 28px; height: 28px; margin: -6px 0; padding: 0; border: 0; border-radius: 6px; background: none;
    color: #8a8a8a; font-size: 16px; }
  .fold:hover, .unfold:hover { background: #f0f0f0; color: var(--ink); }
  .unfold { background: #f2f2f2; color: var(--muted); }
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
  .removed { display: flex; align-items: center; gap: 16px; margin: 0; padding: 8px 12px; border-bottom: 1px solid #f0f0f0;
    box-shadow: inset 4px 0 0 #9a9a9a; font-size: 14px; color: var(--muted); }
  .removed .tag { flex: none; font-size: 11px; font-weight: 600; }
  .removed .gone { min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
</style>
