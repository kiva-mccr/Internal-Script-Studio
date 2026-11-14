<script lang="ts">
  // Who else is here (AP-37, board 62): "Sam is editing" as before, or else the last person here ("Sam was here
  // 12 min ago", "Sam last seen 3 min ago" when they went quiet without leaving). A click lists everyone.
  import { editingText, lastHereText, seenWhen, type Seen } from '../lib/editing';
  import { at } from '../lib/when';
  let { editors, folding = '', seen }: { editors: string[]; folding?: string; seen: Seen[] } = $props();
  let open = $state(false);
  let el = $state<HTMLElement>();
  // Worked out again at each 5 s check, which brings a new list, so "2 min ago" moves on.
  const now = $derived.by(() => (void seen, void editors, Date.now()));
  const last = $derived(editors.length ? '' : lastHereText(seen, now));
  const quiet = $derived(seen[0]?.state === 'quiet');
  const hover = $derived(!last ? 'Who has been here'
    : quiet ? `${seen[0].who}’s computer stopped checking in at ${at(seen[0].time, now)} without leaving the script. Their last few changes may not be in yet.`
    : `${seen[0].who} left the script at ${at(seen[0].time, now)}`);
  $effect(() => {
    if (!editors.length && !last) open = false;
  });
  function away(event: Event) {
    if (open && !el?.contains(event.target as Node)) open = false;
  }
</script>

<svelte:window onpointerdown={away} onkeydown={(e) => e.key === 'Escape' && (open = false)} />
{#if editors.length || last}
  <span class="presence" data-tour="presence" bind:this={el}>
    {#if editors.length}
      <button class="editing" aria-expanded={open} onclick={() => (open = !open)}>
        <span class="dot" aria-hidden="true"></span>{editingText(editors)}{#if folding}<span class="spin" role="img" aria-label="Bringing in {folding}’s changes" title="Bringing in {folding}’s changes"></span>{/if}
      </button>
    {:else}
      <button class="last" class:quiet aria-expanded={open} title={hover} onclick={() => (open = !open)}>
        <span class="ring" aria-hidden="true"></span>{last}
      </button>
    {/if}
    {#if open}
      <div class="list" role="region" aria-label="Who has been here">
        <p class="head">Who has been here</p>
        {#each seen as person (person.who)}
          <p class="person"><span class="mark {person.state}" aria-hidden="true"></span><b>{person.who}</b><span class="when">{seenWhen(person, now)}</span></p>
        {/each}
        <p class="foot">Anyone who opened this script in the last 30 days.</p>
      </div>
    {/if}
  </span>
{/if}

<style>
  .presence { position: relative; }
  button { display: inline-flex; align-items: center; gap: 8px; min-height: 36px; padding: 6px 12px; border: 0; border-radius: 999px;
    font-size: 13px; white-space: nowrap; cursor: pointer; }
  .editing { background: #fff4e5; color: #7a4a00; font-weight: 500; }
  .editing:hover, .editing[aria-expanded='true'] { background: #ffe9cc; }
  .last { background: none; color: var(--muted); }
  .last:hover, .last[aria-expanded='true'] { background: #f2f2f2; }
  .dot, .mark.editing { width: 8px; height: 8px; border-radius: 50%; background: #e08a1e; }
  .ring, .mark { flex: none; box-sizing: border-box; width: 8px; height: 8px; border-radius: 50%; border: 2px solid #8a8a8a; }
  .quiet .ring, .mark.quiet { border-color: #b45309; }
  .mark.editing { border: 0; }
  .spin { width: 10px; height: 10px; border-radius: 50%; border: 2px solid #e08a1e; border-right-color: transparent; animation: spin 0.8s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .spin { animation-duration: 2.4s; } }
  .list { position: absolute; z-index: 6; top: calc(100% + 6px); right: 0; width: 300px; padding: 12px 0 8px; border: 1px solid var(--line);
    border-radius: 10px; background: var(--ground); box-shadow: 0 4px 16px rgba(0, 0, 0, 0.10); font-size: 14px; white-space: normal; }
  .list p { margin: 0; }
  .head { padding: 0 16px 6px; font-size: 12px; font-weight: 600; color: var(--muted); }
  .person { display: flex; align-items: center; gap: 10px; padding: 7px 16px; }
  .person b { flex: 1 1 auto; font-weight: 500; overflow: hidden; text-overflow: ellipsis; }
  .when { color: var(--muted); white-space: nowrap; }
  .foot { margin-top: 6px !important; padding: 8px 16px 0; border-top: 1px solid var(--line); font-size: 12px; line-height: 1.5; color: var(--muted); }
</style>
