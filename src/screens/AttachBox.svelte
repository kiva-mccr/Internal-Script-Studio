<script lang="ts">
  import type { Snippet } from 'svelte';
  import { sizeText, tooBig, type Attachment } from '../lib/comments';
  import { assetFile } from '../lib/folder';
  import { IMAGE } from './Attached.svelte';

  // Files on a comment or reply being written or edited (RV-11, mock-up 25): Attach file, or drop files on the box,
  // or paste a screenshot; × takes one off. `files` are new ones (saved when the note is), `kept` ones already saved.
  let {
    dir,
    files = $bindable([]),
    kept = $bindable([]),
    children,
    actions,
  }: {
    dir: FileSystemDirectoryHandle;
    files?: File[];
    kept?: Attachment[];
    children: Snippet; // the text box
    actions: Snippet; // Add comment / Save, Cancel
  } = $props();

  let picker: HTMLInputElement;
  let problem = $state('');

  // Previews of images, new or kept, as short-lived blob URLs.
  let previews = $state(new Map<File | Attachment, string>());
  $effect(() => {
    const items: (File | Attachment)[] = [...kept, ...files].filter((f) => IMAGE.test(f.name));
    let gone = false;
    const made: string[] = [];
    (async () => {
      const next = new Map<File | Attachment, string>();
      for (const item of items) {
        const file = item instanceof File ? item : await assetFile(dir, item.path);
        if (!file || gone) continue;
        const url = URL.createObjectURL(file);
        made.push(url);
        next.set(item, url);
      }
      if (!gone) previews = next;
    })();
    return () => {
      gone = true;
      made.forEach((url) => URL.revokeObjectURL(url));
    };
  });

  function add(list: File[]) {
    problem = '';
    const ok: File[] = [];
    for (const file of list) {
      const why = tooBig(file);
      if (why) problem = why;
      else ok.push(file);
    }
    if (ok.length) files = [...files, ...ok];
  }

  function picked() {
    add(Array.from(picker.files ?? []));
    picker.value = '';
  }

  function dropped(e: DragEvent) {
    const list = Array.from(e.dataTransfer?.files ?? []);
    if (!list.length) return;
    e.preventDefault();
    add(list);
  }

  // Only files are taken from a paste; text pastes into the box as usual.
  function pasted(e: ClipboardEvent) {
    const list = Array.from(e.clipboardData?.files ?? []);
    if (!list.length) return;
    e.preventDefault();
    add(list);
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="attach" ondragover={(e) => e.dataTransfer?.types.includes('Files') && e.preventDefault()} ondrop={dropped} onpaste={pasted}>
  {@render children()}
  {#if kept.length || files.length}
    <ul class="list" aria-label="Attached files">
      {#each kept as item (item.path)}
        {@render line(item, item.size, () => (kept = kept.filter((k) => k !== item)))}
      {/each}
      {#each files as item, i (i)}
        {@render line(item, item.size, () => (files = files.filter((f) => f !== item)))}
      {/each}
    </ul>
  {/if}
  {#if problem}<p class="missing" role="alert">{problem}</p>{/if}
  <div class="actions">
    {@render actions()}
    <button type="button" class="outline attach-button" onclick={() => picker.click()}>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M13 7.5l-5.2 5.2a3 3 0 0 1-4.3-4.3l5.6-5.6a2 2 0 0 1 2.9 2.9L6.4 11.3a1 1 0 0 1-1.4-1.4l4.9-4.9"></path></svg>
      Attach file
    </button>
    <input type="file" multiple hidden bind:this={picker} onchange={picked} />
  </div>
  <p class="hint help">You can also drop files here, or paste a screenshot.</p>
</div>

{#snippet line(item: File | Attachment, size: number, remove: () => void)}
  <li>
    {#if previews.get(item)}
      <img src={previews.get(item)} alt="" />
    {:else}
      <span class="icon" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"><path d="M4 1.5h5.5L13 5v9.5H4z"></path><path d="M9.5 1.5V5H13"></path></svg></span>
    {/if}
    <span class="name"><span>{item.name}</span><span class="size">{sizeText(size)}</span></span>
    <button type="button" class="remove" aria-label="Remove {item.name}" onclick={remove}>×</button>
  </li>
{/snippet}

<style>
  .attach { display: flex; flex-direction: column; gap: 8px; }
  .list { display: flex; flex-direction: column; gap: 6px; margin: 0; padding: 0; list-style: none; }
  li { display: flex; align-items: center; gap: 10px; padding: 4px 4px 4px 6px; border: 1px solid var(--line); border-radius: 8px; }
  img, .icon { flex: none; width: 56px; height: 40px; border-radius: 4px; object-fit: cover; }
  .icon { display: inline-flex; align-items: center; justify-content: center; background: #f2f2f2; color: var(--muted); }
  .name { flex: 1; min-width: 0; display: flex; flex-direction: column; font-size: 13px; }
  .name span:first-child { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
  .size { color: var(--muted); }
  .remove { min-width: 36px; min-height: 36px; border: 0; border-radius: 6px; background: none; color: var(--muted); font-size: 18px; }
  .remove:hover { background: #f0f0f0; color: var(--ink); }
  .actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
  .attach-button { display: inline-flex; align-items: center; gap: 6px; margin-left: auto; min-height: 40px; padding: 0 12px; font-size: 14px; }
  .hint { margin: 0; font-size: 12px; color: var(--muted); }
  .missing { margin: 0; font-size: 13px; color: var(--danger); }
</style>
