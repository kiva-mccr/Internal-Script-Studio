<script lang="ts" module>
  // Print's choices: a Notes column on each row, a Notes space at the end, and the text size in %.
  export type PrintChoices = { column: boolean; lines: boolean; scale: number };
</script>

<script lang="ts">
  import { editingText } from '../lib/editing';
  import { keep, recall } from '../lib/remember';
  import type { Shared } from '../lib/share';
  import { shareLink } from '../lib/route';

  type Mode = 'write' | 'review' | 'history' | 'assets';
  let { folder, title, ready, mode, openCount, missingCount, voiceText, play, editors, reviewStatus, status, onAllow, onMode, onStatus, onPrompt, onPrint, onExport, onShare, onPlay, onStop }: {
    folder: string; title: string; ready: boolean; mode: Mode; openCount: number; missingCount: number; voiceText: string; editors: string[]; reviewStatus: string;
    // Play the script (AU-2): null when there is nothing to play here; time is '' until it has started.
    play: { time: string; on: boolean } | null; onPlay: () => void; onStop: () => void;
    status: keyof typeof statusText; onAllow: () => void; onMode: (to: Mode) => void;
    onStatus: (to: 'draft' | 'in review' | 'approved', note: string) => void; onPrompt: () => void; onPrint: (choices: PrintChoices) => void;
    onExport: (to: 'fountain' | 'fdx' | 'voice') => void; onShare: () => Promise<Shared>;
  } = $props();

  const statusText = { saved: 'Saved', waiting: 'Editing…', saving: 'Saving…', failed: "Couldn't save, trying again", conflict: 'Not saved',
    locked: 'Not saved: the browser needs your OK to edit the folder' };
  // What was just copied, said in the menu for a moment before it closes.
  let copied = $state<'' | 'link' | 'teams' | 'failed'>('');
  // Two menus, to keep the bar short (asked by the user): Export / Share (Copy link and Copy for Teams, then Print,
  // Fountain, Final Draft and later exports) and ⋯ (Teleprompter). 'print': Print's choices, under Export.
  let menu = $state<'' | 'more' | 'export' | 'print'>('');
  let moreEl = $state<HTMLElement>();
  let exportEl = $state<HTMLElement>();
  // Room for notes during production (asked by the user): a column on each row, lines at the end. Remembered.
  let printColumn = $state(!!recall('print-notes'));
  let printLines = $state(!!recall('print-lines'));
  let printScale = $state(Number(recall('print-scale')) || 100); // %, the printed text size

  async function copyLink() {
    await copy('link', () => navigator.clipboard.writeText(shareLink(location.href)));
  }

  // Copy for Teams (EX-10): the message as formatted text, and as plain text for apps that don't take formatting.
  // The clipboard is given promises, so the click still counts while the Editor saves and reads History.
  async function copyTeams() {
    const shared = onShare();
    const as = (type: string) => shared.then((s) => new Blob([type === 'text/html' ? s.html : s.text], { type }));
    await copy('teams', () => navigator.clipboard.write([new ClipboardItem({ 'text/html': as('text/html'), 'text/plain': as('text/plain') })]));
  }

  async function copy(what: 'link' | 'teams', write: () => Promise<void>) {
    try {
      await write();
      copied = what;
    } catch {
      copied = 'failed';
    }
    setTimeout(() => ((copied = ''), (menu = '')), copied === 'failed' ? 2500 : 1200);
  }

  function print() {
    menu = '';
    keep('print-notes', printColumn ? '1' : '');
    keep('print-lines', printLines ? '1' : '');
    keep('print-scale', String(printScale));
    onPrint({ column: printColumn, lines: printLines, scale: printScale });
  }

  // A click outside the menu or Esc closes it.
  function away(event: Event) {
    const inside = (el?: HTMLElement) => el?.contains(event.target as Node);
    if (menu && !inside(moreEl) && !inside(exportEl)) menu = '';
  }
</script>

<svelte:window onpointerdown={away} onkeydown={(e) => e.key === 'Escape' && (menu = '')} />

<header class:pinned={play?.time}>
  <nav class="crumbs" class:locked={ready && status === 'locked'} aria-label="Breadcrumb">
    <a href="#/">{folder}</a>
    <span aria-hidden="true">/</span>
    <span class="title">{title}</span>
    <!-- Beside the title, where Word and Google Docs put it (AP-16, the user's pick): it is about the script, not an action. -->
    {#if ready}<span class="status" class:bad={status === 'failed' || status === 'conflict' || status === 'locked'} role="status">{statusText[status]}</span>{/if}
    <!-- The browser took back its OK to edit the folder: only a click can ask again (mock-up 18, option A). -->
    {#if ready && status === 'locked'}<button class="allow" onclick={onAllow}>Allow editing</button>{/if}
  </nav>
  {#if ready}
    <nav class="modes" aria-label="Mode">
      <button aria-current={mode === 'write' ? 'page' : undefined} onclick={() => onMode('write')}>Write</button>
      <button aria-current={mode === 'review' ? 'page' : undefined} onclick={() => onMode('review')}>
        Review{#if openCount}<span class="count" aria-label="{openCount} open">{openCount}</span>{/if}
      </button>
      <button aria-current={mode === 'history' ? 'page' : undefined} onclick={() => onMode('history')}>History</button>
      <button aria-current={mode === 'assets' ? 'page' : undefined} onclick={() => onMode('assets')}>
        Assets{#if missingCount}<span class="count bad" aria-label="{missingCount} missing">{missingCount}</span>{/if}
      </button>
    </nav>
    <div class="right">
      {#if editors.length}
        <span class="editing"><span class="dot" aria-hidden="true"></span>{editingText(editors)}</span>
      {/if}
      {#if reviewStatus === 'in review' && mode === 'review'}
        <button class="outline" onclick={() => onStatus('draft', 'Sent back to writer')}>Send back to writer</button>
        <button class="dark" onclick={() => onStatus('approved', 'Approved')}>Approve</button>
      {:else if reviewStatus !== 'in review'}
        <button class="outline" onclick={() => onStatus('in review', 'Sent for review')}>Send for review</button>
      {/if}
      {#if reviewStatus === 'approved' || (reviewStatus === 'in review' && mode !== 'review')}<span class="state">{reviewStatus === 'approved' ? 'Approved' : 'In review'}</span>{/if}
      {#if play}
        <button class="outline play" class:started={play.time} onclick={onPlay}
          aria-label={!play.time ? 'Play the script' : play.on ? 'Pause the script' : 'Carry on playing the script'}>
          {play.on ? '❚❚' : '▶'} {play.time || 'Play'}
        </button>
        {#if play.time}<button class="outline stop" aria-label="Stop playing" title="Stop" onclick={onStop}>■</button>{/if}
      {/if}
      {#if voiceText}<span class="voice" title="Voice-over: rows recorded, and their length">{voiceText}</span>{/if}
      <span class="more" bind:this={exportEl}>
        <button class="outline" aria-expanded={menu === 'export' || menu === 'print'}
          onclick={() => (menu = menu === 'export' || menu === 'print' ? '' : 'export')}>Export / Share</button>
        {#if menu === 'export'}
          <div class="menu">
            <span class="group">Share</span>
            <button onclick={copyLink}>{copied === 'link' ? 'Link copied' : 'Copy link'}</button>
            <button onclick={copyTeams}>{copied === 'teams' ? 'Copied, paste it in Teams' : 'Copy for Teams'}</button>
            {#if copied === 'failed'}<span class="failed" role="alert">Couldn't copy. Try again.</span>{/if}
            <span class="group rule">Export</span>
            <button onclick={() => (menu = 'print')}>Print…</button>
            <button onclick={() => ((menu = ''), onExport('fountain'))}>Fountain (.fountain)</button>
            <button onclick={() => ((menu = ''), onExport('fdx'))}>Final Draft (.fdx)</button>
            <button onclick={() => ((menu = ''), onExport('voice'))}>Voice-over (.wav)</button>
          </div>
        {:else if menu === 'print'}
          <div class="menu print-menu">
            <label><input type="checkbox" bind:checked={printColumn} /> Notes column on each row</label>
            <label><input type="checkbox" bind:checked={printLines} /> Notes space at the end</label>
            <label class="scale">Text size <input type="range" min="60" max="140" step="5" bind:value={printScale} /> <span>{printScale}%</span></label>
            <button class="dark" onclick={print}>Print</button>
          </div>
        {/if}
      </span>
      <span class="more" bind:this={moreEl}>
        <button class="outline dots" aria-label="More" title="More" aria-expanded={menu === 'more'} onclick={() => (menu = menu === 'more' ? '' : 'more')}>⋯</button>
        {#if menu === 'more'}
          <div class="menu">
            <button onclick={() => ((menu = ''), onPrompt())}>Teleprompter</button>
          </div>
        {/if}
      </span>
    </div>
  {/if}
</header>

<style>
  header { display: flex; flex-wrap: wrap; align-items: center; gap: 12px 16px; padding: 10px 24px; border-bottom: 1px solid var(--line); }
  /* While the script plays (AU-2) the bar stays in view, so Pause and ■ are there as the page follows the rows. */
  .pinned { position: sticky; top: 0; z-index: 5; background: var(--ground); }
  .crumbs { display: flex; align-items: center; gap: 6px; flex: 1 1 280px; min-width: 0; } /* below that the bar wraps */
  /* The long "Not saved" and Allow editing don't fit beside the tabs: the bar wraps instead of hiding them. */
  .crumbs.locked { flex: 1 0 auto; max-width: 100%; }
  .crumbs a { display: inline-flex; align-items: center; min-height: 44px; padding: 0 4px; font-size: 14px; white-space: nowrap; color: var(--muted); text-decoration: none; }
  .crumbs a:hover { color: var(--accent); }
  .crumbs span[aria-hidden] { color: #9a9a9a; }
  .title { font-size: 15px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .right { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 8px; flex: 1 1 auto; }
  .right > * { white-space: nowrap; }
  .editing { display: inline-flex; align-items: center; gap: 8px; padding: 6px 12px; border-radius: 999px; background: #fff4e5;
    color: #7a4a00; font-size: 13px; font-weight: 500; }
  .dot { width: 8px; height: 8px; border-radius: 50%; background: #e08a1e; }
  .modes { display: flex; gap: 2px; padding: 3px; border-radius: 10px; background: #f2f2f2; }
  .modes button { min-height: 40px; padding: 0 18px; border: 0; border-radius: 8px; background: none; color: var(--muted); font-size: 14px; font-weight: 500; }
  .modes button[aria-current] { background: var(--ground); box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08); color: var(--ink); }
  .count { display: inline-block; min-width: 20px; margin-left: 6px; padding: 1px 6px; box-sizing: border-box; border-radius: 10px;
    background: var(--accent); color: #fff; font-size: 12px; text-align: center; }
  .count.bad { background: var(--danger); }
  .dark { min-height: 44px; padding: 0 16px; border: 0; border-radius: 8px; background: var(--ink); color: #fff; font-size: 14px; font-weight: 500; }
  .dark:hover { background: #333; }
  .state { padding: 4px 10px; border-radius: 999px; background: #e7f4ec; color: #1b6b3e; font-size: 13px; font-weight: 500; }
  .status, .voice { font-size: 13px; color: var(--muted); white-space: nowrap; }
  .status { margin-left: 6px; }
  .status.bad { color: var(--danger); }
  .allow { flex: none; min-height: 36px; margin-left: 4px; padding: 0 14px; border: 0; border-radius: 8px; background: var(--ink); color: #fff; font-size: 13px; font-weight: 500; white-space: nowrap; }
  .play { font-variant-numeric: tabular-nums; }
  .play.started { border-color: var(--accent); background: #eef2fb; color: var(--accent); }
  .stop { min-width: 44px; padding: 0; font-size: 12px; }
  .more { position: relative; }
  .dots { min-width: 44px; padding: 0 12px; font-size: 18px; line-height: 1; }
  .menu { position: absolute; z-index: 6; top: calc(100% + 6px); right: 0; display: flex; flex-direction: column; align-items: stretch;
    min-width: 220px; padding: 6px; border: 1px solid var(--line); border-radius: 10px; background: var(--ground);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.10); font-size: 14px; }
  .menu > button:not(.dark) { min-height: 40px; padding: 0 12px; border: 0; border-radius: 6px; background: none; color: var(--ink);
    font-size: 14px; text-align: left; }
  .menu > button:not(.dark):hover { background: #f2f2f2; }
  .group { margin: 4px 12px 2px; font-size: 12px; color: var(--muted); }
  .group.rule { margin-top: 6px; padding-top: 8px; border-top: 1px solid var(--line); }
  .failed { padding: 4px 12px; font-size: 13px; color: var(--danger); }
  .print-menu { gap: 10px; padding: 12px; }
  .print-menu label { display: flex; align-items: center; gap: 8px; min-height: 32px; white-space: nowrap; }
  .scale input { flex: 1; min-width: 120px; }
  .scale span { min-width: 40px; text-align: right; color: var(--muted); }
</style>
