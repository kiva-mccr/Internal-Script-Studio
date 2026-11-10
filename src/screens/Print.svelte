<script lang="ts">
  import { onMount } from 'svelte';
  import { assetFile } from '../lib/folder';
  import { renderMath, toHtml } from '../lib/format';
  import { frontList, frontValue, readFileRef, type Script } from '../lib/script';

  // The print version (EX-1, mock-up 9): only shown when printing. `version` is "v3", or "" for a draft.
  // For notes during production (asked by the user): column, a blank Notes column on each row; lines, a lined Notes
  // space after the last row. scale: the text size, 1 = as drawn (asked by the user).
  // onReady: called once images and equations are in, so the print window shows the whole page.
  let { script, dir, title, version, column, lines, scale, onReady }: {
    script: Script; dir: FileSystemDirectoryHandle; title: string; version: string; column: boolean; lines: boolean; scale: number; onReady: () => void;
  } = $props();

  const IMAGE = /\.(png|jpe?g|gif|webp|svg|avif|bmp)$/i;
  const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const stand = $derived.by(() => {
    const status = frontValue(script.front, 'status');
    const shown = status && status !== 'draft' ? status[0].toUpperCase() + status.slice(1) : '';
    return [version || 'Draft', shown].filter(Boolean).join(' · ');
  });
  const authors = $derived(frontList(script.front, 'authors').join(', '));
  // The footer is drawn by the browser on every page (@page margin boxes), so it is a CSS string.
  const footer = $derived(`${title} · ${version || 'Draft'}`.replace(/[\\"]/g, '\\$&').replace(/</g, '\\3C '));

  let page: HTMLElement;
  let previews = $state<Record<string, string>>({}); // image files in the script's folder, as blob URLs
  const numbers = $derived.by(() => {
    let n = 0;
    return script.blocks.map((b) => (b.type === 'row' ? ++n : 0));
  });

  onMount(() => {
    const made: string[] = [];
    (async () => {
      const paths = script.blocks.flatMap((b) => (b.type === 'row' ? b.files : []))
        .map(readFileRef).filter((r) => r.kind === 'path' && IMAGE.test(r.target)).map((r) => r.target);
      const next: Record<string, string> = {};
      for (const path of new Set(paths)) {
        const file = await assetFile(dir, path);
        if (file) made.push((next[path] = URL.createObjectURL(file)));
      }
      previews = next;
      await Promise.resolve(); // let the images be drawn into the page
      await renderMath(page).catch(() => {});
      // A missing or broken image is hidden, not waited for.
      await Promise.all([...page.querySelectorAll('img')].map((img) => img.decode().catch(() => (img.hidden = true))));
      onReady();
    })();
    return () => made.forEach((url) => URL.revokeObjectURL(url));
  });

  function preview(line: string): string {
    const ref = readFileRef(line);
    if (!IMAGE.test(ref.target)) return '';
    return ref.kind === 'path' ? (previews[ref.target] ?? '') : ref.kind === 'link' ? ref.target : '';
  }
</script>

<svelte:head>
  {@html `<style>@page { margin: 14mm 12mm 16mm; @bottom-left { content: "${footer}"; font: 8pt Inter, system-ui, sans-serif; color: #8a8a8a; }
    @bottom-right { content: "Page " counter(page) " of " counter(pages); font: 8pt Inter, system-ui, sans-serif; color: #8a8a8a; } }</style>`}
</svelte:head>

<div class="print-view" bind:this={page} style:font-size="{10 * scale}pt">
  <div class="top">
    <div>
      <h1>{title}</h1>
      {#if authors}<p>{authors}</p>{/if}
    </div>
    <p class="stand">{stand}<br />{today}</p>
  </div>
  {#if script.intro}<p class="note">{script.intro}</p>{/if}
  <table class:notes={column}>
    <thead><tr><th>#</th><th>Dialogue</th><th>On screen</th><th>Images &amp; files</th>{#if column}<th>Notes</th>{/if}</tr></thead>
    <tbody>
      {#each script.blocks as block, i (block)}
        {#if block.type === 'section'}
          <tr class="section"><td colspan={column ? 5 : 4}>{block.title}</td></tr>
        {:else}
          <tr>
            <td class="num">{numbers[i]}</td>
            <td class="dialogue">
              {#if block.note}<p class="note">{block.note}</p>{/if}
              <div class="text">{@html toHtml(block.dialogue)}</div>
            </td>
            <td class="screen"><div class="text">{@html toHtml(block.onScreen)}</div></td>
            <td class="files">
              {#each block.files as line, j (j + line)}
                {@const ref = readFileRef(line)}
                {@const src = preview(line)}
                <div class:words={ref.kind === 'words'}>
                  {#if src}<img {src} alt="" />{/if}
                  {ref.kind === 'words' ? `To find: ${ref.label}` : ref.label}
                  {#if ref.kind === 'link' && ref.label !== ref.target}<span class="target">{ref.target}</span>{/if}
                </div>
              {/each}
            </td>
            {#if column}<td class="blank"></td>{/if}
          </tr>
        {/if}
      {/each}
    </tbody>
  </table>
  {#if lines}
    <section class="lines">
      <h2>Notes</h2>
      {#each { length: 14 }, i (i)}<div class="line"></div>{/each}
    </section>
  {/if}
</div>

<style>
  /* On screen the print version is never seen; when printing, it is all that is seen. */
  @media screen { .print-view { display: none; } }
  @media print { :global(#app > :not(.print-view)) { display: none !important; } }
  .print-view { font: 10pt/1.5 Inter, system-ui, sans-serif; color: #141414; }
  .top { display: flex; justify-content: space-between; align-items: baseline; gap: 16px; padding-bottom: 8px; border-bottom: 1.5px solid #141414; }
  /* Sizes in em, so the text size choice scales them all. */
  h1 { margin: 0; font-size: 1.6em; font-weight: 600; }
  .top p { margin: 2px 0 0; color: #5f5f5f; }
  .stand { text-align: right; white-space: nowrap; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  th { padding: 8px 6px 4px; text-align: left; font-size: 0.8em; font-weight: 600; color: #5f5f5f; text-transform: uppercase;
    letter-spacing: 0.04em; border-bottom: 1px solid #cfcfcf; }
  th:nth-child(1) { width: 4%; } th:nth-child(2) { width: 38%; } th:nth-child(3) { width: 32%; }
  .notes th:nth-child(2) { width: 29%; } .notes th:nth-child(3) { width: 23%; } .notes th:nth-child(5) { width: 22%; }
  .blank { border-left: 1px solid #e6e6e6; }
  tr { break-inside: avoid; }
  td { padding: 8px 6px; vertical-align: top; border-bottom: 1px solid #e6e6e6; overflow-wrap: break-word; }
  /* Line breaks typed in a field are kept; only the text itself, or the template's spaces would show. */
  .text { white-space: pre-wrap; }
  .num { color: #5f5f5f; }
  .dialogue { font-size: 1.05em; }
  .screen { color: #3d3d3d; }
  .files { font-size: 0.9em; }
  .files div + div { margin-top: 4px; }
  .files img { display: block; max-width: 100%; max-height: 22mm; margin-bottom: 2px; border-radius: 2px; }
  .words, .target, .note { color: #5f5f5f; }
  .target { display: block; }
  .note { margin: 0 0 4px; font-size: 0.9em; white-space: pre-wrap; }
  .section td { padding-top: 14px; font-size: 1.1em; font-weight: 600; border-bottom: 1px solid #cfcfcf; }
  /* Kept whole: starts on a new page if it doesn't fit under the last row. */
  .lines { break-inside: avoid; padding-top: 18px; }
  h2 { margin: 0; font-size: 1.1em; font-weight: 600; }
  .line { height: 9mm; border-bottom: 1px solid #cfcfcf; }
  .print-view :global(a) { color: inherit; }
</style>
