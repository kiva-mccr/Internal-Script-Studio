<script lang="ts">
  import { untrack } from 'svelte';
  import { askAccess, canOpenFolders, cleanName, pickFolder } from '../lib/remember';

  // remembered: a folder picked on an earlier visit that the browser wants permission for again.
  let {
    name: savedName,
    remembered = null,
    onOpen,
  }: {
    name: string;
    remembered?: FileSystemDirectoryHandle | null;
    onOpen: (folder: FileSystemDirectoryHandle, name: string) => void;
  } = $props();

  // Starting values only: the screen is made fresh each time it is shown.
  let name = $state(untrack(() => savedName));
  let error = $state('');
  let reopening = $state(untrack(() => remembered !== null));
  const supported = canOpenFolders();
  let nameInput = $state<HTMLInputElement>();

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
    } catch {
      error = "That folder couldn't be opened. Try again, or pick a different folder.";
    }
  }

  async function reopen() {
    error = '';
    try {
      if (remembered && (await askAccess(remembered))) onOpen(remembered, savedName);
      else error = 'The browser needs your OK to open the folder. Click the button again and choose Allow.';
    } catch {
      error = "That folder couldn't be opened. It may have moved: choose it again.";
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
          <span class="hint">Shown on your edits and comments.</span>
        </label>
        <button class="primary" type="submit">Choose folder</button>
      </form>
      <p class="small">Opened this from a link? You'll go straight to that script next.</p>
      <details>
        <summary>Before you start: put the folder on this computer</summary>
        <ol>
          <li>Open the shared folder in OneDrive on the web (the link your team sent you).</li>
          <li>Click <b>Add shortcut to My files</b>.</li>
          <li>Wait a minute for it to appear in the OneDrive folder on this computer, then click Choose folder and pick it.</li>
        </ol>
      </details>
    {/if}

    {#if error}<p class="error" role="alert">{error}</p>{/if}
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
  ol { margin: 10px 0 0; padding-left: 20px; display: flex; flex-direction: column; gap: 6px; }
  b { color: var(--ink); font-weight: 600; }
  .error { margin: 0; font-size: 14px; color: var(--danger); }
</style>
