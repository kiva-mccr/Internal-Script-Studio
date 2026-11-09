<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { findScript, readScript, writeScriptFile } from '../lib/folder';
  import { emptyRow, frontValue, newId, parseScript, rows, withAuthor, writeScript, type Block, type Script } from '../lib/script';
  import FilesCell from './FilesCell.svelte';

  let { folder, path, name }: { folder: FileSystemDirectoryHandle; path: string[]; name: string } = $props();

  const SAVE_AFTER = 1500; // ms after the last change
  const CHECK_EVERY = 5000; // ms between looks for someone else's save

  let dir = $state<FileSystemDirectoryHandle | null>(null);
  let script = $state<Script | null>(null);
  let missing = $state(false);
  // saved: all written. waiting: changes not written yet. saving. failed: the last write failed.
  // conflict: someone else saved while you had changes waiting.
  let status = $state<'saved' | 'waiting' | 'saving' | 'failed' | 'conflict'>('saved');
  let notice = $state('');
  // The last delete, kept a few seconds so it can be undone (no browser dialogs: the user's rule).
  let undo = $state<{ blocks: Block[]; what: string } | null>(null);
  let undoTimer: ReturnType<typeof setTimeout> | undefined;
  let copied = $state(false);
  let onDisk = ''; // the text of script.md as last read or written by this page
  let timer: ReturnType<typeof setTimeout> | undefined;
  let checker: ReturnType<typeof setInterval> | undefined;

  const title = $derived(script ? frontValue(script.front, 'title') || path.at(-1) : path.at(-1));
  const numbers = $derived.by(() => {
    const map = new Map<Block, number>();
    let n = 0;
    for (const block of script?.blocks ?? []) if (block.type === 'row') map.set(block, ++n);
    return map;
  });

  onMount(async () => {
    try {
      dir = await findScript(folder, path);
      if (!dir) {
        missing = true;
        return;
      }
      load(await readScript(dir));
      checker = setInterval(checkOutside, CHECK_EVERY);
    } catch {
      notice = "The script couldn't be opened. If OneDrive is still syncing, wait a moment and reload.";
    }
  });

  onDestroy(() => {
    clearInterval(checker);
    if (status === 'waiting') save();
  });

  function load(text: string) {
    const parsed = parseScript(text);
    // Ids are given now, not on save, so a row keeps the same id from its first save on.
    const used = new Set(rows(parsed).map((row) => row.id));
    for (const row of rows(parsed)) if (!row.id) used.add((row.id = newId(used)));
    script = parsed;
    onDisk = text;
    status = 'saved';
  }

  function changed() {
    if (status === 'conflict') return;
    status = 'waiting';
    clearTimeout(timer);
    timer = setTimeout(save, SAVE_AFTER);
  }

  async function save(force = false) {
    if (!dir || !script) return;
    clearTimeout(timer);
    status = 'saving';
    try {
      const now = await readScript(dir);
      if (now !== onDisk && !force) {
        status = 'conflict';
        return;
      }
      script.blocks = script.blocks.filter((b) => b.type === 'row' || b.title.trim() || b.note);
      script.front = withAuthor($state.snapshot(script) as Script, name).front;
      const text = writeScript($state.snapshot(script) as Script);
      if (text !== now) await writeScriptFile(dir, text);
      onDisk = text;
      // Edits typed while saving start another save.
      if (status === 'saving') status = 'saved';
    } catch {
      status = 'failed';
      timer = setTimeout(save, SAVE_AFTER * 4);
    }
  }

  // Someone else saved (OneDrive brought their change): with nothing of yours waiting, show it quietly.
  async function checkOutside() {
    if (!dir || status !== 'saved' || document.hidden) return;
    try {
      const now = await readScript(dir);
      if (now !== onDisk && status === 'saved') load(now);
    } catch {
      // Mid-sync: try again next time.
    }
  }

  async function takeTheirs() {
    if (dir) load(await readScript(dir));
  }

  function move(i: number, by: number) {
    if (!script) return;
    const j = i + by;
    if (j < 0 || j >= script.blocks.length) return;
    [script.blocks[i], script.blocks[j]] = [script.blocks[j], script.blocks[i]];
    changed();
  }

  function insertRow(at: number) {
    if (!script) return;
    script.blocks.splice(at, 0, emptyRow(script));
    changed();
  }

  function remove(i: number) {
    if (!script) return;
    const block = script.blocks[i];
    const what = block.type === 'row' ? `Row ${numbers.get(block)} deleted.` : `Section "${block.title}" deleted (its rows stay).`;
    undo = { blocks: [...script.blocks], what };
    script.blocks.splice(i, 1);
    changed();
    clearTimeout(undoTimer);
    undoTimer = setTimeout(() => (undo = null), 10000);
  }

  function undoDelete() {
    if (!script || !undo) return;
    script.blocks = undo.blocks;
    undo = null;
    changed();
  }

  function addSection() {
    if (!script) return;
    script.blocks.push({ type: 'section', title: 'New section', note: '' }, emptyRow(script));
    changed();
  }

  async function copyLink() {
    await navigator.clipboard.writeText(location.href);
    copied = true;
    setTimeout(() => (copied = false), 2000);
  }

  // Leaving saves what is waiting. Only a failed save, which would lose work, asks the browser to hold the page.
  function beforeUnload(event: BeforeUnloadEvent) {
    if (status === 'waiting') save();
    if (status === 'failed') event.preventDefault();
  }

  const statusText = { saved: 'Saved', waiting: 'Editing…', saving: 'Saving…', failed: "Couldn't save, trying again", conflict: 'Not saved' };
</script>

<svelte:window onbeforeunload={beforeUnload} />
<svelte:document onvisibilitychange={() => document.hidden && status === 'waiting' && save()} />

<header>
  <nav class="crumbs" aria-label="Breadcrumb">
    <a href="#/">{folder.name}</a>
    <span aria-hidden="true">/</span>
    <span class="title">{title}</span>
  </nav>
  {#if script}
    <span class="status" class:bad={status === 'failed' || status === 'conflict'} role="status">{statusText[status]}</span>
    <button class="outline" onclick={copyLink}>{copied ? 'Copied' : 'Copy link'}</button>
  {/if}
</header>

<!-- Messages sit at the bottom of the window, so they are seen wherever you have scrolled to. -->
<div class="toasts">
  {#if status === 'conflict'}
    <div class="banner" role="alert">
      <p>Someone else saved this script while you were editing. Your changes are not saved yet.</p>
      <button class="outline" onclick={takeTheirs}>Show their version (drop mine)</button>
      <button class="outline" onclick={() => save(true)}>Keep mine (replace theirs)</button>
    </div>
  {/if}
  {#if undo}
    <div class="banner quiet" aria-live="polite">
      <p>{undo.what}</p>
      <button class="outline" onclick={undoDelete}>Undo</button>
    </div>
  {/if}
  {#if notice}
    <div class="banner" role="alert">
      <p>{notice}</p>
      <button class="link" onclick={() => (notice = '')}>OK</button>
    </div>
  {/if}
</div>

<main>
  {#if missing}
    <div class="empty">
      <h1>No script called "{path.join(' / ')}"</h1>
      <p>It isn't in {folder.name}. It may have been renamed, or OneDrive may still be bringing it to this computer.</p>
      <p><a href="#/">Back to the list</a></p>
    </div>
  {:else if script && dir}
    {#if script.intro}<p class="note">{script.intro}</p>{/if}
    <div class="table">
      <div class="head grid"><span>#</span><span>Dialogue</span><span>On screen</span><span>Images &amp; files</span></div>
      {#each script.blocks as block, i (block)}
        {#if block.type === 'section'}
          <div class="section">
            <input class="section-title" bind:value={block.title} oninput={changed} aria-label="Section title" />
            <span class="tools">
              <button aria-label="Move section up" title="Move up" onclick={() => move(i, -1)}>↑</button>
              <button aria-label="Move section down" title="Move down" onclick={() => move(i, 1)}>↓</button>
              <button aria-label="Delete section" title="Delete" onclick={() => remove(i)}>×</button>
            </span>
          </div>
        {:else}
          {@const n = numbers.get(block)}
          <div class="row grid">
            <div class="num">
              <span>{n}</span>
              <span class="tools">
                <button aria-label="Move row {n} up" title="Move up" onclick={() => move(i, -1)}>↑</button>
                <button aria-label="Move row {n} down" title="Move down" onclick={() => move(i, 1)}>↓</button>
                <button aria-label="Add a row below row {n}" title="Add a row below" onclick={() => insertRow(i + 1)}>+</button>
                <button aria-label="Delete row {n}" title="Delete" onclick={() => remove(i)}>×</button>
              </span>
            </div>
            <div>
              {#if block.note}<p class="note">{block.note}</p>{/if}
              <textarea class="dialogue" bind:value={block.dialogue} oninput={changed} aria-label="Dialogue, row {n}" placeholder="What is said"></textarea>
            </div>
            <textarea class="screen" bind:value={block.onScreen} oninput={changed} aria-label="On screen, row {n}" placeholder="What the viewer sees"></textarea>
            <FilesCell files={block.files} {dir} onNotice={(m) => (notice = m)}
              onChange={(files) => { block.files = files; changed(); }} />
          </div>
        {/if}
      {/each}
      <div class="adds">
        <button class="link" onclick={() => insertRow(script!.blocks.length)}>+ Add row</button>
        <button class="link" onclick={addSection}>+ Add section</button>
      </div>
    </div>
  {/if}
</main>

<style>
  header { display: flex; flex-wrap: wrap; align-items: center; gap: 12px 16px; padding: 10px 24px; border-bottom: 1px solid var(--line); }
  .crumbs { display: flex; align-items: center; gap: 6px; flex: 1 1 320px; min-width: 0; }
  .crumbs a { display: inline-flex; align-items: center; min-height: 44px; padding: 0 4px; font-size: 14px; color: var(--muted); text-decoration: none; }
  .crumbs a:hover { color: var(--accent); }
  .crumbs span[aria-hidden] { color: #9a9a9a; }
  .title { font-size: 15px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .status { font-size: 13px; color: var(--muted); }
  .status.bad { color: var(--danger); }
  .outline { min-height: 44px; padding: 0 16px; border: 1px solid #dadada; border-radius: 8px; background: #fff; color: var(--ink); font-size: 14px; font-weight: 500; }
  .outline:hover { border-color: var(--accent); }
  .toasts { position: fixed; z-index: 10; left: 50%; bottom: 24px; transform: translateX(-50%); width: min(720px, calc(100% - 32px));
    display: flex; flex-direction: column; gap: 8px; }
  .banner { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; padding: 10px 16px; border-radius: 10px;
    background: #fff7ed; border: 1px solid #f5d9b5; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08); }
  .banner.quiet { background: var(--ground); border-color: var(--line); }
  .banner p { margin: 0; flex: 1 1 300px; font-size: 14px; }
  main { max-width: 1180px; margin: 0 auto; padding: 32px 16px 64px; }
  .table { min-width: 860px; }
  .grid { display: grid; grid-template-columns: 56px minmax(0, 1.25fr) minmax(0, 1fr) minmax(0, 0.8fr); gap: 24px; padding-left: 12px; padding-right: 12px; }
  /* Stays at the top while scrolling. No scrolling box around the table, or it would stick to that instead. */
  .head { position: sticky; top: 0; z-index: 2; background: var(--ground); padding-top: 10px; padding-bottom: 10px; font-size: 13px; font-weight: 500; color: var(--muted); border-bottom: 1px solid var(--line); }
  .row { align-items: start; min-height: 64px; padding-top: 20px; padding-bottom: 20px; border-bottom: 1px solid #f0f0f0; }
  .num { position: relative; font-size: 13px; color: var(--muted); padding-top: 3px; }
  /* Row tools sit over the gutter below the number, so they never make a row taller. */
  .num .tools { position: absolute; top: 24px; left: -6px; display: grid; grid-template-columns: 28px 28px; }
  .tools { display: flex; flex-wrap: wrap; gap: 2px; opacity: 0; }
  .row:hover .tools, .row:focus-within .tools, .section:hover .tools, .section:focus-within .tools { opacity: 1; }
  .tools button { width: 28px; height: 28px; padding: 0; border: 0; border-radius: 6px; background: none; color: var(--muted); font-size: 14px; }
  .tools button:hover { background: #f0f0f0; color: var(--ink); }
  textarea { width: 100%; box-sizing: border-box; margin: 0; padding: 0; border: 0; resize: none; field-sizing: content; min-height: 1.55em;
    font: inherit; line-height: 1.55; color: inherit; background: none; }
  textarea:focus { outline: none; background: #f7f9ff; box-shadow: 0 0 0 6px #f7f9ff; border-radius: 2px; }
  .dialogue { font-size: 17px; }
  .screen { font-size: 15px; color: #3d3d3d; }
  .section { display: flex; align-items: center; gap: 12px; padding: 28px 12px 8px; border-bottom: 1px solid var(--line); }
  .section-title { flex: 1; border: 0; padding: 4px 0; font: inherit; font-size: 18px; font-weight: 600; background: none; }
  .section-title:focus { outline: none; background: #f7f9ff; }
  .section .tools { flex-wrap: nowrap; }
  .note { margin: 0 0 8px; font-size: 13px; color: var(--muted); white-space: pre-wrap; }
  .adds { display: flex; gap: 8px; margin-top: 12px; }
  .empty { text-align: center; padding-top: 10vh; }
  .empty h1 { margin: 0 0 8px; font-size: 22px; font-weight: 600; }
  .empty p { margin: 0 auto 12px; max-width: 460px; color: var(--muted); line-height: 1.5; }
</style>
