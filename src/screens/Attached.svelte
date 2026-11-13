<script lang="ts" module>
  export const IMAGE = /\.(png|jpe?g|gif|webp|svg|avif|bmp)$/i;
  // What the browser shows itself; anything else (Word, zip…) downloads under its own name.
  const VIEWABLE = /\.(png|jpe?g|gif|webp|svg|avif|bmp|pdf|txt|mp4|webm|mov|mp3|wav|m4a)$/i;
</script>

<script lang="ts">
  import { sizeText, type Attachment } from '../lib/comments';
  import { assetFile } from '../lib/folder';
  import { makePreview, revokePreview, type Preview as Made } from '../lib/preview';
  import Preview from './Preview.svelte';

  // A comment's or reply's files on its card (RV-11, mock-up 25): a preview with the name and size under it (AP-19,
  // mock-up 41: pictures, PDF, video, sound, text), others as a chip with the size. Clicking opens one in a new tab.
  let { dir, files }: { dir: FileSystemDirectoryHandle; files: Attachment[] } = $props();

  let problem = $state('');
  let previews = $state<Record<string, Made | null>>({});

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
      </div>
    {:else}
      <button type="button" class="chip" title="Open {item.name}" onclick={() => open(item)}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" aria-hidden="true"><path d="M4 1.5h5.5L13 5v9.5H4z"></path><path d="M9.5 1.5V5H13"></path></svg>
        <span class="name">{item.name}</span><span class="size">{sizeText(item.size)}</span>
      </button>
    {/if}
  {/each}
</div>
{#if problem}<p class="problem" role="alert">{problem}</p>{/if}

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
  .problem { margin: 0; font-size: 13px; color: var(--muted); }
</style>
