<script lang="ts">
  import { onDestroy, onMount, tick, untrack } from 'svelte';
  import { clearMarks, plain, toHtml } from '../lib/format';
  import { addMark, follow, LEAD, move, normal, voiceAt, type Mark } from '../lib/follow';
  import { listen, type ListenError, type Listening } from '../lib/listen';
  import { clock, countWords, setSpeed, speaking } from '../lib/readtime.svelte';
  import { keep, recall } from '../lib/remember';
  import type { Script } from '../lib/script';

  // The teleprompter (EX-2, mock-up 10): the dialogue, big, scrolling past a marker a third of the way down at a
  // speed in words a minute, or following the voice of whoever reads it (EX-8). from: the block it opens at (AU-7).
  // onClose: back to the script.
  let { script, from = 0, onClose }: { script: Script; from?: number; onClose: () => void } = $props();

  const speed = $derived(speaking.wpm); // words a minute, shared with read time (AP-12)
  let size = $state(Number(recall('prompter-size')) || 44); // px
  let mirror = $state(!!recall('prompter-mirror')); // flipped left to right, for a teleprompter glass
  let cues = $state(!!recall('prompter-cues')); // the On screen column, small, as cues
  let playing = $state(false);
  let read = $state(0); // words read so far: where the marker is
  // Follow my voice (EX-8): '' off, 'loading' (microphone, then the one-time download), 'on' listening.
  let voice = $state<'' | 'loading' | 'on'>('');
  let got = $state({ loaded: 0, total: 0 }); // the download, in bytes
  let voiceError = $state('');
  let heardAt = 0; // the word the voice was last heard at
  let marks: Mark[] = []; // the places heard in the last few seconds: where the voice is and its pace (EX-12)
  let pace = 0; // words a second until the marks tell
  let jump = -1; // a far place heard once: it is followed only if the next hearing agrees (EX-12)
  let listening: Listening | null = null;
  let voiceBox: HTMLInputElement;

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
  // It opens at the first line from that block on (AU-7); Follow my voice listens from there too.
  read = untrack(() => lines.find((l) => l.i >= from)?.start ?? 0);
  const total = $derived(lines.reduce((n, l) => n + l.words, 0));
  // Every word of the dialogue, as compared with what is heard; counted the same way as `lines`.
  const scriptWords = $derived(
    script.blocks.flatMap((b) => (b.type === 'row' ? clearMarks(b.dialogue).split(/\s+/).filter(Boolean).map(normal) : [])),
  );
  let frame = 0;
  let lastTime = 0;
  let lastSet = 0; // the scroll position this view set itself; anything else was the person scrolling

  onMount(() => {
    // The page behind keeps its own scroll bar otherwise, which moves nothing you can see (found by the user).
    document.documentElement.style.overflow = 'hidden';
    root.focus();
    root.requestFullscreen?.().catch(() => {});
  });
  onDestroy(() => {
    document.documentElement.style.overflow = '';
    cancelAnimationFrame(frame);
    listening?.stop();
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

  // Each word gets a span, so the words already said can be greyed out one by one (asked by the user).
  const wordEls: HTMLElement[] = [];
  let greyed = 0; // how many words are greyed now
  function wordSpans(el: HTMLElement, line: { start: number; words: number }) {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const texts: Text[] = [];
    for (let n = walker.nextNode(); n; n = walker.nextNode()) texts.push(n as Text);
    let k = 0;
    for (const text of texts) {
      const parts = text.data.split(/(\s+)/);
      const frag = document.createDocumentFragment();
      for (const part of parts) {
        if (!part) continue;
        if (/^\s+$/.test(part) || k >= line.words) frag.append(part);
        else {
          const span = document.createElement('span');
          span.textContent = part;
          wordEls[line.start + k++] = span;
          frag.append(span);
        }
      }
      text.replaceWith(frag);
    }
    greyed = 0;
    grey();
  }
  function grey() {
    const n = Math.floor(read + 0.01);
    for (let w = Math.min(greyed, n); w < Math.max(greyed, n); w++) wordEls[w]?.classList.toggle('said', w < n);
    greyed = n;
  }
  $effect(() => {
    void read;
    grey();
  });

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
    read = heardAt = Math.min(at, total);
    marks = []; // waits there for the voice
    jump = -1;
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

  // Back to the first line (AU-7). While following the voice, it waits there for the voice.
  function fromTop() {
    read = heardAt = 0;
    marks = [];
    jump = -1;
    place();
  }

  const faster = (by: number) => setSpeed(speed + by);
  const bigger = (by: number) => (size = Math.min(96, Math.max(24, size + by)));

  // Follow my voice: the marker heads for where the voice probably is now, worked out from the last few seconds heard
  // (EX-12), and moves there smoothly each frame (`move`) instead of jumping from hearing to hearing.
  function glide(time: number) {
    if (voice !== 'on') return;
    if (marks.length) {
      const now = voiceAt(marks, time, pace);
      read = Math.min(total, move(read, Math.min(total, now.at), now.speed, (time - lastTime) / 1000));
    }
    lastTime = time;
    place();
    frame = requestAnimationFrame(glide);
  }

  async function toggleVoice() {
    voiceError = '';
    if (voice) {
      listening?.stop();
      listening = null;
      voice = '';
      return;
    }
    playing = false;
    cancelAnimationFrame(frame);
    voice = 'loading';
    heardAt = read;
    pace = speed / 60; // the words a minute set, until the voice says otherwise
    marks = [];
    jump = -1;
    try {
      const started = await listen({
        onText: (text) => {
          const at = follow(scriptWords, text.split(/\s+/).map(normal).filter(Boolean), heardAt);
          // A far place must be heard twice in a row (the speaker a word or two on): one hearing that ends a word
          // early fits a look-alike sentence further on (found by the user).
          const far = Math.abs(at - heardAt) > 2 * LEAD;
          if (far && !(jump >= 0 && Math.abs(at - jump) <= LEAD)) return void (jump = at);
          jump = -1;
          // Every hearing counts, the same place too: the voice staying put is a slower pace.
          if (at !== heardAt || marks.length) marks = addMark(marks, { at, time: performance.now() });
          heardAt = at;
        },
        onProgress: (loaded, total) => (got = { loaded, total }),
        onFail: () => {
          listening?.stop();
          listening = null;
          voice = '';
          voiceBox.checked = false;
          voiceError = "Speech recognition stopped working on this device. Use Start and the speed instead.";
        },
      });
      if (voice !== 'loading') return started.stop(); // switched off while it was getting ready
      listening = started;
      voice = 'on';
      lastTime = performance.now();
      frame = requestAnimationFrame(glide);
    } catch (e) {
      voice = '';
      voiceBox.checked = false; // the box was ticked by the click, and `voice` stayed ''
      voiceError = (e as ListenError)?.why === 'microphone'
        ? "The microphone isn't allowed. Allow it from the address bar, then switch Follow my voice on again."
        : "Speech recognition couldn't be downloaded. Check the internet connection, then try again.";
    }
  }

  const mb = (bytes: number) => Math.round(bytes / 1e6);

  function key(event: KeyboardEvent) {
    if (event.key === ' ' && voice) return;
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
            bind:this={lineEls[i]} use:wordSpans={byBlock.get(i)!}>{@html toHtml(block.dialogue)}</p>
          {#if cues && block.onScreen.trim()}<p class="cue">[ {plain(block.onScreen)} ]</p>{/if}
        {/if}
      {/each}
    </div>
  </div>
  <div class="marker" aria-hidden="true"></div>
  {#if voice === 'on'}<p class="listening" role="status"><span class="dot" aria-hidden="true"></span>Listening: it follows as you speak</p>{/if}
  {#if voice === 'loading' || voiceError}
    <div class="notice" role={voiceError ? 'alert' : 'status'}>
      {#if voiceError}{voiceError}
      {:else if got.total}
        Getting speech recognition ready: {mb(got.loaded)} of {mb(got.total)} MB. Only the first time; it stays on this computer.
        <progress max={got.total} value={got.loaded}></progress>
      {:else}Getting speech recognition ready…{/if}
    </div>
  {/if}

  <div class="controls">
    {#if !voice}
      <button class="play" onclick={toggle}>{playing ? 'Pause' : 'Start'}</button>
      <span class="group" role="group" aria-label="Speed">
        <button aria-label="Slower" onclick={() => faster(-10)}>−</button>
        <span><b>{speed}</b> words a minute</span>
        <button aria-label="Faster" onclick={() => faster(10)}>+</button>
      </span>
    {/if}
    <span class="group" role="group" aria-label="Text size">
      <button aria-label="Smaller text" onclick={() => bigger(-4)}>A−</button>
      <button aria-label="Bigger text" onclick={() => bigger(4)}>A+</button>
    </span>
    <button class="top" onclick={fromTop} disabled={read === 0}>⤒ From the top</button>
    <label><input type="checkbox" bind:this={voiceBox} checked={!!voice} onchange={toggleVoice} /> Follow my voice</label>
    <label><input type="checkbox" bind:checked={mirror} /> Mirror</label>
    <label><input type="checkbox" bind:checked={cues} /> On-screen cues</label>
    <span class="left">{clock(((total - read) / speed) * 60)} left</span>
    <button class="exit" onclick={onClose}>Exit</button>
  </div>
</div>

<style>
  .prompter { position: fixed; inset: 0; z-index: 50; background: #0b0b0b; color: #f5f5f5; outline: none; }
  .scroller { position: absolute; inset: 0; overflow-y: auto; scrollbar-width: thin; scrollbar-color: #444 transparent; }
  /* The first line starts at the marker; the last can scroll up to it. */
  .text { max-width: 900px; margin: 0 auto; padding: 33vh 32px 70vh; font-weight: 500; line-height: 1.45; }
  .mirror { transform: scaleX(-1); }
  p { margin: 0 0 0.8em; white-space: pre-wrap; }
  /* Words already said are greyed out (asked by the user); a line all said is too. */
  .past, .line :global(.said) { color: #6e6e6e; }
  .line :global(span) { transition: color 0.2s; }
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
  .controls .exit, .controls .top { padding: 0 12px; }
  .controls button:disabled { opacity: 0.4; }
  .listening { position: absolute; left: 24px; top: 24px; display: inline-flex; align-items: center; gap: 8px; margin: 0; padding: 6px 12px;
    border-radius: 999px; background: rgba(40, 40, 40, 0.92); font-size: 13px; color: #e6e6e6; }
  .dot { width: 8px; height: 8px; border-radius: 50%; background: #e5484d; }
  .notice { position: absolute; left: 50%; bottom: 96px; transform: translateX(-50%); width: min(440px, calc(100% - 32px)); box-sizing: border-box;
    padding: 12px 16px; border-radius: 12px; background: rgba(40, 40, 40, 0.92); font-size: 14px; line-height: 1.5; color: #e6e6e6; }
  .notice progress { display: block; width: 100%; margin-top: 8px; accent-color: var(--accent); }
</style>
