<script lang="ts">
  import { assetFile } from '../lib/folder';
  import { assetList, assetRows, type Asset } from '../lib/assets';
  import { keep, recall } from '../lib/remember';
  import type { Script } from '../lib/script';

  // The Assets tab (EX-6, mock-up 12). `missing`: the paths not in the folder, worked out by the Editor so the tab's
  // count and this list always agree. onJump: go to a row in Write.
  let { script, dir, missing, onJump, onNotice }: {
    script: Script; dir: FileSystemDirectoryHandle; missing: Set<string>; onJump: (row: number) => void; onNotice: (message: string) => void;
  } = $props();

  const IMAGE = /\.(png|jpe?g|gif|webp|svg|avif|bmp)$/i;
  let byRow = $state(recall('assets-order') === 'row');
  const rows = $derived(assetRows(script));
  const all = $derived(assetList(script));
  const lost = $derived(all.filter((a) => a.kind === 'path' && missing.has(a.target)));
  const toFind = $derived(all.filter((a) => a.kind === 'words'));
  const here = $derived(all.filter((a) => a.kind === 'link' || (a.kind === 'path' && !missing.has(a.target))));
  const used = $derived(rows.filter((r) => r.assets.length).length);

  // Thumbnails of the images that are in the folder, as short-lived blob URLs; linked images use their link.
  let previews = $state<Record<string, string>>({});
  $effect(() => {
    const paths = here.filter((a) => a.kind === 'path' && IMAGE.test(a.target)).map((a) => a.target);
    let gone = false;
    const made: string[] = [];
    (async () => {
      const next: Record<string, string> = {};
      for (const path of paths) {
        const file = await assetFile(dir, path);
        if (file && !gone) made.push((next[path] = URL.createObjectURL(file)));
      }
      if (!gone) previews = next;
    })();
    return () => {
      gone = true;
      made.forEach((url) => URL.revokeObjectURL(url));
    };
  });

  function order() {
    byRow = !byRow;
    keep('assets-order', byRow ? 'row' : '');
  }

  async function open(asset: Asset) {
    if (asset.kind === 'link') return void window.open(asset.target, '_blank', 'noopener');
    const file = await assetFile(dir, asset.target);
    if (!file) return onNotice(`${asset.target} isn't in the script's folder. If someone just added it, OneDrive may still be syncing.`);
    const url = URL.createObjectURL(file);
    window.open(url, '_blank', 'noopener');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  const thumb = (a: Asset) => (a.kind === 'path' ? (previews[a.target] ?? '') : a.kind === 'link' && IMAGE.test(a.target) ? a.target : '');
</script>

{#snippet item(asset: Asset, kind: 'lost' | 'find' | 'here')}
  <li class={kind}>
    <span class="thumb" aria-hidden="true">
      {#if thumb(asset)}<img src={thumb(asset)} alt="" onerror={(e) => ((e.currentTarget as HTMLElement).hidden = true)} />{:else if asset.kind === 'link'}↗{/if}
    </span>
    <span class="name">
      {#if kind === 'find'}
        {asset.label}
      {:else}
        <button class="open" onclick={() => open(asset)}>{asset.label}</button>
        <span class="where">{asset.kind === 'link' ? asset.target.replace(/^https?:\/\//, '') : asset.target}</span>
      {/if}
    </span>
    <span class="rows">
      {#each asset.rows as n (n)}<button class="jump" onclick={() => onJump(n)}>Row {n}</button>{/each}
    </span>
  </li>
{/snippet}

<section class="assets" aria-label="Assets">
  <div class="top">
    <h1>Assets</h1>
    <p class="sum">
      {all.length} in {used} {used === 1 ? 'row' : 'rows'}{#if lost.length}{' · '}<span class="bad">{lost.length} missing</span>{/if}{#if toFind.length}{` · ${toFind.length} to find`}{/if}
    </p>
    <button class="outline" onclick={order}>Order: {byRow ? 'by row' : 'by what needs doing'}</button>
  </div>

  {#if !all.length}
    <p class="empty">No files, links or notes in the Files column yet. Add them in Write.</p>
  {:else if byRow}
    <div class="box">
      {#each rows as row, i (row.n)}
        {#if row.section && row.section !== rows[i - 1]?.section}<h2>{row.section}</h2>{/if}
        {#if row.assets.length}
          <div class="by-row">
            <button class="jump" onclick={() => onJump(row.n)}>Row {row.n}</button>
            <ul>
              {#each row.assets as asset (asset.line)}
                {#if asset.kind === 'words'}
                  <li class="find">To find: {asset.label}</li>
                {:else if asset.kind === 'path' && missing.has(asset.target)}
                  <li class="lost"><button class="open" onclick={() => open(asset)}>{asset.label}</button> · missing</li>
                {:else}
                  <li><button class="open" onclick={() => open(asset)}>{asset.label}</button>{asset.kind === 'link' ? ' ↗' : ''}</li>
                {/if}
              {/each}
            </ul>
          </div>
        {/if}
      {/each}
    </div>
  {:else}
    <div class="box">
      {#if lost.length}
        <h2 class="lost-head">Missing from the folder</h2>
        <ul>{#each lost as asset (asset.line)}{@render item(asset, 'lost')}{/each}</ul>
      {/if}
      {#if toFind.length}
        <h2 class="find-head">Still to find or film</h2>
        <ul>{#each toFind as asset (asset.line)}{@render item(asset, 'find')}{/each}</ul>
      {/if}
      {#if here.length}
        <h2>In the folder or linked</h2>
        <ul>{#each here as asset (asset.line)}{@render item(asset, 'here')}{/each}</ul>
      {/if}
    </div>
  {/if}
  <p class="hint">A row number goes to that row in Write. Links are listed but not checked online.</p>
</section>

<style>
  .assets { max-width: 820px; margin: 0 auto; }
  .top { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; margin-bottom: 12px; }
  h1 { margin: 0; font-size: 18px; font-weight: 600; }
  .sum { flex: 1 1 200px; margin: 0; font-size: 13px; color: var(--muted); }
  .bad, .lost .open, li.lost { color: var(--danger); }
  .outline { min-height: 40px; padding: 0 12px; font-size: 13px; }
  .box { border: 1px solid var(--line); border-radius: 10px; overflow: hidden; }
  h2 { margin: 0; padding: 10px 16px; background: #fafafa; font-size: 12px; font-weight: 600; color: var(--muted);
    text-transform: uppercase; letter-spacing: 0.04em; }
  h2:not(:first-child) { border-top: 1px solid var(--line); }
  .lost-head { background: #fdf0ef; color: var(--danger); }
  .find-head { background: #fff7ed; color: #7a4a00; }
  ul { margin: 0; padding: 0; list-style: none; }
  .box > ul > li { display: flex; align-items: center; gap: 12px; padding: 10px 16px; border-top: 1px solid #f0f0f0; }
  .thumb { flex: none; display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 32px;
    border-radius: 4px; background: #f2f2f2; overflow: hidden; color: var(--accent); font-size: 13px; }
  .thumb img { width: 100%; height: 100%; object-fit: cover; }
  .lost .thumb { border: 1px dashed #d08a84; box-sizing: border-box; }
  .find .thumb { background: #fff4e5; }
  .name { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .find .name { color: #7a4a00; font-size: 14px; }
  .open { align-self: flex-start; max-width: 100%; padding: 0; border: 0; background: none; color: var(--ink); font-size: 14px;
    font-weight: 500; text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .open:hover { text-decoration: underline; }
  .where { font-size: 12px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .rows { display: flex; flex-wrap: wrap; gap: 4px; justify-content: flex-end; }
  .jump { min-height: 32px; padding: 0 8px; border: 0; border-radius: 6px; background: none; color: var(--accent); font-size: 13px; white-space: nowrap; }
  .jump:hover { background: #eef2fb; }
  .by-row { display: flex; align-items: flex-start; gap: 12px; padding: 8px 16px; border-top: 1px solid #f0f0f0; font-size: 14px; }
  .by-row ul { flex: 1; display: flex; flex-direction: column; gap: 4px; padding-top: 6px; }
  .by-row .open { font-weight: 400; }
  li.find { color: #7a4a00; }
  .empty, .hint { font-size: 13px; color: var(--muted); }
  .empty { padding: 24px 0; }
  .hint { margin: 8px 0 0; }
</style>
