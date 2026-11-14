<script lang="ts">
  import type { Field } from '../lib/comments';

  // The small Comment button above selected words in Review (RV-22, board 56). Selecting only shows it; the comment
  // box opens when it is pressed. `script` is the positioned element the button is placed in.
  let { script, onComment }: {
    script: HTMLElement | undefined;
    onComment: (t: { row: string; field: Field; quote: string }) => void;
  } = $props();

  let pick = $state<{ row: string; field: Field; quote: string; x: number; y: number } | null>(null);

  // Called on mouseup in a cell: a selection that starts and ends in it shows the button above its end.
  export function look(row: string, field: Field, cell: HTMLElement) {
    const sel = window.getSelection();
    const quote = sel?.toString().trim();
    if (!sel || sel.isCollapsed || !quote || !script || !cell.contains(sel.anchorNode) || !cell.contains(sel.focusNode))
      return void (pick = null);
    const rects = sel.getRangeAt(0).getClientRects();
    const end = rects[rects.length - 1] ?? sel.getRangeAt(0).getBoundingClientRect();
    const box = script.getBoundingClientRect();
    const x = Math.min(Math.max(end.right - box.left, 48), box.width - 48);
    pick = { row, field, quote, x, y: end.top - box.top };
  }

  // Gone with the selection: a click elsewhere, Esc, or nothing selected.
  function changed() {
    if (pick && window.getSelection()?.isCollapsed) pick = null;
  }
  function key(e: KeyboardEvent) {
    if (e.key === 'Escape' && pick) pick = null;
  }
</script>

<svelte:document onselectionchange={changed} />
<svelte:window onkeydown={key} />

{#if pick}
  <button class="pick" style:left="{pick.x}px" style:top="{pick.y}px" aria-label="Comment on the selected words"
    onmousedown={(e) => e.preventDefault()}
    onclick={() => { const { row, field, quote } = pick!; pick = null; onComment({ row, field, quote }); }}>
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
      stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
    Comment
  </button>
{/if}

<style>
  .pick { position: absolute; z-index: 3; transform: translate(-50%, calc(-100% - 6px)); display: flex; align-items: center;
    gap: 6px; min-height: 34px; padding: 0 12px; border: 0; border-radius: 8px; background: var(--ink); color: var(--ground);
    font-family: inherit; font-size: 13px; font-weight: 500; white-space: nowrap; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18); cursor: pointer; }
</style>
