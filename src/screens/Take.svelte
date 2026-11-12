<script lang="ts">
  import { clock } from '../lib/readtime.svelte';
  import { span } from '../lib/cleanup.svelte';
  import { outdated, wpm, type Take } from '../lib/voice.svelte';

  // A row's take under its dialogue (AU-1): ▶ and its length, the bar, Outdated, words a minute, who and when.
  // sounding: it is playing (alone or in Play the script); at: how far, 0 to 1.
  // onCurrent and onDrop are Write's (hide Outdated, delete the take); Review leaves them out and only listens (AU-9).
  let { take, dialogue, n, sounding, at, onPlay, onCurrent, onDrop }: {
    take: Take; dialogue: string; n: number; sounding: boolean; at: number; onPlay: () => void;
    onCurrent?: () => void; onDrop?: () => void;
  } = $props();

  const rate = $derived(wpm(take, dialogue));
  const part = $derived(span(take));
  const day = (ms: number) => new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
</script>

<div class="take">
  <button class="play" aria-label="{sounding ? 'Pause' : 'Play'} row {n}" onclick={onPlay}
    title={part.cut ? `${clock(part.seconds)} after cropping ${part.cut} s of silence` : undefined}>
    {sounding ? '❚❚' : '▶'} {clock(part.seconds)}
  </button>
  <span class="bar"><span style:width="{at * 100}%"></span></span>
  {#if outdated(take, dialogue)}<span class="old" title="The line has changed since this take">Outdated{#if onCurrent}<button
    aria-label="Row {n}'s take matches the line: hide Outdated" title="The take already says this: hide Outdated"
    onclick={onCurrent}>×</button>{/if}</span>{/if}
  <span class="about">{rate ? `${rate} wpm` : ''}{rate && take.by ? ' · ' : ''}{take.by ? `${take.by}, ${day(take.at)}` : ''}</span>
  {#if onDrop}<button class="drop" aria-label="Delete the take of row {n}" title="Delete the take" onclick={onDrop}>×</button>{/if}
</div>

<style>
  .take { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 6px 0 0; font-size: 13px; color: var(--muted); }
  .old { display: inline-flex; align-items: center; gap: 2px; padding: 1px 8px; border-radius: 999px; background: #fff4e5;
    color: #7a4a00; font-size: 12px; font-weight: 500; }
  .old:has(button) { padding-right: 2px; }
  .old button { min-width: 20px; min-height: 20px; padding: 0; border: 0; border-radius: 999px; background: none; color: inherit;
    font-size: 14px; cursor: pointer; }
  .old button:hover { background: #ffe3bf; }
  .play { display: inline-flex; align-items: center; gap: 6px; min-height: 28px; padding: 0 10px; border: 1px solid var(--accent);
    border-radius: 999px; background: #eef2fb; color: var(--accent); font-size: 13px; font-weight: 500; }
  .bar { flex: 0 1 72px; height: 4px; border-radius: 2px; background: var(--line); overflow: hidden; }
  .bar span { display: block; height: 100%; background: var(--accent); }
  .drop { min-height: 28px; padding: 0 6px; border: 0; background: none; color: #8a8a8a; font-size: 15px; opacity: 0; }
  /* Seen while the mouse is on the row (Write's .row) or the button has the keyboard. */
  :global(.row:hover) .drop, .drop:focus-visible { opacity: 1; }
  .drop:hover { color: var(--danger); }
</style>
