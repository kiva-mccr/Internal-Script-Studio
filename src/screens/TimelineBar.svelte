<script lang="ts">
  import AfterEditor from './AfterEditor.svelte';
  import type { After } from '../lib/timeline';

  // A hold or placeholder after a row, as a full-width bar in the script (SB-1, the user's ask on board 63). A click
  // opens the same editing as the timeline's panel under it (open); ✕ removes it at once (Undo in the Undo bar).
  // lit: it is playing.
  let { after, n, open, lit = false, onToggle, onSet, onRemove }: {
    after: After; n: number; open: boolean; lit?: boolean; onToggle: () => void; onSet: (after: After) => void; onRemove: () => void;
  } = $props();
  const name = $derived(after.kind === 'hold' ? 'Hold' : 'Placeholder');
</script>

<div class="bar" class:ph={after.kind === 'placeholder'} class:open class:lit data-after={n}>
  <div class="line">
    <button class="main" aria-expanded={open} aria-label="{name} after row {n}, {after.seconds} seconds" onclick={onToggle}>
      <span class="name">{after.kind === 'hold' ? '❚❚ Hold' : 'Placeholder'}</span>
      <span class="what">{after.kind === 'hold' ? 'The last picture stays on screen, in silence' : after.label || 'Still to find'}</span>
      <span class="len">{after.seconds} s</span>
    </button>
    <button class="x" aria-label="Remove this {name.toLowerCase()}" title="Remove" onclick={onRemove}>✕</button>
  </div>
  {#if open}<div class="edit"><AfterEditor {after} {n} {onSet} /></div>{/if}
</div>

<style>
  .bar { margin: 6px 0; border: 1px solid var(--line-strong); border-radius: 8px; background: #f4f4f4; }
  .bar.ph { border-style: dashed; background: #fafafa; }
  .bar.open { border-color: var(--accent); }
  .bar.lit { border-color: #d9480f; background: #fff1e8; }
  .line { display: flex; align-items: center; }
  .main { flex: 1; display: flex; align-items: center; gap: 12px; min-height: 44px; padding: 8px 14px; border: 0; background: none; font-size: 13px; text-align: left; color: var(--muted); }
  .name { font-weight: 600; color: var(--ink); }
  .what { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .len { font-size: 12px; font-variant-numeric: tabular-nums; }
  .x { width: 44px; height: 44px; margin-right: 2px; border: 0; border-radius: 8px; background: none; color: var(--muted); font-size: 15px; }
  .x:hover { color: var(--danger); }
  .edit { padding: 10px 14px 12px; border-top: 1px solid var(--line); }
</style>
