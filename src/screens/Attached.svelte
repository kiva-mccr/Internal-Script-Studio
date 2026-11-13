<script lang="ts" module>
  export const IMAGE = /\.(png|jpe?g|gif|webp|svg|avif|bmp)$/i;
  // What the browser shows itself; anything else (Word, zip…) downloads under its own name.
  const VIEWABLE = /\.(png|jpe?g|gif|webp|svg|avif|bmp|pdf|txt|mp4|webm|mov|mp3|wav|m4a)$/i;
</script>

<script lang="ts">
  import { sizeText, type Attachment } from '../lib/comments';
  import { assetFile, isCopyOf } from '../lib/folder';
  import { makePreview, revokePreview, type Preview as Made } from '../lib/preview';
  import Preview from './Preview.svelte';

  // A comment's or reply's files on its card (RV-11, mock-up 25): a preview with the name and size under it (AP-19,
  // mock-up 41: pictures, PDF, video, sound, text), others as a chip with the size. Clicking opens one in a new tab.
  // use (Write only, RV-12): "Use in script" under each file copies it into the comment's row; row is that row's
  // number and Files lines, so a file already copied there shows "In row N" instead.
  let { dir, files, use }: {
    dir: FileSystemDirectoryHandle;
    files: Attachment[];
    use?: { row: number; lines: string[]; add: (item: Attachment) => Promise<boolean> };
  } = $props();

  let problem = $state('');
  let previews = $state<Record<string, Made | null>>({});
  let copying = $state('');

  // A file counts as in the row when a line there has its copy's name and its size (another file of the same name
  // that was already in assets/ does not count).
  let inRow = $state<Record<string, boolean>>({});
  $effect(() => {
    if (!use) return;
    const items = files.map((f) => ({ ...f }));
    const lines = [...use.lines];
    let gone = false;
    (async () => {
      const next: Record<string, boolean> = {};
      for (const item of items)
        for (const line of lines.filter((l) => isCopyOf(l, item.name)))
          if ((await assetFile(dir, line))?.size === item.size) next[item.path] = true;
      if (!gone) inRow = next;
    })();
    return () => void (gone = true);
  });

  async function add(item: Attachment) {
    if (!use || copying) return;
    copying = item.path;
    if (await use.add(item)) inRow = { ...inRow, [item.path]: true };
    copying = '';
  }

  $effect(() => {
    const items = files.map((f) => ({ ...f }));
    let gone = false;
    const made: Made[] = [];
    (async () => {
      const next: Record<string, Made | null> = {};
      for (const item of items) {
        const file = await assetFile(dir, item.path);
        if (!file || gone) continue;
        const preview = await makePreview(file, item.name);
        if (gone) revokePreview(preview);
        else if (preview) made.push((next[item.path] = preview));
      }
      if (!gone) previews = next;
    })();
    return () => {
      gone = true;
      made.forEach(revokePreview);
    };
  });

  async function open(item: Attachment) {
    const file = await assetFile(dir, item.path);
    if (!file) return void (problem = `${item.name} isn't here yet. If it was just added, OneDrive may still be syncing.`);
    problem = '';
    const url = URL.createObjectURL(file);
    if (VIEWABLE.test(item.name)) window.open(url, '_blank', 'noopener');
    else Object.assign(document.createElement('a'), { href: url, download: item.name }).click();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
</script>

<div class="attached">
  {#each files as item (item.path)}
    {@const preview = previews[item.path]}
    {#if preview}
      <div class="previewed">
        <Preview {preview} name={item.name} onOpen={() => open(item)} onFail={() => (previews = { ...previews, [item.path]: null })} />
        <button type="button" class="under" title="Open {item.name}" onclick={() => open(item)}>{item.name} · {sizeText(item.size)}</button>
        {@render using(item)}
      </div>
    {:else}
      <div class="previewed">
        <button type="button" class="chip" title="Open {item.name}" onclick={() => open(item)}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" aria-hidden="true"><path d="M4 1.5h5.5L13 5v9.5H4z"></path><path d="M9.5 1.5V5H13"></path></svg>
          <span class="name">{item.name}</span><span class="size">{sizeText(item.size)}</span>
        </button>
        {@render using(item)}
      </div>
    {/if}
  {/each}
</div>
{#if problem}<p class="problem" role="alert">{problem}</p>{/if}

{#snippet using(item: Attachment)}
  {#if use && inRow[item.path]}
    <span class="in-row">
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8.5l3 3 7-7"></path></svg>
      In row {use.row}
    </span>
  {:else if use}
    <button type="button" class="use" aria-label="Use in script: {item.name}" disabled={copying === item.path} onclick={() => add(item)}>
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M8 3v10M3 8h10"></path></svg>
      Use in script
    </button>
  {/if}
{/snippet}

<style>
  .attached { display: flex; flex-wrap: wrap; align-items: flex-start; gap: 8px; }
  button { font: inherit; cursor: pointer; }
  .previewed { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; max-width: 260px; }
  .under { max-width: 100%; padding: 0; border: 0; background: none; color: var(--muted); font-size: 12px; text-align: left;
    overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
  .under:hover { color: var(--accent); }
  .chip { display: inline-flex; align-items: center; gap: 6px; max-width: 100%; min-height: 32px; padding: 0 10px;
    border: 1px solid var(--line); border-radius: 16px; background: #fff; color: var(--ink); font-size: 13px; }
  .chip:hover { border-color: var(--line-strong); }
  .chip svg, .size { flex: none; color: var(--muted); }
  .name { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
  .use { display: inline-flex; align-items: center; gap: 6px; min-height: 32px; padding: 0 10px; border: 1px solid var(--line-strong);
    border-radius: 8px; background: #fff; color: var(--ink); font-size: 13px; }
  .use:hover { border-color: var(--accent); color: var(--accent); }
  .in-row { display: inline-flex; align-items: center; gap: 6px; min-height: 32px; font-size: 13px; color: #1e6b3a; }
  .problem { margin: 0; font-size: 13px; color: var(--muted); }
</style>
