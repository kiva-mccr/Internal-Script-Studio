<script lang="ts">
  import { tick } from 'svelte';
  import { before, findAll, rangeAt, replaceAll, replaceOne, type Field, type Spot } from '../lib/find';
  import type { Block, Script } from '../lib/script';

  // The find and replace bar in Write (AP-32, board 44). Matches are marked in the formatted text with CSS highlights;
  // section titles are boxes, which highlights can't reach, so their marks go back to Write (`titles`).
  // onUnfold: a match is in a folded column. onDeleted: Replace all, with the blocks as they were, for the Undo bar.
  let { script, table, titles = $bindable(), onUnfold, onChange, onDeleted, onClose }: {
    script: Script; table: HTMLElement | undefined;
    titles: { found: Set<number>; on: number };
    onUnfold: (field: Exclude<Field, 'title'>) => void; onChange: () => void; onDeleted: (before: Block[], what: string) => void; onClose: () => void;
  } = $props();

  let query = $state('');
  let typed = $state('');
  let matchCase = $state(false);
  let wholeWords = $state(false);
  let cur = $state(0);
  let box = $state<HTMLInputElement>();

  const options = $derived({ matchCase, wholeWords });
  const spots = $derived(findAll(script.blocks, query, options));
  const at = $derived(spots.length ? Math.min(cur, spots.length - 1) : -1);
  const count = $derived(!query ? '' : spots.length ? `${at + 1} of ${spots.length}` : 'No matches');

  // Ctrl+F with the bar already open but the cursor elsewhere comes back here.
  export function focus() {
    box?.focus();
    box?.select();
  }
  $effect(() => focus());

  const shown = (spot: Spot) => {
    const block = `[data-block="${spot.block}"]`;
    if (spot.field === 'title') return table?.querySelector<HTMLElement>(`${block} .section-title`);
    if (spot.field === 'files') return table?.querySelectorAll(`${block} .files .chip`)[spot.line]?.querySelector<HTMLElement>('a, .words');
    return table?.querySelector<HTMLElement>(`${block} ${spot.field === 'dialogue' ? '.dialogue' : '.screen'} .shown`);
  };

  // The marks, again whenever the matches, the one you're on, or the drawn text change.
  $effect(() => {
    const [list, on] = [spots, at];
    void JSON.stringify(script.blocks); // the fields' text, and so what is drawn
    titles = { found: new Set(list.filter((s) => s.field === 'title').map((s) => s.block)), on: list[on]?.field === 'title' ? list[on].block : -1 };
    tick().then(() => {
      const marks: Range[] = [];
      const onMark: Range[] = [];
      list.forEach((spot, i) => {
        const el = spot.field === 'title' ? null : shown(spot);
        const range = el ? rangeAt(el, spot.start, spot.end) : null;
        if (range) (i === on ? onMark : marks).push(range);
      });
      CSS.highlights.set('find', new Highlight(...marks));
      CSS.highlights.set('find-on', new Highlight(...onMark));
    });
  });
  $effect(() => () => {
    ['find', 'find-on'].forEach((name) => CSS.highlights.delete(name));
    titles = { found: new Set(), on: -1 };
  });

  // Brings the match you're on into view (opening its column if folded), under the bar and the column headings.
  async function show() {
    const spot = spots[at];
    if (!spot) return;
    if (spot.field !== 'title') onUnfold(spot.field);
    await tick();
    const el = shown(spot);
    if (!el) return;
    const { top, bottom } = el.getBoundingClientRect();
    if (top < 160 || bottom > innerHeight) el.closest('[data-block]')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  function step(by: number) {
    if (!spots.length) return;
    cur = (at + by + spots.length) % spots.length;
    show();
  }

  function search() {
    cur = 0;
    show();
  }

  // Replace changes the match you're on and goes to the next one, never into the words just put in.
  function replace() {
    const spot = spots[at];
    if (!spot) return;
    const words = replaceOne(script.blocks, spot, typed, matchCase);
    onChange();
    const past = { ...spot, start: spot.start + words.length };
    const next = findAll(script.blocks, query, options).findIndex((s) => !before(s, past));
    cur = Math.max(next, 0);
    show();
  }

  function all() {
    const changing = new Set(spots.map((s) => s.block));
    if (!changing.size) return;
    const was = script.blocks.map((b, i) => (!changing.has(i) ? b : b.type === 'row' ? { ...b, files: [...b.files] } : { ...b }));
    const done = replaceAll(script.blocks, query, typed, options);
    const rows = spots.every((s) => s.field !== 'title');
    onDeleted(was, done.count === 1 ? 'Replaced 1.' : `Replaced ${done.count} in ${done.blocks} ${rows ? (done.blocks === 1 ? 'row' : 'rows') : 'places'}.`);
    onChange();
  }

  function keys(e: KeyboardEvent, enter: () => void) {
    if (e.key === 'Escape') return (e.preventDefault(), onClose());
    if (e.key !== 'Enter') return;
    e.preventDefault();
    enter();
  }
</script>

<div class="find" role="search" aria-label="Find and replace">
  <label>Find <input bind:this={box} bind:value={query} oninput={search} onkeydown={(e) => keys(e, () => step(e.shiftKey ? -1 : 1))} aria-label="Find" /></label>
  <span class="count" class:none={count === 'No matches'} role="status">{count}</span>
  <button class="icon" aria-label="Previous match" title="Previous (Shift+Enter)" disabled={!spots.length} onclick={() => step(-1)}>↑</button>
  <button class="icon" aria-label="Next match" title="Next (Enter)" disabled={!spots.length} onclick={() => step(1)}>↓</button>
  <button class="toggle" aria-pressed={matchCase} onclick={() => ((matchCase = !matchCase), search())}>Match case</button>
  <button class="toggle" aria-pressed={wholeWords} onclick={() => ((wholeWords = !wholeWords), search())}>Whole words</button>
  <span class="split"></span>
  <label>Replace with <input bind:value={typed} onkeydown={(e) => keys(e, replace)} aria-label="Replace with" /></label>
  <button disabled={!spots.length} onclick={replace}>Replace</button>
  <button disabled={!spots.length} onclick={all}>Replace all</button>
  <button class="icon close" aria-label="Close find" title="Close (Esc)" onclick={onClose}>×</button>
</div>

<style>
  .find { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 0 -8px 8px; padding: 10px 8px;
    border-bottom: 1px solid var(--line); background: #fafafa; }
  label { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--muted); }
  input { width: 200px; height: 36px; box-sizing: border-box; padding: 0 10px; border: 1px solid #bdbdbd; border-radius: 8px; font: inherit; font-size: 14px; color: var(--ink); background: #fff; }
  .count { min-width: 76px; font-size: 13px; color: var(--muted); }
  .count.none { color: #b42318; }
  button { min-height: 36px; padding: 0 12px; border: 1px solid #dadada; border-radius: 8px; background: #fff; color: var(--ink); font-size: 14px; font-weight: 500; }
  button:disabled { color: #9a9a9a; }
  .icon { width: 36px; padding: 0; }
  .toggle { padding: 0 10px; font-size: 13px; }
  .toggle[aria-pressed='true'] { border-color: var(--accent); background: #eef2fb; }
  .split { width: 1px; height: 24px; margin: 0 4px; background: #dadada; }
  .close { margin-left: auto; }
</style>
