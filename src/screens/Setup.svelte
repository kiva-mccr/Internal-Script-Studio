<script lang="ts">
  import { problem } from '../lib/problems';
  import CopyDetails from './CopyDetails.svelte';
  import { untrack } from 'svelte';
  import { askAccess, canOpenFolders, cleanName, pickFolder } from '../lib/remember';
  import { exampleFolded, foldExample } from '../lib/example';

  // remembered: a folder picked on an earlier visit that the browser wants permission for again.
  let {
    name: savedName,
    remembered = null,
    onOpen,
    onExample,
  }: {
    name: string;
    remembered?: FileSystemDirectoryHandle | null;
    onOpen: (folder: FileSystemDirectoryHandle, name: string) => void;
    onExample: (name: string) => Promise<void>; // the example to try (AP-33), as `name`, or "Guest" when it is empty
  } = $props();

  // Starting values only: the screen is made fresh each time it is shown.
  let name = $state(untrack(() => savedName));
  let error = $state('');
  let reopening = $state(untrack(() => remembered !== null));
  const supported = canOpenFolders();
  let nameInput = $state<HTMLInputElement>();
  let folded = $state(exampleFolded());

  function fold(to: boolean) {
    folded = to;
    foldExample(to);
  }

  async function tryExample() {
    error = '';
    try {
      await onExample(cleanName(name) || 'Guest');
    } catch (e) {
      error = problem("The example couldn't be opened in this browser.", 'opening the example', e);
    }
  }

  async function choose(event: SubmitEvent) {
    event.preventDefault();
    error = '';
    if (!cleanName(name)) {
      error = 'Type your name first.';
      nameInput?.focus();
      return;
    }
    try {
      const folder = await pickFolder();
      if (folder) onOpen(folder, cleanName(name));
    } catch (e) {
      error = problem("That folder couldn't be opened. Try again, or pick a different folder.", 'opening the picked folder', e);
    }
  }

  async function reopen() {
    error = '';
    try {
      if (remembered && (await askAccess(remembered))) onOpen(remembered, savedName);
      else error = 'The browser needs your OK to open the folder. Click the button again and choose Allow.';
    } catch (e) {
      error = problem("That folder couldn't be opened. It may have moved: choose it again.", 'reopening the remembered folder', e);
      reopening = false;
    }
  }
</script>

<header>Scripts</header>
<main>
  <div class="box">
    <svg aria-hidden="true" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
    </svg>

    {#if !supported}
      <h1>Open this in Chrome or Edge</h1>
      <p class="lead">Script Studio works in Chrome or Microsoft Edge on a computer. Other browsers and phones can't open a folder.</p>
    {:else if reopening && remembered}
      <h1>Welcome back{savedName ? `, ${savedName}` : ''}</h1>
      <p class="lead">The browser asks once more before opening your scripts folder.</p>
      <button class="primary" onclick={reopen}>Open {remembered.name}</button>
      <button class="link" onclick={() => (reopening = false)}>Choose a different folder</button>
    {:else}
      <h1>Open your scripts folder</h1>
      <p class="lead">Pick the shared folder your team keeps scripts in. This browser remembers it; you can change it later.</p>
      <form onsubmit={choose} novalidate>
        <label>
          Your name
          <input bind:this={nameInput} bind:value={name} maxlength="40" autocomplete="name" />
          <span class="hint help">Shown on your edits and comments.</span>
        </label>
        <button class="primary" type="submit">Choose folder</button>
      </form>
      <p class="small">Opened this from a link? You'll go straight to that script next.</p>
      <details>
        <summary>Before you start: put the folder on this computer</summary>
        <ul>
          <li>A network drive: it's on this computer already. Click Choose folder and pick the scripts folder on it.</li>
          <li>A synced folder, such as OneDrive: add the shared folder to your files, wait for it to appear on this
            computer, then click Choose folder and pick it.</li>
        </ul>
      </details>
      {#if folded}
        <button class="unfold" onclick={() => fold(false)}>▸ Try it with an example</button>
      {:else}
        <section class="example" aria-label="Try it with an example">
          <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 3v4a1 1 0 0 0 1 1h4"></path><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z"></path><path d="M9 13h6M9 17h4"></path>
          </svg>
          <div>
            <h2>New here? Try it with an example</h2>
            <p>Click around a made-up script about photosynthesis before you pick your team's folder. Your changes stay in this browser and are never shared.</p>
            <button class="outline" onclick={tryExample}>Open the example</button>
          </div>
          <button class="fold" aria-label="Minimize" title="Minimize" onclick={() => fold(true)}>–</button>
        </section>
      {/if}
    {/if}

    {#if error}<p class="error" role="alert">{error}<CopyDetails message={error} /></p>{/if}
  </div>
</main>

<style>
  header { padding: 20px 24px; font-size: 15px; font-weight: 600; }
  main { display: flex; justify-content: center; padding: 12vh 16px 96px; }
  .box { width: 100%; max-width: 440px; display: flex; flex-direction: column; align-items: center; gap: 20px; text-align: center; }
  h1 { margin: 0; font-size: 28px; font-weight: 600; letter-spacing: -0.01em; }
  .lead { margin: 0; font-size: 16px; line-height: 1.5; color: var(--muted); }
  form { width: 100%; display: flex; flex-direction: column; align-items: center; gap: 20px; }
  label { width: 100%; display: flex; flex-direction: column; gap: 6px; text-align: left; font-size: 14px; font-weight: 500; }
  input { font: inherit; font-size: 16px; font-weight: 400; padding: 10px 12px; border: 1px solid var(--line-strong); border-radius: 8px; }
  input:focus { outline: 2px solid var(--accent); outline-offset: 1px; border-color: transparent; }
  .hint { font-weight: 400; color: var(--muted); }
  .small { margin: 0; font-size: 14px; line-height: 1.5; color: var(--muted); }
  details { width: 100%; text-align: left; font-size: 14px; line-height: 1.5; color: var(--muted); border-top: 1px solid var(--line); padding-top: 16px; }
  summary { cursor: pointer; color: var(--ink); }
  ul { margin: 10px 0 0; padding-left: 20px; display: flex; flex-direction: column; gap: 6px; }
  .example { width: 100%; box-sizing: border-box; display: flex; gap: 14px; align-items: flex-start; text-align: left;
    padding: 16px 8px 16px 16px; border: 1px solid var(--line); border-radius: 10px; }
  .example svg { flex: none; margin-top: 2px; color: var(--muted); }
  .example div { flex: 1; display: flex; flex-direction: column; align-items: flex-start; gap: 6px; }
  .example h2 { margin: 0; font-size: 15px; font-weight: 600; }
  .example p { margin: 0 0 4px; font-size: 14px; line-height: 1.5; color: var(--muted); }
  .fold { flex: none; width: 44px; height: 44px; margin-top: -8px; border: 0; border-radius: 8px; background: none;
    color: var(--muted); font-size: 20px; }
  .fold:hover { color: var(--accent); }
  .unfold { align-self: stretch; min-height: 44px; padding: 0; border: 0; border-top: 1px solid var(--line);
    background: none; color: var(--ink); text-align: left; font-size: 14px; }
  .unfold:hover { color: var(--accent); }
  .error { margin: 0; font-size: 14px; color: var(--danger); }
</style>
