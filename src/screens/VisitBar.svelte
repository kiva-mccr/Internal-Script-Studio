<script lang="ts">
  import { names, type Visit } from '../lib/visit';
  import { sinceDay } from '../lib/when';

  // What changed since you last looked (RV-15, board 45): the bar above Write (and Review, when it has no "What's
  // changed" of its own). The count and who, ‹ › through the changed rows, Show the edits, and Got it (clears all).
  // left: some marks were ticked Seen. at: the changed row stepped to (-1 before any step).
  let { visit, left, at, edits = $bindable(), onStep, onDone }: {
    visit: Visit; left: boolean; at: number; edits: boolean; onStep: (by: number) => void; onDone: () => void;
  } = $props();

  const count = $derived(visit.changed.size);
  const removed = $derived(visit.removed.length);
  const head = $derived(count
    ? `${count} ${count === 1 ? 'change' : 'changes'}${left ? ' left' : ''} ${sinceDay(Date.parse(visit.since))}`
    : `${removed} ${removed === 1 ? 'row' : 'rows'} removed ${sinceDay(Date.parse(visit.since))}`);
  const people = $derived(names([...visit.by.values()].map((b) => b.who)));
</script>

<div class="visit" role="group" aria-label="Changed since you last looked">
  <span class="what"><b>{head}</b> by {people}{#if count && removed}{' · '}{removed} {removed === 1 ? 'row' : 'rows'} removed{/if}</span>
  {#if count}
    <span class="steps">
      <button aria-label="Previous change" title="Previous change" onclick={() => onStep(-1)}>‹</button>
      <span class="at">{at < 0 ? '' : `${at + 1} of ${count}`}</span>
      <button aria-label="Next change" title="Next change" onclick={() => onStep(1)}>›</button>
    </span>
    <label class="tick"><input type="checkbox" bind:checked={edits} /> Show the edits</label>
  {/if}
  <button class="done" onclick={onDone}>Got it</button>
</div>

<style>
  .visit { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 12px; margin: 0 0 16px; padding: 4px 4px 4px 14px;
    border-radius: 8px; background: #eef2fb; font-size: 14px; }
  .what { flex: 1 1 320px; }
  .what b { font-weight: 600; }
  .steps { display: inline-flex; align-items: center; gap: 4px; }
  .steps button { min-width: 40px; min-height: 40px; border: 1px solid #c9d5f2; border-radius: 8px; background: #fff; color: var(--ink); font-size: 16px; }
  .steps button:hover { border-color: var(--accent); }
  .at:empty { display: none; }
  .at { min-width: 48px; text-align: center; color: #3d3d3d; font-variant-numeric: tabular-nums; }
  .tick { display: inline-flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 10px; cursor: pointer; }
  .tick input { width: 18px; height: 18px; margin: 0; accent-color: var(--accent); }
  .done { min-height: 44px; padding: 0 14px; border: 0; border-radius: 8px; background: none; color: var(--accent-dark); font: inherit; font-weight: 500; }
  .done:hover { background: #dfe7f8; }
</style>
