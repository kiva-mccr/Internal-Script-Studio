<script lang="ts">
  import { emptyRow, type Block, type Script } from '../lib/script';
  import FilesCell from './FilesCell.svelte';
  import TextField from './TextField.svelte';

  // onChange: something was edited (the Editor saves). onDeleted: a row or section was deleted, with the blocks as
  // they were before, so the Editor can offer Undo. onNotice: a message for the person.
  let { script = $bindable(), dir, onChange, onDeleted, onNotice }: {
    script: Script; dir: FileSystemDirectoryHandle; onChange: () => void;
    onDeleted: (before: Block[], what: string) => void; onNotice: (message: string) => void;
  } = $props();

  const numbers = $derived.by(() => {
    const map = new Map<Block, number>();
    let n = 0;
    for (const block of script.blocks) if (block.type === 'row') map.set(block, ++n);
    return map;
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

  function remove(i: number) {
    const block = script.blocks[i];
    const what = block.type === 'row' ? `Row ${numbers.get(block)} deleted.` : `Section "${block.title}" deleted (its rows stay).`;
    const before = [...script.blocks];
    script.blocks.splice(i, 1);
    onDeleted(before, what);
    onChange();
  }

  function addSection() {
    script.blocks.push({ type: 'section', title: 'New section', note: '' }, emptyRow(script));
    onChange();
  }
</script>

{#if script.intro}<p class="note">{script.intro}</p>{/if}
<div class="table">
  <div class="head grid"><span>#</span><span>Dialogue</span><span>On screen</span><span>Images &amp; files</span></div>
  {#each script.blocks as block, i (block)}
    {#if block.type === 'section'}
      <div class="section">
        <input class="section-title" bind:value={block.title} oninput={onChange} aria-label="Section title" />
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
          <div class="dialogue"><TextField bind:value={block.dialogue} oninput={onChange} label="Dialogue, row {n}" placeholder="What is said" /></div>
        </div>
        <div class="screen"><TextField bind:value={block.onScreen} oninput={onChange} label="On screen, row {n}" placeholder="What the viewer sees" /></div>
        <FilesCell files={block.files} {dir} {onNotice}
          onChange={(files) => { block.files = files; onChange(); }} />
      </div>
    {/if}
  {/each}
  <div class="adds">
    <button class="link" onclick={() => insertRow(script.blocks.length)}>+ Add row</button>
    <button class="link" onclick={addSection}>+ Add section</button>
  </div>
</div>

<style>
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
  .dialogue { font-size: 17px; }
  .screen { font-size: 15px; color: #3d3d3d; }
  .section { display: flex; align-items: center; gap: 12px; padding: 28px 12px 8px; border-bottom: 1px solid var(--line); }
  .section-title { flex: 1; border: 0; padding: 4px 0; font: inherit; font-size: 18px; font-weight: 600; background: none; }
  .section-title:focus { outline: none; background: #f7f9ff; }
  .section .tools { flex-wrap: nowrap; }
  .note { margin: 0 0 8px; font-size: 13px; color: var(--muted); white-space: pre-wrap; }
  .adds { display: flex; gap: 8px; margin-top: 12px; }
</style>
