<script lang="ts">
  import type { Clash, Side } from '../lib/merge';

  // Two saves made at the same time (mock-up 6). Each field both sides changed is shown side by side; the person
  // picks one per field, then saves the combined version.
  let {
    clashes,
    heading,
    mineLabel,
    theirsLabel,
    combined,
    onSave,
  }: {
    clashes: Clash[];
    heading: string; // "Sam and you both saved at the same time"
    mineLabel: string; // "Yours"
    theirsLabel: string; // "Sam's"
    combined: string; // "Also combined: row 2 (only Sam changed it)…", or empty
    onSave: (picks: Record<string, Side>) => void;
  } = $props();

  let picks = $state<Record<string, Side>>({});
  const done = $derived(clashes.every((c) => picks[c.key]));
</script>

<div class="conflict">
  <div class="banner">
    <div>
      <h1>{heading}</h1>
      <p>
        Rows only one of you changed are already combined. Pick whose version to keep for the
        {clashes.length === 1 ? 'one place' : `${clashes.length} places`} you both changed. Nothing is lost: both
        versions stay in History.
      </p>
    </div>
    <button class="primary" disabled={!done} onclick={() => onSave(picks)}>
      {done ? 'Save combined version' : clashes.length === 1 ? 'Pick one to save' : 'Pick each to save'}
    </button>
  </div>

  {#each clashes as clash (clash.key)}
    <section aria-label={clash.where}>
      <div class="where">{clash.where}</div>
      <div class="sides">
        {#each [['mine', mineLabel, clash.mine], ['theirs', theirsLabel, clash.theirs]] as [side, label, text] (side)}
          <button class="side" class:on={picks[clash.key] === side} aria-pressed={picks[clash.key] === side}
            onclick={() => (picks[clash.key] = side as Side)}>
            <span class="label">{label}<span class="tag">{picks[clash.key] === side ? 'Keeping this' : 'Keep this'}</span></span>
            <span class="text">{text}</span>
          </button>
        {/each}
      </div>
    </section>
  {/each}

  {#if combined}<p class="also">{combined}</p>{/if}
</div>

<style>
  .conflict { display: flex; flex-direction: column; gap: 20px; }
  .banner { display: flex; flex-wrap: wrap; align-items: center; gap: 12px 24px; padding: 16px 20px; border: 1px solid #f5d9b5;
    border-radius: 10px; background: #fff7ed; }
  .banner > div { flex: 1 1 420px; display: flex; flex-direction: column; gap: 4px; }
  h1 { margin: 0; font-size: 18px; font-weight: 600; }
  .banner p { margin: 0; font-size: 14px; line-height: 1.5; color: var(--muted); }
  .primary:disabled { background: #9db3ea; cursor: default; }
  section { border: 1px solid var(--line); border-radius: 10px; overflow: hidden; }
  .where { padding: 10px 16px; font-size: 13px; color: var(--muted); background: #fafafa; border-bottom: 1px solid var(--line); }
  .sides { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; padding: 16px; }
  .side { display: flex; flex-direction: column; align-items: stretch; gap: 10px; padding: 14px 16px; border: 2px solid var(--line);
    border-radius: 10px; background: #fff; text-align: left; }
  .side:hover { border-color: #b9c7ee; }
  .side.on { border-color: var(--accent); background: #f0f3fc; }
  .label { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 13px; font-weight: 600; color: #3d3d3d; }
  .tag { font-weight: 500; color: var(--muted); }
  .on .tag { color: var(--accent); }
  .text { font-size: 16px; line-height: 1.55; color: var(--ink); white-space: pre-wrap; }
  .also { margin: 0; font-size: 14px; color: var(--muted); }
</style>
