<script lang="ts">
  import { tick, untrack } from 'svelte';
  import { skipTours, TABS, TOURS, tourDue, tourSeen, YOUR_TURN, type Step, type Tab } from '../lib/tour';

  // The guided tour in the example (AP-34, board 53). tab: the open tab; again: goes up when Take the tour is clicked.
  let { tab, again }: { tab: Tab; again: number } = $props();

  const PAD = 6; // room around the part shown
  const GAP = 12; // between it and the card
  const EDGE = 16; // the card keeps this far from the window's edges

  let playing = $state<Tab | null>(null);
  let at = $state(0); // the step shown; steps.length is the "Your turn" card
  let steps = $state<Step[]>([]);
  let hole = $state<{ x: number; y: number; w: number; h: number } | null>(null);
  let card = $state({ x: 0, y: 0 });
  let cardEl = $state<HTMLElement>();
  let nextEl = $state<HTMLButtonElement>();
  let shown: Element[] = []; // the part shown, in pieces
  let seenAgain = untrack(() => again); // a new script opened after Take the tour doesn't replay it

  // A tab's tour plays by itself the first time it opens; Take the tour plays the open tab's tour again.
  $effect(() => {
    const now = tab;
    if (again !== seenAgain) {
      seenAgain = again;
      start(now);
    } else if (playing !== now && tourDue(now)) start(now);
  });

  // Waits for the tab's first part to be drawn (a script takes a moment to open), then shows the first step.
  async function start(which: Tab) {
    const list = TOURS[which];
    for (let tries = 0; tries < 100 && !find(list[0]); tries++) await wait(50);
    // Pictures and previews come in a moment after: wait till the first part keeps its size, so it isn't scrolled to
    // where it was a moment before.
    let last = '';
    for (let tries = 0; tries < 20; tries++) {
      const r = find(list[0])?.getBoundingClientRect();
      const now = r ? `${r.top} ${r.height}` : '';
      if (now === last) break;
      last = now;
      await wait(100);
    }
    if (which !== tab) return;
    steps = list.filter((step) => find(step)); // a part not on the page now (a hidden note) is left out
    playing = which;
    show(0);
  }

  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

  // The page can still change size under a step (a preview loading): the ring and card follow it.
  $effect(() => {
    if (!playing) return;
    const watch = new ResizeObserver(() => place());
    watch.observe(document.body);
    return () => watch.disconnect();
  });

  function find(step: Step | undefined): Element | null {
    return step ? document.querySelector(`[data-tour="${step.target}"]`) : null;
  }

  // The part, with the pieces beside it marked data-tour-with (a row's flag and § sit outside its tools).
  function parts(step: Step | undefined): Element[] {
    const first = find(step);
    if (!first) return [];
    return [first, ...(first.parentElement?.querySelectorAll(`:scope > [data-tour-with="${step!.target}"]`) ?? [])];
  }

  // The box round all of the part's pieces.
  function box(): DOMRect {
    const all = shown.map((el) => el.getBoundingClientRect());
    const x = Math.min(...all.map((r) => r.left));
    const y = Math.min(...all.map((r) => r.top));
    return new DOMRect(x, y, Math.max(...all.map((r) => r.right)) - x, Math.max(...all.map((r) => r.bottom)) - y);
  }

  async function show(i: number) {
    for (const el of shown) el.classList.remove('tour-on');
    at = i;
    shown = parts(steps[i]);
    for (const el of shown) el.classList.add('tour-on'); // shows the parts that only show on hover, such as a row's tools
    if (shown.length) {
      const r = box();
      if (r.top < 0 || r.bottom > innerHeight) shown[0].scrollIntoView({ block: r.height > innerHeight * 0.6 ? 'start' : 'nearest' });
    }
    await tick();
    place();
    nextEl?.focus();
  }

  // Puts the ring round the part and the card beside it: below, above, right or left, whichever fits, else inside.
  function place() {
    if (!playing) return;
    const w = cardEl?.offsetWidth ?? 340;
    const h = cardEl?.offsetHeight ?? 180;
    if (!shown.length) {
      hole = null;
      card = { x: (innerWidth - w) / 2, y: (innerHeight - h) / 2 };
      return;
    }
    const r = box();
    hole = { x: r.left - PAD, y: r.top - PAD, w: r.width + 2 * PAD, h: r.height + 2 * PAD };
    const fitX = (x: number) => Math.max(EDGE, Math.min(x, innerWidth - w - EDGE));
    const fitY = (y: number) => Math.max(EDGE, Math.min(y, innerHeight - h - EDGE));
    const below = r.bottom + PAD + GAP;
    const above = r.top - PAD - GAP - h;
    const right = r.right + PAD + GAP;
    const left = r.left - PAD - GAP - w;
    if (below + h <= innerHeight - EDGE) card = { x: fitX(r.left), y: below };
    else if (above >= EDGE) card = { x: fitX(r.left), y: above };
    else if (right + w <= innerWidth - EDGE) card = { x: right, y: fitY(r.top) };
    else if (left >= EDGE) card = { x: left, y: fitY(r.top) };
    else card = { x: innerWidth - w - EDGE, y: innerHeight - h - EDGE };
  }

  function next() {
    if (at < steps.length) show(at + 1);
    else finish();
  }

  function back() {
    if (at > 0) show(at - 1);
  }

  function finish() {
    if (playing) tourSeen(playing);
    for (const el of shown) el.classList.remove('tour-on');
    shown = [];
    playing = null;
    hole = null;
  }

  // Skip tour: stops this one, and no other tab plays its tour by itself.
  function skip() {
    skipTours();
    finish();
  }

  function key(e: KeyboardEvent) {
    if (!playing) return;
    if (e.key === 'Escape') skip();
    else if (e.key === 'ArrowRight') next();
    else if (e.key === 'ArrowLeft') back();
    else return;
    e.preventDefault();
  }
</script>

<svelte:window onkeydown={key} onresize={place} onscroll={place} />

{#if playing}
  {@const end = at >= steps.length}
  <div class="tour">
    <!-- Catches clicks while a step shows, so a stray click doesn't lose the tour. The hole's shadow dims the rest. -->
    <div class="block" aria-hidden="true"></div>
    {#if hole}
      <div class="hole" style:left="{hole.x}px" style:top="{hole.y}px" style:width="{hole.w}px" style:height="{hole.h}px"></div>
    {:else}
      <div class="dim"></div>
    {/if}
    <div class="card" role="dialog" aria-label="Tour" bind:this={cardEl} style:left="{card.x}px" style:top="{card.y}px">
      <p class="count">{end ? `${TABS[playing]} tour` : `${TABS[playing]} · ${at + 1} of ${steps.length}`}</p>
      <h2>{end ? 'Your turn' : steps[at].title}</h2>
      <p class="text">{end ? YOUR_TURN[playing] : steps[at].text}</p>
      <div class="buttons">
        {#if !end}<button class="skip" onclick={skip}>Skip tour</button>{/if}
        {#if at > 0}<button class="outline" onclick={back}>Back</button>{/if}
        <button class="go" bind:this={nextEl} onclick={next}>{end ? 'Start playing' : 'Next'}</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .tour { position: fixed; inset: 0; z-index: 30; }
  .block { position: absolute; inset: 0; }
  .hole { position: absolute; border-radius: 10px; box-shadow: 0 0 0 3px var(--accent), 0 0 0 9999px rgba(20, 20, 20, 0.55);
    pointer-events: none; transition: all 0.2s ease; }
  .dim { position: absolute; inset: 0; background: rgba(20, 20, 20, 0.55); }
  .card { position: absolute; box-sizing: border-box; width: min(340px, calc(100vw - 32px)); padding: 18px 18px 14px;
    border-radius: 12px; background: #fff; box-shadow: 0 8px 28px rgba(0, 0, 0, 0.22); transition: left 0.2s ease, top 0.2s ease; }
  .count { margin: 0; font-size: 12px; font-weight: 500; color: var(--muted); }
  h2 { margin: 6px 0; font-size: 16px; font-weight: 600; }
  .text { margin: 0; font-size: 14px; line-height: 1.5; color: #3d3d3d; }
  .buttons { display: flex; align-items: center; gap: 8px; margin-top: 14px; }
  .buttons .outline { min-height: 40px; padding: 0 14px; }
  .skip { margin-right: auto; min-height: 40px; padding: 0 4px; border: 0; background: none; color: var(--muted); font-weight: 500; font-size: 14px; }
  .skip:hover { color: var(--ink); }
  .go { margin-left: auto; min-height: 40px; padding: 0 16px; border: 0; border-radius: 8px; background: var(--ink); color: #fff;
    font-size: 14px; font-weight: 500; }
  .skip + .outline, .skip + .go { margin-left: 0; }
  @media (prefers-reduced-motion: reduce) { .hole, .card { transition: none; } }
</style>
