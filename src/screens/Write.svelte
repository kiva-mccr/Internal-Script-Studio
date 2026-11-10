<script lang="ts">
  import { clock } from '../lib/readtime';
  import { emptyRow, type Block, type Script } from '../lib/script';
  import { outdated, wpm, type VoiceOver } from '../lib/voice.svelte';
  import FilesCell from './FilesCell.svelte';
  import TextField from './TextField.svelte';

  // onChange: something was edited (the Editor saves). onDeleted: a row or section was deleted, with the blocks as
  // they were before, so the Editor can offer Undo. onNotice: a message for the person.
  // voice: the rows' voice-over takes (AU-1), kept by the Editor; `name` signs a new take.
  let { script = $bindable(), dir, voice, name, onChange, onDeleted, onNotice }: {
    script: Script; dir: FileSystemDirectoryHandle; voice: VoiceOver; name: string; onChange: () => void;
    onDeleted: (before: Block[], what: string) => void; onNotice: (message: string) => void;
  } = $props();

  const numbers = $derived.by(() => {
    const map = new Map<Block, number>();
    let n = 0;
    for (const block of script.blocks) if (block.type === 'row') map.set(block, ++n);
    return map;
  });

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
        await voice.start(id);
        now = Date.now();
      }
    } catch (e) {
      const blocked = e instanceof DOMException && (e.name === 'NotAllowedError' || e.name === 'NotFoundError');
      onNotice(blocked
        ? 'The microphone is blocked or missing. Allow it in the address bar (the camera and mic icon), then try again.'
        : "The take couldn't be saved in the script's folder. If OneDrive is still syncing, wait a moment and try again.");
    }
  }

  async function play(id: string) {
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
  <div class="head grid"><span>#</span><span></span><span>Dialogue</span><span>On screen</span><span>Images &amp; files</span></div>
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
      {@const take = voice.takes[block.id]}
      {@const recording = voice.recording === block.id}
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
        <div class="mic-cell">
          <button class="mic" class:has={take} class:on={recording} disabled={!block.id} onclick={() => mic(block.id)}
            aria-label={recording ? `Stop recording row ${n}` : take ? `Record row ${n} again` : `Record row ${n}`}
            title={recording ? 'Stop' : take ? 'Record again' : 'Record'}>
            {#if recording}■{:else}{@render micIcon()}{/if}
          </button>
        </div>
        <div>
          {#if block.note}<p class="note">{block.note}</p>{/if}
          <div class="dialogue"><TextField bind:value={block.dialogue} oninput={onChange} label="Dialogue, row {n}" placeholder="What is said" /></div>
          {#if recording}
            <p class="take rec" role="status">● Recording {clock((now - voice.started) / 1000)} · ■ stops</p>
          {:else if take}
            {@const rate = wpm(block.dialogue, take.seconds)}
            <div class="take">
              <button class="play" aria-label="{voice.playing === block.id ? 'Pause' : 'Play'} row {n}" onclick={() => play(block.id)}>
                {voice.playing === block.id ? '❚❚' : '▶'} {clock(take.seconds)}
              </button>
              <span class="bar"><span style:width="{(voice.playing === block.id ? voice.at : 0) * 100}%"></span></span>
              {#if outdated(take, block.dialogue)}<span class="old" title="The line has changed since this take">Outdated</span>{/if}
              <span class="about">{rate ? `${rate} wpm` : ''}{rate && take.by ? ' · ' : ''}{take.by ? `${take.by}, ${day(take.at)}` : ''}</span>
              <button class="drop" aria-label="Delete the take of row {n}" title="Delete the take"
                onclick={() => voice.remove(dir, block.id).catch(() => onNotice("The take couldn't be deleted."))}>×</button>
            </div>
          {/if}
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
  .grid { display: grid; grid-template-columns: 40px 28px minmax(0, 1.25fr) minmax(0, 1fr) minmax(0, 0.8fr); gap: 0 24px; padding-left: 12px; padding-right: 12px; }
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
