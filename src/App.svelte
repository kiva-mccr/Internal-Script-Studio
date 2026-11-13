<script lang="ts">
  import { onMount } from 'svelte';
  import { opensReview, parseRoute, routeHash } from './lib/route';
  import { hasAccess, loadFolder, loadName, saveFolder, saveName } from './lib/remember';
  import Editor from './screens/Editor.svelte';
  import List from './screens/List.svelte';
  import Setup from './screens/Setup.svelte';
  import { openExample, startOver } from './lib/example';
  import { versionLabel, versionTip, type Version } from './lib/version';

  const REPO = 'https://github.com/kiva-mccr/p2p-script-studio';
  const version: Version | null = __VERSION__; // set at build time (vite.config.ts)

  let route = $state<string[]>([]);
  let review = $state(false); // a shared link: the script opens on Review (RV-10)
  function onHash() {
    route = parseRoute(location.hash);
    review = opensReview(location.hash);
    // The mark is dropped from the address once read, so a reload after moving to Write stays there.
    if (review) history.replaceState(null, '', location.pathname + location.search + routeHash(route));
  }
  onHash();

  // checking: looking for a remembered folder. setup: the first-time screen. open: a folder is open.
  let screen = $state<'checking' | 'setup' | 'open'>('checking');
  let folder = $state<FileSystemDirectoryHandle | null>(null);
  let name = $state(loadName());
  let needsOk = $state(false); // a remembered folder the browser wants permission for again
  // The example to try (AP-33): open in place of the folder, never remembered as it. `fresh` restarts its screens.
  let example = $state<{ folder: FileSystemDirectoryHandle; name: string; fresh: number } | null>(null);
  let undoStart = $state<(() => Promise<FileSystemDirectoryHandle>) | null>(null);
  let undoTimer: ReturnType<typeof setTimeout> | undefined;


  onMount(async () => {
    const inExample = session('');
    if (inExample) return tryExample(inExample).catch(() => leaveExample()); // a reload stays in the example
    const remembered = name ? await loadFolder() : null;
    folder = remembered;
    if (remembered && (await hasAccess(remembered).catch(() => false))) screen = 'open';
    else {
      needsOk = remembered !== null;
      screen = 'setup';
    }
  });

  async function open(picked: FileSystemDirectoryHandle, typed: string) {
    folder = picked;
    name = typed;
    saveName(typed);
    needsOk = false;
    screen = 'open';
    await saveFolder(picked).catch(() => {}); // Storage blocked: asked again next visit.
  }

  async function tryExample(typed: string) {
    if (typed !== 'Guest') saveName((name = typed));
    example = { folder: await openExample(), name: typed, fresh: 0 };
    session(typed);
  }

  // Back to the first-time screen, at the list: the example's script names mean nothing in the real folder.
  function leaveExample() {
    example = null;
    undoStart = null;
    session(null);
    screen = 'setup';
    history.replaceState(null, '', location.pathname + location.search);
    route = [];
  }

  // Being in the example, for this tab only (sessionStorage): the name it was opened as. '' only reads; null forgets.
  function session(set: string | null): string {
    try {
      if (set === null) sessionStorage.removeItem('studio.example');
      else if (set) sessionStorage.setItem('studio.example', set);
      return sessionStorage.getItem('studio.example') ?? '';
    } catch {
      return '';
    }
  }

  // Start over goes through an Undo bar, like a delete.
  async function restart() {
    if (!example) return;
    const { folder, undo } = await startOver();
    example = { ...example, folder, fresh: example.fresh + 1 };
    undoStart = undo;
    clearTimeout(undoTimer);
    undoTimer = setTimeout(() => (undoStart = null), 10000);
  }

  async function undoRestart() {
    if (!example || !undoStart) return;
    const folder = await undoStart();
    undoStart = null;
    example = { ...example, folder, fresh: example.fresh + 1 };
  }
</script>

<svelte:window onhashchange={onHash} />

{#if example}
  <div class="example">
    <p><b>Example script.</b> Try anything: your changes stay in this browser and are never shared.</p>
    <button class="link start" onclick={restart}>Start over</button>
    <button class="outline" onclick={leaveExample}>Open your scripts folder</button>
  </div>
  {#key example.fresh}
    {#if route.length === 0}
      <List folder={example.folder} name={example.name} onChangeFolder={leaveExample} />
    {:else}
      {#key route.join('/')}
        <Editor folder={example.folder} path={route} name={example.name} {review} />
      {/key}
    {/if}
  {/key}
  {#if undoStart}
    <div class="undo" aria-live="polite">
      <p>The example is back as new.</p>
      <button class="outline" onclick={undoRestart}>Undo</button>
    </div>
  {/if}
{:else if screen === 'setup'}
  <Setup {name} remembered={needsOk ? folder : null} onOpen={open} onExample={tryExample} />
{:else if screen === 'open' && folder}
  {#if route.length === 0}
    <List {folder} {name} onChangeFolder={() => (screen = 'setup')} />
  {:else}
    {#key route.join('/')}
      <Editor {folder} path={route} {name} {review} />
    {/key}
  {/if}
{/if}

<!-- The live version and the code, in the bottom corners of every screen (asked by the user). -->
<a class="corner version" href={version ? `${REPO}/pull/${version.pr}` : REPO} title={versionTip(version)} target="_blank" rel="noopener">{versionLabel(version)}</a>
<a class="corner repo" href={REPO} target="_blank" rel="noopener">GitHub</a>

<style>
  .corner { position: fixed; bottom: 6px; z-index: 5; padding: 4px 8px; border-radius: 6px; background: var(--ground);
    font-size: 12px; color: var(--muted); text-decoration: none; }
  .corner:hover { color: var(--accent); }
  .repo { right: 12px; }
  .version { left: 12px; }
  .example { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 16px; padding: 4px 24px; background: #eef2fb;
    font-size: 14px; }
  .example p { flex: 1 1 320px; margin: 0; color: #3d3d3d; }
  .example b { color: var(--ink); font-weight: 600; }
  .example .start { color: var(--accent-dark); font-weight: 500; }
  .example .outline { min-height: 36px; border-color: #c9d5f2; }
  .undo { position: fixed; z-index: 10; left: 50%; bottom: 24px; transform: translateX(-50%); width: min(720px, calc(100% - 32px));
    box-sizing: border-box; display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; padding: 10px 16px;
    border-radius: 10px; background: var(--ground); border: 1px solid var(--line); box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08); }
  .undo p { margin: 0; flex: 1 1 300px; font-size: 14px; }
</style>
