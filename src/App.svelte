<script lang="ts">
  import { onMount } from 'svelte';
  import { parseRoute } from './lib/route';
  import { hasAccess, loadFolder, loadName, saveFolder, saveName } from './lib/remember';
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
  <header>
    <span class="folder">{folder.name}</span>
    <button class="link" onclick={() => (screen = 'setup')}>Change folder</button>
  </header>
  <main>
    {#if route.length === 0}
      <h1>Script Studio</h1>
      <p>Being built. See the roadmap.</p>
    {:else}
      <h1>{route.join(' / ')}</h1>
    {/if}
  </main>
{/if}

<style>
  header { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; padding: 12px 24px; border-bottom: 1px solid var(--line); }
  .folder { flex: 1 1 200px; font-size: 15px; font-weight: 600; }
  main { max-width: 880px; margin: 0 auto; padding: 40px 16px; }
  h1 { margin: 0 0 12px; font-size: 28px; font-weight: 600; }
  p { margin: 0; color: var(--muted); }
</style>
