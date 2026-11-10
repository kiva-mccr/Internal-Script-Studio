<script lang="ts" module>
  // Print's choices: a Notes column on each row, a Notes space at the end, and the text size in %.
  export type PrintChoices = { column: boolean; lines: boolean; scale: number };
</script>

<script lang="ts">
  import { editingText } from '../lib/editing';

  type Mode = 'write' | 'review' | 'history';
  let { folder, title, ready, mode, openCount, editors, reviewStatus, status, onMode, onStatus, onPrint }: {
    folder: string; title: string; ready: boolean; mode: Mode; openCount: number; editors: string[]; reviewStatus: string;
    status: keyof typeof statusText; onMode: (to: Mode) => void;
    onStatus: (to: 'draft' | 'in review' | 'approved', note: string) => void; onPrint: (choices: PrintChoices) => void;
  } = $props();

  const statusText = { saved: 'Saved', waiting: 'Editing…', saving: 'Saving…', failed: "Couldn't save, trying again", conflict: 'Not saved' };
  let copied = $state(false);
  let printMenu = $state(false); // Print's choices, shown under the button
  // Room for notes during production (asked by the user): a column on each row, lines at the end. Remembered.
  let printColumn = $state(!!remembered('print-notes'));
  let printLines = $state(!!remembered('print-lines'));
  let printScale = $state(Number(remembered('print-scale')) || 100); // %, the printed text size

  async function copyLink() {
    await navigator.clipboard.writeText(location.href);
    copied = true;
    setTimeout(() => (copied = false), 2000);
  }

  function print() {
    printMenu = false;
    try {
      localStorage.setItem('print-notes', printColumn ? '1' : '');
      localStorage.setItem('print-lines', printLines ? '1' : '');
      localStorage.setItem('print-scale', String(printScale));
    } catch {
      // Not remembered (private window): it still prints.
    }
    onPrint({ column: printColumn, lines: printLines, scale: printScale });
  }

  function remembered(key: string): string {
    try {
      return localStorage.getItem(key) ?? '';
    } catch {
      return '';
    }
  }
</script>

<header>
  <nav class="crumbs" aria-label="Breadcrumb">
    <a href="#/">{folder}</a>
    <span aria-hidden="true">/</span>
    <span class="title">{title}</span>
  </nav>
  {#if ready}
    <nav class="modes" aria-label="Mode">
      <button aria-current={mode === 'write' ? 'page' : undefined} onclick={() => onMode('write')}>Write</button>
      <button aria-current={mode === 'review' ? 'page' : undefined} onclick={() => onMode('review')}>
        Review{#if openCount}<span class="count" aria-label="{openCount} open">{openCount}</span>{/if}
      </button>
      <button aria-current={mode === 'history' ? 'page' : undefined} onclick={() => onMode('history')}>History</button>
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
      <span class="status" class:bad={status === 'failed' || status === 'conflict'} role="status">{statusText[status]}</span>
      <span class="print">
        <button class="outline" aria-expanded={printMenu} onclick={() => (printMenu = !printMenu)}>Print</button>
        {#if printMenu}
          <div class="print-menu">
            <label><input type="checkbox" bind:checked={printColumn} /> Notes column on each row</label>
            <label><input type="checkbox" bind:checked={printLines} /> Notes space at the end</label>
            <label class="scale">Text size <input type="range" min="60" max="140" step="5" bind:value={printScale} /> <span>{printScale}%</span></label>
            <button class="dark" onclick={print}>Print</button>
          </div>
        {/if}
      </span>
      <button class="outline" onclick={copyLink}>{copied ? 'Copied' : 'Copy link'}</button>
    </div>
  {/if}
</header>

<style>
  header { display: flex; flex-wrap: wrap; align-items: center; gap: 12px 16px; padding: 10px 24px; border-bottom: 1px solid var(--line); }
  .crumbs { display: flex; align-items: center; gap: 6px; flex: 1 1 320px; min-width: 0; }
  .crumbs a { display: inline-flex; align-items: center; min-height: 44px; padding: 0 4px; font-size: 14px; color: var(--muted); text-decoration: none; }
  .crumbs a:hover { color: var(--accent); }
  .crumbs span[aria-hidden] { color: #9a9a9a; }
  .title { font-size: 15px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .right { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 8px; flex: 1 1 240px; }
  .right > * { white-space: nowrap; }
  .editing { display: inline-flex; align-items: center; gap: 8px; padding: 6px 12px; border-radius: 999px; background: #fff4e5;
    color: #7a4a00; font-size: 13px; font-weight: 500; }
  .dot { width: 8px; height: 8px; border-radius: 50%; background: #e08a1e; }
  .modes { display: flex; gap: 2px; padding: 3px; border-radius: 10px; background: #f2f2f2; }
  .modes button { min-height: 40px; padding: 0 18px; border: 0; border-radius: 8px; background: none; color: var(--muted); font-size: 14px; font-weight: 500; }
  .modes button[aria-current] { background: var(--ground); box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08); color: var(--ink); }
  .count { display: inline-block; min-width: 20px; margin-left: 6px; padding: 1px 6px; box-sizing: border-box; border-radius: 10px;
    background: var(--accent); color: #fff; font-size: 12px; text-align: center; }
  .dark { min-height: 44px; padding: 0 16px; border: 0; border-radius: 8px; background: var(--ink); color: #fff; font-size: 14px; font-weight: 500; }
  .dark:hover { background: #333; }
  .state { padding: 4px 10px; border-radius: 999px; background: #e7f4ec; color: #1b6b3e; font-size: 13px; font-weight: 500; }
  .status { font-size: 13px; color: var(--muted); }
  .status.bad { color: var(--danger); }
  .print { position: relative; }
  .print-menu { position: absolute; z-index: 6; top: calc(100% + 6px); right: 0; display: flex; flex-direction: column; align-items: stretch;
    gap: 10px; padding: 12px; border: 1px solid var(--line); border-radius: 10px; background: var(--ground);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.10); font-size: 14px; }
  .print-menu label { display: flex; align-items: center; gap: 8px; min-height: 32px; white-space: nowrap; }
  .scale input { flex: 1; min-width: 120px; }
  .scale span { min-width: 40px; text-align: right; color: var(--muted); }
</style>
