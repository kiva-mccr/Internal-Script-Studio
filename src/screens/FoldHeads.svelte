<script lang="ts">
  import { COLUMNS, type Folds } from '../lib/folds.svelte';

  // The three column headings, each with its ‹ to fold it away, or the › of a folded one (AP-17, RV-23). Placed in the
  // screen's heading grid after its own first cells.
  let { folds }: { folds: Folds } = $props();
</script>

{#each COLUMNS as col (col.key)}
  {#if folds.has(col.key)}
    <span><button class="unfold" aria-label="Show {col.name}" title="Show {col.name}" onclick={() => folds.toggle(col.key)}>›</button></span>
  {:else}
    <span class="heading">{col.name}
      {#if folds.folded.size < COLUMNS.length - 1}
        <button class="fold" aria-label="Fold {col.name} away" title="Fold away" onclick={() => folds.toggle(col.key)}>‹</button>
      {/if}
    </span>
  {/if}
{/each}

<style>
  .heading { display: flex; align-items: center; gap: 4px; }
  .fold, .unfold { width: 28px; height: 28px; margin: -6px 0; padding: 0; border: 0; border-radius: 6px; background: none;
    color: #8a8a8a; font-size: 16px; }
  .fold:hover, .unfold:hover { background: #f0f0f0; color: var(--ink); }
  .unfold { background: #f2f2f2; color: var(--muted); }
</style>
