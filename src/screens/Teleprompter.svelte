<script lang="ts">
  import { onDestroy, onMount, tick } from 'svelte';
  import { plain, toHtml } from '../lib/format';
  import { clock, countWords, SPEED } from '../lib/readtime';
  import { keep, recall } from '../lib/remember';
  import type { Script } from '../lib/script';

  // The teleprompter (EX-2, mock-up 10): the dialogue, big, scrolling past a marker a third of the way down at a
  // speed in words a minute. onClose: back to the script.
  let { script, onClose }: { script: Script; onClose: () => void } = $props();

  let speed = $state(Number(recall('prompter-speed')) || SPEED); // words a minute
  let size = $state(Number(recall('prompter-size')) || 44); // px
  let mirror = $state(!!recall('prompter-mirror')); // flipped left to right, for a teleprompter glass
  let cues = $state(!!recall('prompter-cues')); // the On screen column, small, as cues
  let playing = $state(false);
  let read = $state(0); // words read so far: where the marker is

  let root: HTMLElement;
  let scroller: HTMLElement;
  const lineEls: HTMLElement[] = [];
  // Rows with words, in order: how many words each has and how many come before it.
  const lines = $derived.by(() => {
    let start = 0;
    return script.blocks.flatMap((b, i) => {
      if (b.type !== 'row') return [];
      const words = countWords(b.dialogue);
      const line = { i, words, start };
      start += words;
      return words ? [line] : [];
    });
  });
  const byBlock = $derived(new Map(lines.map((l) => [l.i, l])));
  const total = $derived(lines.reduce((n, l) => n + l.words, 0));
  let frame = 0;
  let lastTime = 0;
  let lastSet = 0; // the scroll position this view set itself; anything else was the person scrolling

  onMount(() => {
    root.focus();
    root.requestFullscreen?.().catch(() => {});
  });
  onDestroy(() => {
    cancelAnimationFrame(frame);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  });

  // Text size, cues and mirror move the lines: put the marker back on the same word.
  $effect(() => {
    void [size, cues, mirror];
    keep('prompter-size', String(size));
    keep('prompter-cues', cues ? '1' : '');
    keep('prompter-mirror', mirror ? '1' : '');
    tick().then(place);
  });
  $effect(() => keep('prompter-speed', String(speed)));

  const markerY = () => scroller.clientHeight / 3;
  const topOf = (el: HTMLElement) => el.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;

  // Scrolls so the word `read` sits at the marker.
  function place() {
    if (!scroller) return;
    const line = lines.findLast((l) => l.start <= read) ?? lines[0];
    const el = line && lineEls[line.i];
    if (!el) return;
    const y = topOf(el) + (Math.min(read - line.start, line.words) / line.words) * el.offsetHeight;
    scroller.scrollTop = y - markerY();
    lastSet = scroller.scrollTop;
  }

  // The person scrolled by hand: the word now at the marker is where it goes on from.
  function scrolled() {
    if (Math.abs(scroller.scrollTop - lastSet) <= 2) return;
    lastSet = scroller.scrollTop;
    const y = scroller.scrollTop + markerY();
    let at = 0;
    for (const line of lines) {
      const el = lineEls[line.i];
      const top = topOf(el);
      if (y < top) break;
      at = line.start + Math.min(1, (y - top) / el.offsetHeight) * line.words;
    }
    read = Math.min(at, total);
  }

  function step(time: number) {
    read = Math.min(total, read + (speed / 60) * ((time - lastTime) / 1000));
    lastTime = time;
    place();
    if (read >= total) playing = false;
    else if (playing) frame = requestAnimationFrame(step);
  }

  function toggle() {
    playing = !playing;
    cancelAnimationFrame(frame);
    if (!playing) return;
    if (read >= total) read = 0; // at the end, Start goes from the top again
    lastTime = performance.now();
    frame = requestAnimationFrame(step);
  }

  const faster = (by: number) => (speed = Math.min(400, Math.max(60, speed + by)));
  const bigger = (by: number) => (size = Math.min(96, Math.max(24, size + by)));

  function key(event: KeyboardEvent) {
    if (event.key === ' ') toggle();
    else if (event.key === 'ArrowUp') faster(10);
    else if (event.key === 'ArrowDown') faster(-10);
    else if (event.key === 'Escape') onClose();
    else return;
    event.preventDefault();
  }
</script>

<svelte:window onkeydown={key} />

<div class="prompter" role="dialog" aria-modal="true" aria-label="Teleprompter" tabindex="-1" bind:this={root}>
  <div class="scroller" bind:this={scroller} onscroll={scrolled}>
    <div class="text" class:mirror style:font-size="{size}px">
      {#each script.blocks as block, i (block)}
        {#if block.type === 'section'}
          <p class="section">{block.title}</p>
        {:else if byBlock.has(i)}
          <p class="line" class:past={byBlock.get(i)!.start + byBlock.get(i)!.words <= read}
            bind:this={lineEls[i]}>{@html toHtml(block.dialogue)}</p>
          {#if cues && block.onScreen.trim()}<p class="cue">[ {plain(block.onScreen)} ]</p>{/if}
        {/if}
      {/each}
    </div>
  </div>
  <div class="marker" aria-hidden="true"></div>

  <div class="controls">
    <button class="play" onclick={toggle}>{playing ? 'Pause' : 'Start'}</button>
    <span class="group" role="group" aria-label="Speed">
      <button aria-label="Slower" onclick={() => faster(-10)}>−</button>
      <span><b>{speed}</b> words a minute</span>
      <button aria-label="Faster" onclick={() => faster(10)}>+</button>
    </span>
    <span class="group" role="group" aria-label="Text size">
      <button aria-label="Smaller text" onclick={() => bigger(-4)}>A−</button>
      <button aria-label="Bigger text" onclick={() => bigger(4)}>A+</button>
    </span>
    <label><input type="checkbox" bind:checked={mirror} /> Mirror</label>
    <label><input type="checkbox" bind:checked={cues} /> On-screen cues</label>
    <span class="left">{clock(((total - read) / speed) * 60)} left</span>
    <button class="exit" onclick={onClose}>Exit</button>
  </div>
</div>

<style>
  .prompter { position: fixed; inset: 0; z-index: 50; background: #0b0b0b; color: #f5f5f5; outline: none; }
  .scroller { position: absolute; inset: 0; overflow-y: auto; scrollbar-width: none; }
  /* The first line starts at the marker; the last can scroll up to it. */
  .text { max-width: 900px; margin: 0 auto; padding: 33vh 32px 70vh; font-weight: 500; line-height: 1.45; }
  .mirror { transform: scaleX(-1); }
  p { margin: 0 0 0.8em; white-space: pre-wrap; }
  .past { color: #6e6e6e; }
  .section { margin: 32px 0 0.4em; font-size: 15px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #6e6e6e; }
  .cue { margin-top: -0.5em; font-size: 0.45em; color: #8fa8e8; }
  .marker { position: absolute; left: 0; right: 0; top: 33.33%; border-top: 2px solid var(--accent); opacity: 0.55; pointer-events: none; }
  .marker::before { content: ''; position: absolute; left: 24px; top: -14px; border: 13px solid transparent; border-left: 18px solid var(--accent); border-right: 0; }
  .controls { position: absolute; left: 50%; bottom: 28px; transform: translateX(-50%); display: flex; flex-wrap: wrap; align-items: center;
    justify-content: center; gap: 14px; width: max-content; max-width: calc(100% - 32px); padding: 10px 14px; border-radius: 14px;
    background: rgba(40, 40, 40, 0.92); font-size: 14px; color: #e6e6e6; }
  .controls button { min-width: 36px; min-height: 36px; border: 1px solid #555; border-radius: 8px; background: none; color: #eee; font-size: 14px; }
  .controls button:hover { border-color: #999; }
  .controls .play { min-width: 88px; min-height: 40px; border: 0; border-radius: 10px; background: var(--accent); color: #fff; font-weight: 600; }
  .group { display: inline-flex; align-items: center; gap: 8px; }
  label { display: inline-flex; align-items: center; gap: 6px; cursor: pointer; }
  .left { color: #9a9a9a; font-variant-numeric: tabular-nums; }
  .controls .exit { padding: 0 12px; }
</style>
