<script lang="ts">
  import { onMount } from 'svelte';
  import { parseRoute } from './lib/route';
  import { hasAccess, loadFolder, loadName, saveFolder, saveName } from './lib/remember';
  import Editor from './screens/Editor.svelte';
  import List from './screens/List.svelte';
  import Setup from './screens/Setup.svelte';

  let route = $state(parseRoute(location.hash));
  const onHash = () => (route = parseRoute(location.hash));

  // checking: looking for a remembered folder. setup: the first-time screen. open: a folder is open.
  let screen = $state<'checking' | 'setup' | 'open'>('checking');
  let folder = $state<FileSystemDirectoryHandle | null>(null);
  let name = $state(loadName());
  let needsOk = $state(false); // a remembered folder the browser wants permission for again


  onMount(async () => {
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
</script>

<svelte:window onhashchange={onHash} />

{#if screen === 'setup'}
  <Setup {name} remembered={needsOk ? folder : null} onOpen={open} />
{:else if screen === 'open' && folder}
  {#if route.length === 0}
    <List {folder} {name} onChangeFolder={() => (screen = 'setup')} />
  {:else}
    {#key route.join('/')}
      <Editor {folder} path={route} {name} />
    {/key}
  {/if}
{/if}

<!-- The code, in the bottom corner of every screen (asked by the user). -->
<a class="repo" href="https://github.com/kiva-mccr/Internal-Script-Studio" target="_blank" rel="noopener">GitHub</a>

<style>
  .repo { position: fixed; right: 12px; bottom: 6px; z-index: 5; padding: 4px 8px; border-radius: 6px; background: var(--ground);
    font-size: 12px; color: var(--muted); text-decoration: none; }
  .repo:hover { color: var(--accent); }
</style>
