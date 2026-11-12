<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { combinePlans, readPlan, writePlan } from '../lib/planning';
  import { keep, recall } from '../lib/remember';
  import TextField from './TextField.svelte';

  // The planning panel (AP-24, mock-up 23): a tab on the right edge of Write and Review opens notes, an outline and
  // the script's learning goals, kept in plan.md beside script.md. It saves on its own, like the script.
  let { dir }: { dir: FileSystemDirectoryHandle } = $props();

  const SAVE_AFTER = 1500; // ms after the last change, as the script
  const CHECK_EVERY = 5000; // ms between looks for someone else's save
  const RETRY_AFTER = 6000;

  let open = $state(recall('planning-open') === '1'); // this browser's choice, like folded columns
  let text = $state('');
  let ready = $state(false);
  let status = $state<'saved' | 'waiting' | 'saving' | 'failed'>('saved');
  let onDisk = ''; // plan.md as last read or written here
  let timer: ReturnType<typeof setTimeout> | undefined;
  let checker: ReturnType<typeof setInterval> | undefined;
  // The panel fills the window below the top bar, and the whole window once the bar has scrolled away.
  let panel = $state<HTMLElement>();
  let height = $state(0);
  const fit = () => panel && (height = innerHeight - Math.max(0, panel.getBoundingClientRect().top));
  $effect(() => {
    if (panel) fit();
  });

  onMount(async () => {
    try {
      text = onDisk = await readPlan(dir);
      ready = true;
    } catch {
      status = 'failed';
    }
    checker = setInterval(check, CHECK_EVERY);
  });

  onDestroy(() => {
    clearInterval(checker);
    clearTimeout(timer);
    if (status === 'waiting' || status === 'failed') save();
  });

  function toggle() {
    open = !open;
    keep('planning-open', open ? '1' : '');
  }

  function changed() {
    status = 'waiting';
    clearTimeout(timer);
    timer = setTimeout(save, SAVE_AFTER);
  }

  // Someone else's save, read again before writing, is combined with yours (`combinePlans`).
  async function save() {
    clearTimeout(timer);
    if (!ready) return;
    status = 'saving';
    const mine = text;
    try {
      const theirs = await readPlan(dir);
      const next = combinePlans(onDisk, mine, theirs);
      if (next !== theirs) await writePlan(dir, next);
      onDisk = next;
      if (text === mine) {
        text = next;
        status = 'saved';
      } else changed(); // typed while saving
    } catch {
      status = 'failed';
      timer = setTimeout(save, RETRY_AFTER);
    }
  }

  // With nothing waiting, someone else's save shows quietly; a plan read for the first time is read here too.
  async function check() {
    if (document.hidden || (ready && status !== 'saved')) return;
    try {
      const now = await readPlan(dir);
      if (!ready) ((text = onDisk = now), (ready = true), (status = 'saved'));
      else if (now !== onDisk && status === 'saved') text = onDisk = now;
    } catch {
      // OneDrive may be busy; the next look tries again.
    }
  }
</script>

<svelte:window onscroll={fit} onresize={fit} />
<svelte:document onvisibilitychange={() => document.hidden && status === 'waiting' && save()} />

{#if open}
  <aside class="panel" aria-label="Planning" bind:this={panel} style:height={height ? `${height}px` : null}>
    <div class="top">
      <h2>Planning</h2>
      <button class="close" aria-label="Close planning" title="Close" onclick={toggle}>›</button>
    </div>
    <div class="body">
      {#if ready}
        <TextField bind:value={text} oninput={changed} lists label="Planning notes"
          placeholder="Learning goals, an outline, notes… anything that helps you plan this video. Not part of the script." />
      {/if}
    </div>
    <p class="foot" aria-live="polite">
      Kept with the script, in plan.md{status === 'failed' ? " · Couldn't save, trying again" : status === 'saving' ? ' · Saving…' : status === 'waiting' ? ' · Editing…' : ''}
    </p>
  </aside>
{:else}
  <aside class="edge">
    <button class="tab" aria-label="Open planning" title="Open planning" onclick={toggle}>
      <span aria-hidden="true">‹</span><span class="word">Planning</span>
    </button>
  </aside>
{/if}

<style>
  aside { position: sticky; top: 0; flex: 0 0 auto; align-self: flex-start; }
  .edge { padding-top: 72px; }
  .tab { display: flex; flex-direction: column; align-items: center; gap: 8px; width: 34px; min-height: 120px; padding: 12px 0;
    border: 1px solid #dadada; border-right: 0; border-radius: 8px 0 0 8px; background: #fafafa; color: #3d3d3d; font-size: 13px; font-weight: 500; }
  .tab:hover { background: #f0f3fc; color: var(--accent); }
  .tab span:first-child { font-size: 16px; line-height: 1; }
  .word { writing-mode: vertical-rl; transform: rotate(180deg); letter-spacing: 0.02em; }
  .panel { width: 380px; box-sizing: border-box; height: 100vh; display: flex; flex-direction: column; border-left: 1px solid var(--line); background: #fcfcfc; }
  .top { display: flex; align-items: center; justify-content: space-between; padding: 8px 8px 8px 20px; border-bottom: 1px solid #eee; }
  h2 { margin: 0; font-size: 15px; font-weight: 600; }
  .close { min-width: 44px; min-height: 44px; border: 0; border-radius: 8px; background: none; color: #3d3d3d; font-size: 18px; }
  .close:hover { background: #f0f0f0; }
  .body { flex: 1; overflow-y: auto; padding: 12px 20px 16px; font-size: 14px; }
  .body :global(textarea) { min-height: 50vh; }
  .foot { margin: 0; padding: 10px 20px 14px; border-top: 1px solid #f0f0f0; font-size: 12px; color: var(--muted); }
</style>
