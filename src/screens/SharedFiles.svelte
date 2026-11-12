<script lang="ts">
  // Files from other scripts (AS-1, mock-up 29): a window in the page, opened from a row's + Add. Lists the files and
  // links of every other script, newest edited first; Find narrows by name; one is picked and added to the row.
  // Without onAdd it only browses (the script list's Files, AS-1b): every script, a file opens, a script's name opens it.
  import { IMAGE } from './Attached.svelte';
  import { assetFile } from '../lib/folder';
  import { routeHash } from '../lib/route';
  import { copyShared, sharedFiles, type SharedFile, type SharedScript } from '../lib/shared';

  let { root, here = '', dir, row = 0, onAdd, onClose }: {
    root: FileSystemDirectoryHandle; here?: string; dir?: FileSystemDirectoryHandle; row?: number;
    onAdd?: (line: string, from: string) => void; onClose: () => void;
  } = $props();

  let groups = $state<SharedScript[] | null>(null);
  let failed = $state(false);
  let query = $state('');
  let picked = $state<{ group: SharedScript; file: SharedFile } | null>(null);
  let adding = $state(false);
  let previews = $state<Record<string, string>>({});
  let find = $state<HTMLInputElement>();

  $effect(() => {
    let gone = false;
    const made: string[] = [];
    find?.focus();
    sharedFiles(root, here).then(async (found) => {
      if (gone) return;
      groups = found;
      // Thumbnails of the images in other scripts' folders, as blob URLs revoked when the window closes.
      for (const g of found) {
        for (const f of g.files) {
          if (f.kind !== 'path' || !IMAGE.test(f.name)) continue;
          const file = await assetFile(await root.getDirectoryHandle(g.folder), f.target).catch(() => null);
          if (!file || gone) continue;
          const url = URL.createObjectURL(file);
          made.push(url);
          previews = { ...previews, [`${g.folder}/${f.target}`]: url };
        }
      }
    }, () => (failed = true));
    return () => {
      gone = true;
      made.forEach((url) => URL.revokeObjectURL(url));
    };
  });

  const shown = $derived.by(() => {
    const q = query.trim().toLowerCase();
    return (groups ?? []).map((g) => ({ ...g, files: g.files.filter((f) => !q || f.name.toLowerCase().includes(q)) }))
      .filter((g) => g.files.length);
  });
  const count = $derived((groups ?? []).reduce((n, g) => n + g.files.length, 0));

  function thumb(g: SharedScript, f: SharedFile): string {
    if (f.kind === 'link') return IMAGE.test(f.target) ? f.target : '';
    return previews[`${g.folder}/${f.target}`] ?? '';
  }

  function kindOf(f: SharedFile): string {
    if (f.kind === 'link') return 'Link ↗';
    const dot = f.name.lastIndexOf('.');
    return dot > 0 ? f.name.slice(dot + 1).toUpperCase() : 'File';
  }

  // Browsing: opens a file (as Write does) or a link in a new tab.
  async function open(g: SharedScript, f: SharedFile) {
    if (f.kind === 'link') return void window.open(f.target, '_blank', 'noopener');
    const file = await assetFile(await root.getDirectoryHandle(g.folder), f.target).catch(() => null);
    if (!file) return void (failed = true);
    const url = URL.createObjectURL(file);
    window.open(url, '_blank', 'noopener');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  async function add() {
    if (!picked || adding || !onAdd || !dir) return;
    adding = true;
    try {
      onAdd(await copyShared(root, picked.group.folder, picked.file, dir), picked.group.title);
    } catch {
      failed = true;
      adding = false;
    }
  }
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onClose()} />

<div class="backdrop" role="presentation" onpointerdown={(e) => e.target === e.currentTarget && onClose()}>
  <div class="window" role="dialog" aria-modal="true" aria-labelledby="shared-title" tabindex="-1">
    <div class="top">
      <h2 id="shared-title">{onAdd ? 'Files from other scripts' : 'Files in every script'}</h2>
      {#if groups}<span class="sum">{count} {count === 1 ? 'file' : 'files'} in {groups.length} {groups.length === 1 ? 'script' : 'scripts'}</span>{/if}
      <label class="find">Find <input bind:this={find} bind:value={query} placeholder="file name" /></label>
      <button class="close" aria-label="Close" onclick={onClose}>×</button>
    </div>
    <div class="body">
      {#if !groups}
        <p class="empty">{failed ? "The other scripts couldn't be read. If OneDrive is still syncing, wait a moment and try again." : 'Looking through the other scripts…'}</p>
      {:else if !groups.length}
        <p class="empty">{onAdd ? 'No other script has files yet.' : 'No script has files yet.'}</p>
      {:else if !shown.length}
        <p class="empty">No file {onAdd ? 'in other scripts ' : ''}has "{query.trim()}" in its name.</p>
      {/if}
      {#each shown as g (g.folder)}
        <section aria-label={g.title}>
          <h3>{#if onAdd}{g.title}{:else}<a href={routeHash([g.folder])} onclick={onClose}>{g.title}</a>{/if} <span>· {g.status === 'in review' ? 'In review' : g.status[0].toUpperCase() + g.status.slice(1)}</span></h3>
          <div class="grid">
            {#each g.files as f (f.kind + f.target)}
              {@const src = thumb(g, f)}
              {@const on = picked?.group.folder === g.folder && picked.file.kind === f.kind && picked.file.target === f.target}
              <button class="tile" class:on aria-pressed={onAdd ? on : undefined}
                onclick={() => (onAdd ? (picked = { group: g, file: f }) : open(g, f))} ondblclick={add}>
                <span class="pic">{#if src}<img {src} alt="" onerror={(e) => ((e.currentTarget as HTMLElement).hidden = true)} />{:else}{kindOf(f)}{/if}</span>
                <span class="name" title={f.name}>{f.name}</span>
                <span class="uses">{f.uses ? `In ${f.uses} ${f.uses === 1 ? 'row' : 'rows'}` : 'Not in any row'}</span>
              </button>
            {/each}
          </div>
        </section>
      {/each}
    </div>
    <div class="foot">
      <span>
        {#if failed && groups}That file couldn't be {onAdd ? 'copied' : 'opened'}. If OneDrive is still syncing, wait a moment and try again.
        {:else if !onAdd}Click a file to open it, or a script's name to open the script.
        {:else if picked}{picked.file.kind === 'link' ? `${picked.file.name} is a link: it is added as the same link.` : `${picked.file.name} will be copied into this script's assets folder.`}
        {:else}Pick a file.{/if}
      </span>
      {#if onAdd}<button class="dark" disabled={!picked || adding} onclick={add}>Add to row {row}</button>{/if}
    </div>
  </div>
</div>

<style>
  .backdrop { position: fixed; inset: 0; z-index: 20; display: flex; justify-content: center; align-items: flex-start;
    padding: 64px 16px; background: rgba(20, 20, 20, 0.25); overflow: auto; }
  .window { width: 100%; max-width: 860px; box-sizing: border-box; border-radius: 12px; background: var(--ground);
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.18); }
  .top { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; padding: 8px 8px 8px 20px; border-bottom: 1px solid #eee; }
  h2 { margin: 0; font-size: 17px; font-weight: 600; }
  .sum { flex: 1; font-size: 13px; color: var(--muted); }
  .find { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--muted); }
  .find input { width: 180px; min-height: 36px; box-sizing: border-box; padding: 0 10px; border: 1px solid #d0d0d0; border-radius: 6px;
    font: inherit; font-size: 13px; color: var(--ink); }
  .close { min-width: 44px; min-height: 44px; border: 0; border-radius: 8px; background: none; color: var(--muted); font-size: 20px; }
  .close:hover { background: #f2f2f2; }
  .body { max-height: 60vh; overflow: auto; padding: 4px 20px 16px; }
  .empty { margin: 16px 0; font-size: 14px; color: var(--muted); }
  h3 { margin: 16px 0 8px; font-size: 12px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; }
  h3 a { color: inherit; }
  h3 a:hover { color: var(--accent); }
  h3 span { font-weight: 400; text-transform: none; letter-spacing: 0; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 10px; }
  .tile { display: flex; flex-direction: column; gap: 6px; min-width: 0; padding: 8px; border: 1px solid var(--line); border-radius: 8px;
    background: #fff; text-align: left; font-size: 13px; color: var(--ink); }
  .tile:hover { border-color: var(--line-strong); }
  .tile.on { border: 2px solid var(--accent); padding: 7px; background: #eef2fb; }
  .pic { display: flex; align-items: center; justify-content: center; height: 72px; border-radius: 4px; background: #f2f2f2;
    overflow: hidden; font-size: 12px; font-weight: 600; color: #3d3d3d; }
  .pic img { width: 100%; height: 100%; object-fit: cover; }
  .name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500; }
  .uses { font-size: 12px; color: var(--muted); }
  .foot { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 12px 20px; border-top: 1px solid #eee;
    font-size: 13px; color: var(--muted); }
  .dark { min-height: 44px; padding: 0 18px; border: 0; border-radius: 8px; background: var(--ink); color: #fff; font-size: 14px; font-weight: 500; }
  .dark:hover:not(:disabled) { background: #333; }
  .dark:disabled { opacity: 0.4; cursor: default; }
</style>
