<script lang="ts">
  import { SORTS, SORT_KEY, type Sort } from '../lib/commentsort';
  import { keep } from '../lib/remember';

  // "Sort Line · Time · Type" above the comment lists (RV-16, board 55); the choice is remembered on this computer.
  let { sort = $bindable() }: { sort: Sort } = $props();
</script>

<div class="sort" role="group" aria-label="Sort comments">
  <span>Sort</span>
  <span class="tabs">
    {#each SORTS as [value, label] (value)}
      <button type="button" aria-pressed={sort === value} onclick={() => keep(SORT_KEY, (sort = value))}>{label}</button>
    {/each}
  </span>
</div>

<style>
  .sort { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--muted); }
  .tabs { display: flex; gap: 2px; padding: 2px; border-radius: 8px; background: #f2f2f2; }
  button { min-height: 28px; padding: 0 9px; border: 0; border-radius: 6px; background: none; color: var(--muted); font-size: 12px; font-weight: 500; }
  button[aria-pressed='true'] { background: #fff; color: var(--ink); box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08); }
</style>
