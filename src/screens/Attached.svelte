<script lang="ts" module>
  export const IMAGE = /\.(png|jpe?g|gif|webp|svg|avif|bmp)$/i;
  // What the browser shows itself; anything else (Word, zip…) downloads under its own name.
  const VIEWABLE = /\.(png|jpe?g|gif|webp|svg|avif|bmp|pdf|txt|mp4|webm|mov|mp3|wav|m4a)$/i;
</script>

<script lang="ts">
  import { sizeText, type Attachment } from '../lib/comments';
  import { assetFile } from '../lib/folder';

  // A comment's or reply's files on its card (RV-11, mock-up 25): images as a small preview, others as a chip with
  // the size. Clicking opens one in a new tab.
  let { dir, files }: { dir: FileSystemDirectoryHandle; files: Attachment[] } = $props();

  let problem = $state('');
  let previews = $state<Record<string, string>>({});

  $effect(() => {
    const paths = files.filter((f) => IMAGE.test(f.name)).map((f) => f.path);
    let gone = false;
    const made: string[] = [];
    (async () => {
      const next: Record<string, string> = {};
      for (const path of paths) {
        const file = await assetFile(dir, path);
        if (!file || gone) continue;
        made.push((next[path] = URL.createObjectURL(file)));
      }
      if (!gone) previews = next;
    })();
    return () => {
      gone = true;
      made.forEach((url) => URL.revokeObjectURL(url));
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
    {#if previews[item.path]}
      <button type="button" class="thumb" title="Open {item.name}" onclick={() => open(item)}>
        <img src={previews[item.path]} alt="Preview of {item.name}" />
        <span>{item.name}</span>
      </button>
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
  .thumb { display: flex; flex-direction: column; gap: 4px; width: 132px; padding: 0; border: 0; background: none; color: #3d3d3d;
    font-size: 12px; text-align: left; }
  .thumb img { width: 132px; height: 88px; object-fit: cover; border: 1px solid var(--line); border-radius: 6px; }
  .thumb span { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
  .chip { display: inline-flex; align-items: center; gap: 6px; max-width: 100%; min-height: 32px; padding: 0 10px;
    border: 1px solid var(--line); border-radius: 16px; background: #fff; color: var(--ink); font-size: 13px; }
  .chip:hover, .thumb:hover img { border-color: var(--line-strong); }
  .chip svg, .size { flex: none; color: var(--muted); }
  .name { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
  .problem { margin: 0; font-size: 13px; color: var(--muted); }
</style>
