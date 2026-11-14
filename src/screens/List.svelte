<script lang="ts">
  import { problem } from '../lib/problems';
  import CopyDetails from './CopyDetails.svelte';
  import People from './People.svelte';
  import SharedFiles from './SharedFiles.svelte';
  import { onMount } from 'svelte';
  import { waiting } from '../lib/forme';
  import { keep, recall } from '../lib/remember';
  import FlagIcon from './FlagIcon.svelte';
  import { createScript, findScript } from '../lib/folder';
  import { clock, speaking } from '../lib/readtime.svelte';
  import { length, ScriptList, type Entry } from '../lib/scriptlist.svelte';
  import { routeHash } from '../lib/route';
  import { ago } from '../lib/when';

  let { folder, name, onChangeFolder }: { folder: FileSystemDirectoryHandle; name: string; onChangeFolder: () => void } =
    $props();

  // Each script's facts, remembered in this browser and checked against its files (AP-40).
  // svelte-ignore state_referenced_locally
  const list = new ScriptList(folder, name);
  let scripts = $derived(list.ready ? Object.values(list.entries).sort((a, b) => b.edited - a.edited) : null);
  let error = $state('');
  let isOneScript = $state(false); // the picked folder is a single script's folder, not the one above it
  let adding = $state(false);
  let newName = $state('');
  let addError = $state('');
  let onlyMine = $state(recall('list-for-me') === '1'); // the All · For me switch, kept in this browser
  const show = (forMeOnly: boolean) => keep('list-for-me', (onlyMine = forMeOnly) ? '1' : '');
  let mineCount = $derived(scripts?.filter((s) => waiting(s.counts?.mine)).length ?? 0);
  let shown = $derived(onlyMine ? (scripts ?? []).filter((s) => waiting(s.counts?.mine)) : (scripts ?? []));

  // The script's length as Play times it, at the speaking speed. Recorded once every row has a take.
  function lengthOf(script: Entry): { text: string; recorded: boolean } | null {
    const got = script.counts && length(script.counts, speaking.wpm);
    return got ? { text: clock(got.seconds), recorded: got.recorded } : null;
  }

  async function load() {
    try {
      await list.refresh();
      isOneScript = !Object.keys(list.entries).length && (await findScript(folder, [])) !== null;
      error = '';
    } catch (e) {
      error = problem("The folder couldn't be read. If the shared folder is still syncing, wait a moment and try again.", 'reading the list of scripts', e);
    }
  }
  onMount(load);

  // Rows on screen are read first.
  const observer = new IntersectionObserver((seen) => {
    for (const one of seen) list.seen((one.target as HTMLElement).dataset.name!, one.isIntersecting);
  });
  function watch(row: HTMLElement) {
    observer.observe(row);
    return { destroy: () => observer.unobserve(row) };
  }
  // Leaving the list stops its reading, so it doesn't slow the script being opened.
  onMount(() => () => {
    observer.disconnect();
    list.stop();
  });

  async function create(event: SubmitEvent) {
    event.preventDefault();
    addError = '';
    try {
      const made = await createScript(folder, newName, name);
      location.hash = routeHash([made]);
    } catch (e) {
      addError = e instanceof Error && !(e instanceof DOMException) ? e.message : problem("The script couldn't be created.", 'creating a script', e);
    }
  }

  let browsing = $state(false); // Files in every script (AS-1b)
  let meeting = $state(false); // People in the folder (AP-31)
  const label: Record<string, string> = { draft: 'Draft', 'in review': 'In review', approved: 'Approved' };
</script>

<svelte:window onfocus={load} />

<header>
  <span class="folder">{folder.name}</span>
  <button class="link" onclick={onChangeFolder}>Change folder</button>
  <button class="outline small" onclick={() => (browsing = true)}>Files</button>
  <button class="outline small" onclick={() => (meeting = true)}>People</button>
  <button class="primary small" onclick={() => (adding = true)}>New script</button>
</header>
{#if browsing}<SharedFiles root={folder} onClose={() => (browsing = false)} />{/if}
{#if meeting}<People root={folder} me={name} onClose={() => (meeting = false)} />{/if}

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
      {#if addError}<p class="error" role="alert">{addError}<CopyDetails message={addError} /></p>{/if}
    </form>
  {/if}

  {#if error}
    <p class="error" role="alert">{error}<CopyDetails message={error} /></p>
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
    <div class="switch" role="group" aria-label="Show">
      <button type="button" aria-pressed={!onlyMine} onclick={() => show(false)}>All <span class="count">{scripts.length}</span></button>
      <button type="button" aria-pressed={onlyMine} onclick={() => show(true)}>For me{#if mineCount}<span class="badge">{mineCount}</span>{/if}</button>
    </div>
    {#if onlyMine && shown.length === 0}
      <div class="empty nothing">
        <h1>Nothing waiting for you</h1>
        <p>No scripts to review and no unanswered replies. <button type="button" class="link" onclick={() => show(false)}>Show all {scripts.length}</button></p>
      </div>
    {:else}
    <div class="scroll">
      <div class="table" aria-busy={list.busy}>
        <div class="head"><span>Script</span><span>Status</span><span>Length</span><span>Last edited</span></div>
        {#each shown as script (script.path.join('/'))}
          {@const long = lengthOf(script)}
          {@const me = script.counts?.mine}
          <a class="row" href={routeHash(script.path)} data-name={script.path[0]} use:watch>
            <span class="title-cell"><span class="title">{script.title}</span>{#if script.counts?.flagged}<span class="flagged"><FlagIcon size={12} />{script.counts.flagged} flagged</span>{/if}{#if script.counts?.missing}<span class="missing">{script.counts.missing} missing</span>{/if}{#if me?.review}<span class="mine"><svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"></path><circle cx="12" cy="12" r="3"></circle></svg>Your review</span>{/if}{#if me?.replies}<span class="mine"><svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.8 7L3 21l2-6.2A8 8 0 1 1 21 12z"></path></svg>{me.replies === 1 ? '1 reply' : `${me.replies} replies`}</span>{/if}{#if me?.back}<span class="mine"><svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14L4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3"></path></svg>Sent back to you</span>{/if}</span>
            <span class="status"><span class="dot {script.status.replace(' ', '-')}" aria-hidden="true"></span>{label[script.status] ?? script.status}</span>
            <span class="length" title={long ? (long.recorded ? 'Recorded voice-over, every row' : `Read time at ${speaking.wpm} words a minute`) : undefined}>
              {long?.text ?? ''}{#if long?.recorded}<svg role="img" aria-label="recorded" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="3" width="6" height="11" rx="3"></rect><path d="M5 11a7 7 0 0 0 14 0M12 18v3"></path></svg>{/if}
            </span>
            <span class="when">{script.who ? `${script.who} · ` : ''}{ago(script.edited)}</span>
          </a>
        {/each}
      </div>
    </div>
    {/if}
  {/if}
</main>

<style>
  header { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; padding: 12px 24px; border-bottom: 1px solid var(--line); }
  .folder { flex: 1 1 200px; font-size: 15px; font-weight: 600; }
  .small { min-height: 44px; padding: 0 18px; font-size: 14px; }
  main { max-width: 880px; margin: 0 auto; padding: 40px 16px; }
  .scroll { overflow-x: auto; }
  .table { min-width: 600px; }
  .head, .row { display: grid; grid-template-columns: minmax(0, 3fr) minmax(0, 1.1fr) minmax(0, 0.8fr) minmax(0, 1.5fr); gap: 16px; padding: 0 12px; }
  .head { padding-bottom: 10px; font-size: 13px; color: var(--muted); border-bottom: 1px solid var(--line); }
  .row { align-items: center; min-height: 56px; border-bottom: 1px solid #f0f0f0; color: var(--ink); text-decoration: none; }
  .row:hover { background: #fafafa; }
  .row:hover .title { color: var(--accent); }
  .title-cell { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; min-width: 0; padding: 8px 0; }
  .mine { flex: none; display: inline-flex; align-items: center; gap: 5px; padding: 2px 8px; border-radius: 999px; background: #eef2fb; color: #1e46ae; font-size: 12px; font-weight: 500; }
  .switch { display: inline-flex; gap: 2px; margin-bottom: 16px; padding: 3px; border-radius: 10px; background: #f2f2f2; }
  .switch button { min-height: 38px; padding: 0 16px; border: 0; border-radius: 8px; background: none; font: inherit; font-size: 14px; font-weight: 500; color: var(--muted); cursor: pointer; }
  .switch button[aria-pressed='true'] { background: #fff; color: var(--ink); box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08); }
  .count { font-weight: 400; color: var(--muted); }
  .badge { display: inline-block; min-width: 18px; margin-left: 6px; padding: 1px 6px; box-sizing: border-box; border-radius: 999px; background: var(--accent); color: #fff; font-size: 12px; text-align: center; }
  .nothing { padding-top: 48px; }
  .nothing .link { font-size: inherit; }
  .flagged { flex: none; display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 999px; background: #fff7ed; color: var(--flag); font-size: 12px; font-weight: 500; }
  .missing { flex: none; padding: 2px 8px; border-radius: 999px; background: #fdf0ef; color: var(--danger); font-size: 12px; font-weight: 500; }
  .title { font-size: 15px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .length { display: inline-flex; align-items: center; gap: 6px; font-size: 14px; color: #3d3d3d; font-variant-numeric: tabular-nums; }
  .length svg { color: var(--accent); }
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
