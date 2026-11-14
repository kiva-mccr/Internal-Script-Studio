<script lang="ts">
  import { problem } from '../lib/problems';
  import CopyDetails from './CopyDetails.svelte';
  import { onDestroy, onMount, type Snippet } from 'svelte';
  import { combinePlans, readPlan, writePlan } from '../lib/planning';
  import { keep } from '../lib/remember';
  import TextField from './TextField.svelte';

  // The planning panel (AP-24, mock-up 23): a tab on the right edge of Write and Review opens notes, an outline and
  // the script's learning goals, kept in plan.md beside script.md. It saves on its own, like the script.
  // In Write the same panel has a second tab, Comments (RV-13, board 37): `comments` is its content, `count` the open ones.
  // Open or closed, and which tab, are this browser's (the Editor opens it on Comments after a send back).
  let {
    dir,
    comments,
    count = 0,
    open = $bindable(),
    tab = $bindable(),
  }: { dir: FileSystemDirectoryHandle; comments?: Snippet; count?: number; open: boolean; tab: 'planning' | 'comments' } = $props();

  const SAVE_AFTER = 1500; // ms after the last change, as the script
  const CHECK_EVERY = 5000; // ms between looks for someone else's save
  const RETRY_AFTER = 6000;
  const PLAN_FAILED = "The plan couldn't be saved, trying again"; // the copy icon's key; the foot says it shorter

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

  // Kept in this browser, like folded columns.
  $effect(() => keep('planning-open', open ? '1' : ''));
  $effect(() => keep('side-tab', tab === 'comments' ? 'comments' : ''));
  const showing = $derived(comments && tab === 'comments' ? 'comments' : 'planning');
  const show = (to: 'planning' | 'comments') => ((tab = to), (open = true));

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
    } catch (e) {
      problem(PLAN_FAILED, 'saving plan.md', e);
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
  <aside class="panel" data-tour="side" aria-label={showing === 'comments' ? 'Comments' : 'Planning'} bind:this={panel} style:height={height ? `${height}px` : null}>
    <div class="top">
      {#if comments}
        <div class="tabs" role="group" aria-label="Panel">
          <button aria-pressed={showing === 'planning'} onclick={() => (tab = 'planning')}>Planning</button>
          <button aria-pressed={showing === 'comments'} onclick={() => (tab = 'comments')}>Comments · {count}</button>
        </div>
      {:else}
        <h2>Planning</h2>
      {/if}
      <button class="close" aria-label="Close {showing}" title="Close" onclick={() => (open = false)}>›</button>
    </div>
    {#if showing === 'comments'}
      <div class="body">{@render comments?.()}</div>
    {:else}
      <div class="body plan">
        {#if ready}
          <TextField bind:value={text} oninput={changed} lists label="Planning notes"
            placeholder="Learning goals, an outline, notes… anything that helps you plan this video. Not part of the script." />
        {/if}
      </div>
      <p class="foot" aria-live="polite">
        Kept with the script, in plan.md{status === 'failed' ? " · Couldn't save, trying again" : status === 'saving' ? ' · Saving…' : status === 'waiting' ? ' · Editing…' : ''}{#if status === 'failed'}<CopyDetails message={PLAN_FAILED} />{/if}
      </p>
    {/if}
  </aside>
{:else}
  <aside class="edge" data-tour="side">
    <button class="tab" aria-label="Open planning" title="Open planning" onclick={() => show('planning')}>
      <span aria-hidden="true">‹</span><span class="word">Planning</span>
    </button>
    {#if comments}
      <button class="tab talk" aria-label="Open comments, {count} open" title="Open comments" onclick={() => show('comments')}>
        <span aria-hidden="true">‹</span><span class="word">Comments · {count}</span>
      </button>
    {/if}
  </aside>
{/if}

<style>
  aside { position: sticky; top: 0; flex: 0 0 auto; align-self: flex-start; }
  .edge { display: flex; flex-direction: column; gap: 8px; padding-top: 72px; }
  .tab { display: flex; flex-direction: column; align-items: center; gap: 8px; width: 34px; min-height: 120px; padding: 12px 0;
    border: 1px solid #dadada; border-right: 0; border-radius: 8px 0 0 8px; background: #fafafa; color: #3d3d3d; font-size: 13px; font-weight: 500; }
  .tab:hover { background: #f0f3fc; color: var(--accent); }
  .tab.talk { border-color: #c9d6f5; background: #eef2fb; color: var(--accent); }
  .tab span:first-child { font-size: 16px; line-height: 1; }
  .word { writing-mode: vertical-rl; transform: rotate(180deg); letter-spacing: 0.02em; }
  .panel { width: 380px; box-sizing: border-box; height: 100vh; display: flex; flex-direction: column; border-left: 1px solid var(--line); background: #fcfcfc; }
  .top { display: flex; align-items: center; justify-content: space-between; padding: 8px 8px 8px 12px; border-bottom: 1px solid #eee; }
  .tabs { display: flex; gap: 2px; padding: 3px; border-radius: 8px; background: #f2f2f2; }
  .tabs button { min-height: 34px; padding: 0 12px; border: 0; border-radius: 6px; background: none; color: var(--muted); font-size: 13px; font-weight: 500; }
  .tabs button[aria-pressed='true'] { background: #fff; color: var(--ink); box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08); }
  h2 { margin: 0 0 0 8px; font-size: 15px; font-weight: 600; }
  .close { min-width: 44px; min-height: 44px; border: 0; border-radius: 8px; background: none; color: #3d3d3d; font-size: 18px; }
  .close:hover { background: #f0f0f0; }
  .body { flex: 1; overflow-y: auto; padding: 12px 20px 16px; font-size: 14px; }
  .plan :global(textarea) { min-height: 50vh; }
  .foot { margin: 0; padding: 10px 20px 14px; border-top: 1px solid #f0f0f0; font-size: 12px; color: var(--muted); }
</style>
