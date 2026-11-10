<script lang="ts">
  import { onMount } from 'svelte';
  import { changes, listVersions, officialNumbers, summary, type Version } from '../lib/history';
  import { renderMath, toHtml } from '../lib/format';
  import { at } from '../lib/when';

  let {
    dir,
    onRestore,
    onPublish,
  }: {
    dir: FileSystemDirectoryHandle;
    onRestore: (version: Version) => void;
    onPublish: (name: string) => Promise<Version | null>;
  } = $props();

  let versions = $state<Version[] | null>(null); // newest first
  let picked = $state(0);
  let error = $state('');
  let open = $state<Record<number, boolean>>({}); // folded groups opened, by the index of their first version
  let publishing = $state(false);
  let officialName = $state('');
  let nameMissing = $state(false);
  let nameInput = $state<HTMLInputElement>();

  onMount(load);

  async function load() {
    try {
      versions = (await listVersions(dir)).reverse();
      // With official versions, History opens on the newest one.
      const newestOfficial = versions.findIndex((v) => v.kind === 'official');
      picked = Math.max(newestOfficial, 0);
    } catch {
      error = "History couldn't be read. If OneDrive is still syncing, wait a moment and try again.";
    }
  }

  const numbers = $derived(officialNumbers([...(versions ?? [])].reverse()));
  const nextNumber = $derived(numbers.size + 1);

  // Without official versions: every version. With them: the official ones, and the small saves between two of
  // them folded into one line until opened.
  type Item = { kind: 'one'; i: number } | { kind: 'group'; first: number; list: number[]; label: string };
  const items = $derived.by((): Item[] => {
    const list = versions ?? [];
    if (!numbers.size) return list.map((_, i) => ({ kind: 'one', i }));
    const out: Item[] = [];
    let group: number[] = [];
    const flush = (label: string) => {
      if (group.length) out.push({ kind: 'group', first: group[0], list: group, label: `${count(group.length)} ${label}` });
      group = [];
    };
    list.forEach((v, i) => {
      if (v.kind !== 'official') return void group.push(i);
      flush(`since v${numbers.get(v.id)}`);
      out.push({ kind: 'one', i });
    });
    flush('before v1');
    return out;
  });

  const count = (n: number) => (n === 1 ? '1 change' : `${n} changes`);

  // The version a version is compared with: for an official one, the official one before it; otherwise its first
  // parent, else the one before it in time.
  function before(i: number): Version | undefined {
    const list = versions!;
    const n = numbers.get(list[i].id);
    if (n && n > 1) return list.find((v) => numbers.get(v.id) === n - 1);
    const parent = list[i].parents[0];
    return (parent && list.find((v) => v.id === parent)) || list[i + 1];
  }

  function title(i: number): string {
    const v = versions![i];
    const n = numbers.get(v.id);
    return n ? `v${n} · ${v.note}` : summary(v, before(i));
  }

  function startPublish() {
    publishing = true;
    officialName = '';
    nameMissing = false;
    queueMicrotask(() => nameInput?.focus());
  }

  async function publish(e: SubmitEvent) {
    e.preventDefault();
    const name = officialName.trim();
    if (!name) return void ((nameMissing = true), nameInput?.focus());
    if (!(await onPublish(name))) return;
    publishing = false;
    await load();
  }

  function math(node: HTMLElement, _text: string) {
    renderMath(node);
    return { update: () => renderMath(node) };
  }

  const selected = $derived(versions?.[picked]);
  const selectedChanges = $derived(versions && selected ? changes(before(picked)?.text, selected.text) : []);
  const selectedNumber = $derived(selected ? numbers.get(selected.id) : undefined);
</script>

{#if error}
  <p class="error" role="alert">{error}</p>
{:else if versions && versions.length === 0}
  <p class="empty">No history yet. It starts with the next save.</p>
{:else if versions && selected}
  {#snippet entry(i: number)}
    {@const version = versions![i]}
    {@const n = numbers.get(version.id)}
    <button class="entry" class:official={n} class:picked={i === picked} aria-current={i === picked ? 'true' : undefined}
      onclick={() => (picked = i)}>
      <span class="note">{#if n}<span class="tag">v{n}</span>{version.note}{:else}{summary(version, before(i))}{/if}</span>
      <span class="meta">{n ? 'Published by ' : ''}{version.who} · {at(Date.parse(version.when))}</span>
    </button>
  {/snippet}
  <div class="history">
    <div class="versions">
      <div class="nav-top">
        <h2>Versions</h2>
        <button class="primary small" onclick={startPublish}>Publish official version</button>
      </div>
      <nav aria-label="Versions">
        {#each items as item (item.kind === 'one' ? versions[item.i].id : `g${item.first}`)}
          {#if item.kind === 'one'}
            {@render entry(item.i)}
          {:else}
            <div class="group">
              <button class="fold" aria-expanded={!!open[item.first]} onclick={() => (open[item.first] = !open[item.first])}>
                <span aria-hidden="true">{open[item.first] ? '▾' : '▸'}</span> {item.label}
              </button>
              {#if open[item.first]}
                {#each item.list as i (versions[i].id)}{@render entry(i)}{/each}
              {/if}
            </div>
          {/if}
        {/each}
      </nav>
    </div>
    <section class="detail" aria-label="Changes">
      {#if publishing}
        <form class="publish" aria-label="Publish official version" novalidate onsubmit={publish}>
          <h2>Publish official version</h2>
          <label>Name it
            <input bind:this={nameInput} bind:value={officialName} oninput={() => (nameMissing = false)} placeholder="Final for recording" />
          </label>
          {#if nameMissing}<p class="missing" role="alert">Give it a name first.</p>{/if}
          <p class="meta">It becomes v{nextNumber}: the script as it is now, kept and shown in History. Everyone sees it.</p>
          <div class="actions">
            <button class="primary" type="submit">Publish v{nextNumber}</button>
            <button class="link" type="button" onclick={() => (publishing = false)}>Cancel</button>
          </div>
        </form>
      {/if}
      <div class="top">
        <h2>{title(picked)}</h2>
        {#if picked > 0}
          <button class="outline" onclick={() => onRestore(selected)}>Restore this version</button>
        {/if}
      </div>
      <p class="meta">
        {selectedNumber ? 'Published by ' : ''}{selected.who} · {at(Date.parse(selected.when))}{before(picked)
          ? ` · changes compared with ${selectedNumber && selectedNumber > 1 ? `v${selectedNumber - 1}` : 'the version before'}`
          : ''}
        {#if picked === 0}<br />This is the current version.{/if}
      </p>
      {#each selectedChanges as change, i (i)}
        <div class="change">
          <div class="where">{change.where}</div>
          <div class="body">
            {#if change.old}<p class="old"><span class="sign" aria-label="Removed">−</span><span class="struck" use:math={change.old}>{@html toHtml(change.old)}</span></p>{/if}
            {#if change.new}<p class="new"><span class="sign" aria-label="Added">+</span><span use:math={change.new}>{@html toHtml(change.new)}</span></p>{/if}
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
  .versions { flex: 1 1 280px; }
  nav { display: flex; flex-direction: column; gap: 4px; }
  h2 { margin: 0; font-size: 14px; font-weight: 600; }
  .nav-top { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 8px; }
  .versions .nav-top h2 { margin: 0; }
  .small { min-height: 36px; padding: 0 12px; font-size: 13px; }
  .group { display: flex; flex-direction: column; gap: 2px; padding: 6px 8px; border: 1px dashed var(--line-strong); border-radius: 8px; }
  .fold { min-height: 32px; padding: 0 6px; border: 0; background: none; color: var(--muted); font-size: 13px; font-weight: 500; text-align: left; }
  .tag { margin-right: 8px; padding: 2px 8px; border-radius: 999px; background: #e7f4ec; color: #1b6b3e; font-size: 12px; font-weight: 600; }
  .entry.official { min-height: 64px; }
  .entry.official .note { font-weight: 600; }
  .publish { display: flex; flex-direction: column; gap: 10px; padding: 16px 20px; border: 1px solid var(--line); border-radius: 10px; background: #fafafa; }
  .publish h2 { font-size: 16px; }
  .publish label { display: flex; flex-direction: column; gap: 6px; font-size: 14px; font-weight: 500; }
  .publish input { font: inherit; font-size: 16px; font-weight: 400; padding: 10px 12px; border: 1px solid var(--line-strong); border-radius: 8px; background: #fff; }
  .missing { margin: 0; font-size: 13px; color: var(--danger); }
  .actions { display: flex; gap: 8px; }
  .versions button.entry { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; min-height: 56px; padding: 10px 14px;
    border: 0; border-radius: 8px; background: none; text-align: left; }
  .versions button.entry:hover { background: #f7f7f7; }
  .versions button.entry.picked { background: #f0f3fc; }
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
