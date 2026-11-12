<script lang="ts">
  import { IMAGE } from './Attached.svelte';
  import SharedFiles from './SharedFiles.svelte';
  import { addAsset, assetFile } from '../lib/folder';
  import { readFileRef } from '../lib/script';

  // files: the row's Files lines. root and here: the picked folder and this script's folder name, for "From other
  // scripts…" (AS-1); row: the row's number. onChange: called with the new list. onNotice: a message for the page.
  let {
    files,
    dir,
    root,
    here,
    row,
    onChange,
    onNotice,
  }: {
    files: string[];
    dir: FileSystemDirectoryHandle;
    root: FileSystemDirectoryHandle;
    here: string;
    row: number;
    onChange: (files: string[]) => void;
    onNotice: (message: string) => void;
  } = $props();

  let adding = $state(false);
  let browsing = $state(false);
  // The line last added from another script, and that script's title, shown under its chip.
  let copied = $state<{ line: string; from: string } | null>(null);
  // Thumbnails: image files in the script's folder, by path, as short-lived blob URLs. Linked images use their link.
  let previews = $state<Record<string, string>>({});

  $effect(() => {
    const paths = files.map(readFileRef).filter((ref) => ref.kind === 'path' && IMAGE.test(ref.target)).map((ref) => ref.target);
    let gone = false;
    const made: string[] = [];
    (async () => {
      const next: Record<string, string> = {};
      for (const path of paths) {
        const file = await assetFile(dir, path);
        if (!file) continue;
        const url = URL.createObjectURL(file);
        if (gone) URL.revokeObjectURL(url);
        else made.push((next[path] = url));
      }
      if (!gone) previews = next;
    })();
    return () => {
      gone = true;
      made.forEach((url) => URL.revokeObjectURL(url));
    };
  });

  function previewOf(ref: { kind: string; target: string }): string {
    if (!IMAGE.test(ref.target)) return '';
    return ref.kind === 'path' ? (previews[ref.target] ?? '') : ref.kind === 'link' ? ref.target : '';
  }
  let typed = $state('');
  let picker: HTMLInputElement;

  async function openAsset(path: string) {
    const file = await assetFile(dir, path);
    if (!file) {
      onNotice(`${path} isn't in the script's folder. If someone just added it, OneDrive may still be syncing.`);
      return;
    }
    const url = URL.createObjectURL(file);
    window.open(url, '_blank', 'noopener');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  async function picked() {
    const chosen = Array.from(picker.files ?? []);
    picker.value = '';
    try {
      const paths = [];
      for (const file of chosen) paths.push(await addAsset(dir, file));
      onChange([...files, ...paths]);
      adding = false;
    } catch {
      onNotice("The file couldn't be copied into the script's folder.");
    }
  }

  function addShared(line: string, from: string) {
    onChange([...files, line]);
    copied = { line, from };
    browsing = adding = false;
  }

  function addTyped(event: SubmitEvent) {
    event.preventDefault();
    const line = typed.trim();
    if (line) onChange([...files, line]);
    typed = '';
    adding = false;
  }
</script>

<div class="files">
  {#each files as line, i (i + line)}
    {@const ref = readFileRef(line)}
    {@const preview = previewOf(ref)}
    {#if preview}
      <button class="thumb" aria-label="Open {ref.label}"
        onclick={() => (ref.kind === 'path' ? openAsset(ref.target) : window.open(ref.target, '_blank', 'noopener'))}>
        <img src={preview} alt="" onerror={(e) => ((e.currentTarget as HTMLElement).parentElement!.hidden = true)} />
      </button>
    {/if}
    <span class="chip">
      {#if ref.kind === 'link'}
        <a href={ref.target} target="_blank" rel="noopener noreferrer" title={ref.target}>{ref.label}</a>
      {:else if ref.kind === 'path'}
        <button class="open" title={ref.target} onclick={() => openAsset(ref.target)}>{ref.label}</button>
      {:else}
        <span class="words">{ref.label}</span>
      {/if}
      <button class="remove" aria-label="Remove {ref.label}" onclick={() => onChange(files.filter((_, j) => j !== i))}>×</button>
    </span>
    {#if copied?.line === line}<span class="copied">Copied from {copied.from}</span>{/if}
  {/each}

  {#if adding}
    <form class="add-form" onsubmit={addTyped}>
      <span class="ways">
        <button type="button" class="choose" onclick={() => picker.click()}>Choose a file…</button>
        <button type="button" class="choose" onclick={() => (browsing = true)}>From other scripts…</button>
      </span>
      <!-- svelte-ignore a11y_autofocus -->
      <input bind:value={typed} placeholder="or paste a link, or describe it" aria-label="Link or description" autofocus
        onkeydown={(e) => e.key === 'Escape' && (adding = false)} />
    </form>
  {:else}
    <button class="add" onclick={() => (adding = true)}>+ Add</button>
  {/if}
  <input type="file" multiple hidden bind:this={picker} onchange={picked} />
  {#if browsing}<SharedFiles {root} {here} {dir} {row} onAdd={addShared} onClose={() => (browsing = false)} />{/if}
</div>

<style>
  .files { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; }
  .thumb { display: block; max-width: 100%; padding: 0; border: 1px solid var(--line); border-radius: 6px; background: #fafafa; overflow: hidden; }
  .thumb:hover { border-color: var(--accent); }
  .thumb img { display: block; max-width: 100%; max-height: 120px; object-fit: contain; }
  .chip { display: inline-flex; align-items: center; max-width: 100%; border-radius: 6px; background: #f5f5f5; font-size: 13px; }
  .chip > a, .open, .words { padding: 6px 4px 6px 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--ink); }
  .chip > a { text-decoration: underline; text-decoration-color: var(--line-strong); }
  .open { border: 0; background: none; font-size: 13px; text-align: left; }
  .open:hover, .chip > a:hover { color: var(--accent); }
  .words { color: var(--muted); font-style: italic; }
  .remove { border: 0; background: none; color: var(--muted); padding: 4px 8px; font-size: 15px; opacity: 0; }
  .chip:hover .remove, .remove:focus-visible { opacity: 1; }
  .remove:hover { color: var(--danger); }
  .add { border: 0; background: none; padding: 4px 0; color: var(--muted); font-size: 13px; opacity: 0; }
  .add:focus-visible, :global(.row:hover) .add, :global(.row:focus-within) .add { opacity: 1; }
  .add:hover { color: var(--accent); }
  .add-form { display: flex; flex-direction: column; gap: 6px; width: 100%; }
  .ways { display: flex; flex-wrap: wrap; gap: 6px; }
  .copied { font-size: 12px; color: var(--muted); }
  .choose { border: 1px solid var(--line-strong); border-radius: 6px; background: #fff; padding: 5px 10px; font-size: 13px; }
  .add-form input { font: inherit; font-size: 13px; padding: 6px 8px; border: 1px solid var(--line-strong); border-radius: 6px; }
</style>
