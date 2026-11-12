<script lang="ts">
  // Settings (AU-3, mock-up 19): a window in the page, opened from ⋯. Each kind of setting has its own small heading,
  // so more can be added later: Voice-over (the microphone and the clean-up of takes, AU-4), then Read time (the speaking speed, AP-12). A choice
  // takes effect at once. voiceWpm: the script's takes' speed together, offered as the speed (0 with no takes).
  import { cleaning, setCleaning } from '../lib/cleanup.svelte';
  import { chooseMic, chosenMic, listMics, type Mic } from '../lib/mic';
  import { setSpeed, speaking } from '../lib/readtime.svelte';

  let { voiceWpm = 0, onClose }: { voiceWpm?: number; onClose: () => void } = $props();

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
      <p class="group">Clean up each take</p>
      <label class="check"><input type="checkbox" checked={cleaning.crop} onchange={(e) => setCleaning({ crop: e.currentTarget.checked })} />
        <span>Crop the silence at the start and end<small>Keeps a quarter second either side, and drops the click of the mouse.</small></span></label>
      <label class="check"><input type="checkbox" checked={cleaning.noise} onchange={(e) => setCleaning({ noise: e.currentTarget.checked })} />
        <span>Reduce background noise<small>Edge's and Chrome's own noise reduction. A good mic in a quiet room may sound better without it.</small></span></label>
      <label class="check"><input type="checkbox" checked={cleaning.level} onchange={(e) => setCleaning({ level: e.currentTarget.checked })} />
        <span>Make every take equally loud<small>So one row isn't louder than the next when the script plays or is joined into one file.</small></span></label>
      <p class="hint">The recording itself is kept whole, so turning these off later brings it all back. Takes recorded before
        these switches play as they are.</p>
      <h3 class="next">Read time</h3>
      <label for="speed">Speaking speed</label>
      <div class="speed">
        <button class="step" aria-label="Slower" onclick={() => setSpeed(speaking.wpm - 10)}>−</button>
        <input id="speed" type="number" min="60" max="400" step="5" value={speaking.wpm}
          onchange={(e) => { setSpeed(Number(e.currentTarget.value)); e.currentTarget.value = String(speaking.wpm); }} />
        <button class="step" aria-label="Faster" onclick={() => setSpeed(speaking.wpm + 10)}>+</button>
        <span>words a minute</span>
      </div>
      <p class="hint">150 is a calm speaking speed. The teleprompter uses this speed too.</p>
      {#if voiceWpm && voiceWpm !== speaking.wpm}
        <p class="hint takes">Your takes average {voiceWpm} words a minute.
          <button class="outline use" onclick={() => setSpeed(voiceWpm)}>Use {voiceWpm}</button></p>
      {/if}
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
  .next { margin-top: 24px; }
  .group { margin: 20px 0 8px; font-size: 14px; font-weight: 500; }
  .check { display: flex; gap: 10px; align-items: flex-start; margin: 0 0 10px; font-weight: 400; line-height: 1.4; cursor: pointer; }
  .check input { width: 18px; height: 18px; margin: 1px 0 0; flex: none; accent-color: var(--accent); }
  .check small { display: block; font-size: 13px; color: var(--muted); }
  .speed { display: flex; align-items: center; gap: 10px; font-size: 14px; color: #3d3d3d; }
  .step { min-width: 44px; min-height: 44px; border: 1px solid #d0d0d0; border-radius: 8px; background: #fff; font-size: 16px; }
  .step:hover { background: #f2f2f2; }
  #speed { width: 90px; min-height: 44px; box-sizing: border-box; padding: 0 12px; border: 1px solid #d0d0d0; border-radius: 8px;
    font: inherit; font-size: 14px; }
  .takes { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; color: #3d3d3d; }
  .use { min-height: 36px; padding: 0 12px; font-size: 13px; }
  .hint { margin: 8px 0 0; font-size: 13px; line-height: 1.5; color: var(--muted); }
  .foot { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 14px 20px; border-top: 1px solid #eee;
    font-size: 12px; color: var(--muted); }
  .dark { min-height: 44px; padding: 0 18px; border: 0; border-radius: 8px; background: var(--ink); color: #fff; font-size: 14px; font-weight: 500; }
  .dark:hover { background: #333; }
</style>
