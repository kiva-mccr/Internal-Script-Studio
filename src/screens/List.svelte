<script lang="ts">
  import { onMount } from 'svelte';
  import { createScript, findScript, listScripts, type ScriptInfo } from '../lib/folder';
  import { routeHash } from '../lib/route';
  import { ago } from '../lib/when';

  let { folder, name, onChangeFolder }: { folder: FileSystemDirectoryHandle; name: string; onChangeFolder: () => void } =
    $props();

  let scripts = $state<ScriptInfo[] | null>(null);
  let error = $state('');
  let isOneScript = $state(false); // the picked folder is a single script's folder, not the one above it
  let adding = $state(false);
  let newName = $state('');
  let addError = $state('');

  async function load() {
    try {
      scripts = await listScripts(folder);
      isOneScript = scripts.length === 0 && (await findScript(folder, [])) !== null;
      error = '';
    } catch {
      error = "The folder couldn't be read. If OneDrive is still syncing, wait a moment and try again.";
    }
  }
  onMount(load);

  async function create(event: SubmitEvent) {
    event.preventDefault();
    addError = '';
    try {
      const made = await createScript(folder, newName, name);
      location.hash = routeHash([made]);
    } catch (e) {
      addError = e instanceof Error && !(e instanceof DOMException) ? e.message : "The script couldn't be created.";
    }
  }

  const label: Record<string, string> = { draft: 'Draft', 'in review': 'In review', approved: 'Approved' };
</script>

<svelte:window onfocus={load} />

<header>
  <span class="folder">{folder.name}</span>
  <button class="link" onclick={onChangeFolder}>Change folder</button>
  <button class="primary small" onclick={() => (adding = true)}>New script</button>
</header>

<main>
  {#if adding}
    <form class="new" onsubmit={create}>
      <label for="new-name">Name of the new script</label>
      <div class="new-row">
        <!-- svelte-ignore a11y_autofocus -->
        <input id="new-name" bind:value={newName} placeholder="Episode 05 - Food Chains" autofocus maxlength="120" />
        <button class="primary small" type="submit">Create</button>
        <button class="link" type="button" onclick={() => { adding = false; addError = ''; }}>Cancel</button>
      </div>
      {#if addError}<p class="error" role="alert">{addError}</p>{/if}
    </form>
  {/if}

  {#if error}
    <p class="error" role="alert">{error}</p>
  {:else if scripts && scripts.length === 0}
    <div class="empty">
      {#if isOneScript}
        <h1>This is one script's folder</h1>
        <p>Click Change folder and pick the folder above it, the one that holds all your team's scripts.</p>
      {:else}
        <h1>No scripts here yet</h1>
        <p>Each script is a folder with a script.md file in it. Click New script to start one.</p>
      {/if}
    </div>
  {:else if scripts}
    <div class="scroll">
      <div class="table">
        <div class="head"><span>Script</span><span>Status</span><span>Last edited</span></div>
        {#each scripts as script (script.path.join('/'))}
          <a class="row" href={routeHash(script.path)}>
            <span class="title">{script.title}</span>
            <span class="status"><span class="dot {script.status.replace(' ', '-')}" aria-hidden="true"></span>{label[script.status] ?? script.status}</span>
            <span class="when">{ago(script.edited)}</span>
          </a>
        {/each}
      </div>
    </div>
  {/if}
</main>

<style>
  header { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; padding: 12px 24px; border-bottom: 1px solid var(--line); }
  .folder { flex: 1 1 200px; font-size: 15px; font-weight: 600; }
  .small { min-height: 44px; padding: 0 18px; font-size: 14px; }
  main { max-width: 880px; margin: 0 auto; padding: 40px 16px; }
  .scroll { overflow-x: auto; }
  .table { min-width: 600px; }
  .head, .row { display: grid; grid-template-columns: minmax(0, 3fr) minmax(0, 1.2fr) minmax(0, 1.6fr); gap: 16px; padding: 0 12px; }
  .head { padding-bottom: 10px; font-size: 13px; color: var(--muted); border-bottom: 1px solid var(--line); }
  .row { align-items: center; min-height: 56px; border-bottom: 1px solid #f0f0f0; color: var(--ink); text-decoration: none; }
  .row:hover { background: #fafafa; }
  .row:hover .title { color: var(--accent); }
  .title { font-size: 15px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .status { display: inline-flex; align-items: center; gap: 8px; font-size: 14px; color: #3d3d3d; }
  .dot { width: 8px; height: 8px; border-radius: 50%; background: #b8b8b8; }
  .dot.in-review { background: #e08a1e; }
  .dot.approved { background: #1f8a4c; }
  .when { font-size: 14px; color: var(--muted); }
  .empty { text-align: center; padding-top: 10vh; }
  .empty h1 { margin: 0 0 8px; font-size: 22px; font-weight: 600; }
  .empty p { margin: 0 auto; max-width: 420px; color: var(--muted); line-height: 1.5; }
  .new { margin-bottom: 32px; display: flex; flex-direction: column; gap: 8px; }
  .new label { font-size: 14px; font-weight: 500; }
  .new-row { display: flex; flex-wrap: wrap; gap: 8px; }
  .new input { flex: 1 1 280px; font: inherit; font-size: 16px; padding: 10px 12px; border: 1px solid var(--line-strong); border-radius: 8px; }
  .error { margin: 0; font-size: 14px; color: var(--danger); }
</style>
