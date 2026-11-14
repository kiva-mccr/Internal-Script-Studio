<script lang="ts">
  import type { After } from '../lib/timeline';

  // A hold or placeholder after a row (SB-1): its seconds, and a placeholder's words. Shown under its bar in the
  // script and in the timeline's panel; onSet is called with it changed.
  let { after, n, onSet }: { after: After; n: number; onSet: (after: After) => void } = $props();

  const STEP = $derived(after.kind === 'hold' ? 0.5 : 1);
  const MIN = $derived(after.kind === 'hold' ? 0.5 : 1);
  const seconds = (by: number) => onSet({ ...after, seconds: Math.max(MIN, Math.round((after.seconds + by) * 10) / 10) });
  // The words are saved as they are typed, like any field.
  const words = (label: string) => after.kind === 'placeholder' && onSet({ ...after, label });
</script>

<div class="after-editor">
  {#if after.kind === 'placeholder'}
    <label class="words">What goes here
      <input value={after.label} placeholder="A drone shot, a title card…" aria-label="Placeholder after row {n}: what goes here" oninput={(e) => words(e.currentTarget.value)} />
    </label>
  {:else}
    <span class="help">The last picture stays on screen, in silence, for</span>
  {/if}
  <span class="seconds">
    <button aria-label="Shorter" title="Shorter" onclick={() => seconds(-STEP)} disabled={after.seconds <= MIN}>−</button>
    <span class="value" aria-label="Seconds">{after.seconds} s</span>
    <button aria-label="Longer" title="Longer" onclick={() => seconds(STEP)}>+</button>
  </span>
</div>

<style>
  .after-editor { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 14px; font-size: 13px; color: var(--muted); }
  .words { display: inline-flex; align-items: center; gap: 8px; }
  .words input { width: 260px; max-width: 100%; min-height: 36px; padding: 0 10px; border: 1px solid var(--line-strong); border-radius: 8px; font: inherit; color: var(--ink); }
  .seconds { display: inline-flex; align-items: center; gap: 6px; }
  .seconds button { width: 36px; height: 36px; border: 1px solid var(--line-strong); border-radius: 8px; background: #fff; font-size: 16px; color: var(--ink); }
  .seconds button:disabled { opacity: 0.4; }
  .value { min-width: 44px; text-align: center; font-weight: 600; color: var(--ink); font-variant-numeric: tabular-nums; }
</style>
