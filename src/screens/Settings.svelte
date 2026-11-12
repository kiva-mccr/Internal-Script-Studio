<script lang="ts">
  // Settings (AU-3, mock-up 19): a window in the page, opened from ⋯. Each kind of setting has its own small heading,
  // so more can be added later; Voice-over (the microphone) is the first. A choice takes effect at once.
  import { chooseMic, chosenMic, listMics, type Mic } from '../lib/mic';

  let { onClose }: { onClose: () => void } = $props();

  let mics = $state<Mic[]>([]);
  let mic = $state(chosenMic());
  let listed = $state(false);
  let done = $state<HTMLButtonElement>();

  $effect(() => {
    listMics().then((found) => ((mics = found), (listed = true)));
    done?.focus();
  });

  // The picked mic stays in the list while it is unplugged (or hidden), so the drop-down still shows it.
  const options = $derived(mic.id && !mics.some((m) => m.id === mic.id) ? [...mics, mic] : mics);

  function pick(id: string) {
    mic = options.find((m) => m.id === id) ?? { id: '', name: '' };
    chooseMic(mic);
  }
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onClose()} />

<div class="backdrop" role="presentation" onpointerdown={(e) => e.target === e.currentTarget && onClose()}>
  <div class="window" role="dialog" aria-modal="true" aria-labelledby="settings-title" tabindex="-1">
    <div class="top">
      <h2 id="settings-title">Settings</h2>
      <button class="close" aria-label="Close" onclick={onClose}>×</button>
    </div>
    <div class="body">
      <h3>Voice-over</h3>
      <label for="mic">Microphone</label>
      <select id="mic" value={mic.id} onchange={(e) => pick(e.currentTarget.value)}>
        <option value="">Default</option>
        {#each options as m (m.id)}<option value={m.id}>{m.name || 'The microphone picked before'}</option>{/each}
      </select>
      <p class="hint">
        {#if listed && !mics.length}
          The names of your microphones show once Chrome may use the mic: record a take, or allow it in the address bar.
        {:else}
          Used for every take you record. Default follows the computer's sound settings.
        {/if}
      </p>
    </div>
    <div class="foot">
      <span>Kept in this browser only.</span>
      <button class="dark" bind:this={done} onclick={onClose}>Done</button>
    </div>
  </div>
</div>

<style>
  .backdrop { position: fixed; inset: 0; z-index: 20; display: flex; justify-content: center; align-items: flex-start;
    padding: 64px 16px; background: rgba(20, 20, 20, 0.25); overflow: auto; }
  .window { width: 100%; max-width: 520px; box-sizing: border-box; border-radius: 12px; background: var(--ground);
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.18); }
  .top { display: flex; align-items: center; padding: 8px 8px 8px 20px; border-bottom: 1px solid #eee; }
  h2 { flex: 1; margin: 0; font-size: 17px; font-weight: 600; }
  .close { min-width: 44px; min-height: 44px; border: 0; border-radius: 8px; background: none; color: var(--muted); font-size: 20px; }
  .close:hover { background: #f2f2f2; }
  .body { padding: 20px; }
  h3 { margin: 0 0 12px; font-size: 13px; font-weight: 600; color: var(--muted); }
  label { display: block; margin-bottom: 6px; font-size: 14px; font-weight: 500; }
  select { width: 100%; min-height: 44px; padding: 0 12px; border: 1px solid #d0d0d0; border-radius: 8px; background: #fff;
    color: var(--ink); font: inherit; font-size: 14px; }
  .hint { margin: 8px 0 0; font-size: 13px; line-height: 1.5; color: var(--muted); }
  .foot { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 14px 20px; border-top: 1px solid #eee;
    font-size: 12px; color: var(--muted); }
  .dark { min-height: 44px; padding: 0 18px; border: 0; border-radius: 8px; background: var(--ink); color: #fff; font-size: 14px; font-weight: 500; }
  .dark:hover { background: #333; }
</style>
