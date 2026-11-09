<script lang="ts">
  import { onMount } from 'svelte';
  import { changes, listVersions, summary, type Version } from '../lib/history';
  import { at } from '../lib/when';

  let { dir, onRestore }: { dir: FileSystemDirectoryHandle; onRestore: (version: Version) => void } = $props();

  let versions = $state<Version[] | null>(null); // newest first
  let picked = $state(0);
  let error = $state('');

  onMount(async () => {
    try {
      versions = (await listVersions(dir)).reverse();
    } catch {
      error = "History couldn't be read. If OneDrive is still syncing, wait a moment and try again.";
    }
  });

  // The version a version was made from: its first parent, else the one before it in time.
  function before(i: number): Version | undefined {
    const list = versions!;
    const parent = list[i].parents[0];
    return (parent && list.find((v) => v.id === parent)) || list[i + 1];
  }

  const selected = $derived(versions?.[picked]);
  const selectedChanges = $derived(versions && selected ? changes(before(picked)?.text, selected.text) : []);
</script>

{#if error}
  <p class="error" role="alert">{error}</p>
{:else if versions && versions.length === 0}
  <p class="empty">No history yet. It starts with the next save.</p>
{:else if versions && selected}
  <div class="history">
    <nav aria-label="Versions" class="versions">
      <h2>Versions</h2>
      {#each versions as version, i (version.id)}
        <button class:picked={i === picked} aria-current={i === picked ? 'true' : undefined} onclick={() => (picked = i)}>
          <span class="note">{summary(version, before(i))}</span>
          <span class="meta">{version.who} · {at(Date.parse(version.when))}</span>
        </button>
      {/each}
    </nav>
    <section class="detail" aria-label="Changes">
      <div class="top">
        <h2>{summary(selected, before(picked))}</h2>
        {#if picked > 0}
          <button class="outline" onclick={() => onRestore(selected)}>Restore this version</button>
        {/if}
      </div>
      <p class="meta">
        {selected.who} · {at(Date.parse(selected.when))}{before(picked) ? ' · changes compared with the version before' : ''}
        {#if picked === 0}<br />This is the current version.{/if}
      </p>
      {#each selectedChanges as change, i (i)}
        <div class="change">
          <div class="where">{change.where}</div>
          <div class="body">
            {#if change.old}<p class="old"><span class="sign" aria-label="Removed">−</span><span class="struck">{change.old}</span></p>{/if}
            {#if change.new}<p class="new"><span class="sign" aria-label="Added">+</span>{change.new}</p>{/if}
          </div>
        </div>
      {:else}
        <p class="meta">Nothing in the rows changed.</p>
      {/each}
    </section>
  </div>
{/if}

<style>
  .history { display: flex; flex-wrap: wrap; gap: 40px; align-items: flex-start; }
  .versions { flex: 1 1 280px; display: flex; flex-direction: column; gap: 4px; }
  h2 { margin: 0; font-size: 14px; font-weight: 600; }
  .versions h2 { margin-bottom: 8px; }
  .versions button { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; min-height: 56px; padding: 10px 14px;
    border: 0; border-radius: 8px; background: none; text-align: left; }
  .versions button:hover { background: #f7f7f7; }
  .versions button.picked { background: #f0f3fc; }
  .note { font-size: 14px; font-weight: 500; color: var(--ink); }
  .meta { margin: 0; font-size: 13px; color: var(--muted); line-height: 1.5; }
  .detail { flex: 999 1 560px; min-width: 0; display: flex; flex-direction: column; gap: 16px; }
  .top { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; }
  .top h2 { font-size: 20px; }
  .change { border: 1px solid var(--line); border-radius: 10px; overflow: hidden; }
  .where { padding: 10px 16px; font-size: 13px; color: var(--muted); background: #fafafa; border-bottom: 1px solid var(--line); }
  .body { display: flex; flex-direction: column; gap: 8px; padding: 16px; }
  .body p { margin: 0; font-size: 15px; line-height: 1.55; white-space: pre-wrap; }
  .old { color: #8a2b2b; }
  .struck { text-decoration: line-through; }
  .new { color: #1b6b3e; }
  .sign { display: inline-block; width: 18px; font-weight: 600; }
  .empty, .error { color: var(--muted); }
  .error { color: var(--danger); }
</style>
