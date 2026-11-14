<script lang="ts">
  // Settings (AU-3, mock-up 19; the mic list AU-5, board 33): a window in the page, opened from ⋯. Each kind of setting has its own small heading,
  // so more can be added later: Screen (Hide help text, AP-43, board 64), Voice-over (the microphone and the clean-up of takes, AU-4), then Read time (the speaking speed, AP-12), then Keyboard shortcuts (AP-44, `Shortcuts.svelte`). A choice
  // takes effect at once. voiceWpm: the script's takes' speed together, offered as the speed (0 with no takes).
  import { cleaning, setCleaning } from '../lib/cleanup.svelte';
  import { chooseMic, chosenMic, listMics, type Mic } from '../lib/mic';
  import { setSpeed, speaking } from '../lib/readtime.svelte';
  import { helpHidden, hideHelp } from '../lib/helptext';
  import Shortcuts from './Shortcuts.svelte';

  let { voiceWpm = 0, onClose }: { voiceWpm?: number; onClose: () => void } = $props();

  let mics = $state<Mic[]>([]);
  let mic = $state(chosenMic());
  let listed = $state(false);
  let listOpen = $state(false);
  let active = $state(0);
  let field = $state<HTMLButtonElement>();
  let hidingHelp = $state(helpHidden());
  let done = $state<HTMLButtonElement>();

  $effect(() => {
    listMics().then((found) => ((mics = found), (listed = true)));
    done?.focus();
  });

  // The rows of the Microphone list (AU-5, board 33): the computer's default mic is marked "(default)" and picking it
  // follows the default (''), whichever mic that is then. With no names yet (or no default found) one row stands for
  // it. The picked mic stays in the list while it is unplugged (or hidden), so it still shows as picked.
  type Row = { value: string; name: string; tag: string };
  const rows = $derived.by((): Row[] => {
    const list: Row[] = mics.map((m) => ({ value: m.isDefault ? '' : m.id, name: m.name, tag: m.isDefault ? '(default)' : '' }));
    if (!mics.some((m) => m.isDefault)) list.unshift({ value: '', name: "Computer's microphone", tag: '(default)' });
    if (mic.id && !mics.some((m) => m.id === mic.id))
      list.push({ value: mic.id, name: mic.name || 'The microphone picked before', tag: mics.length ? '(unplugged)' : '' });
    return list;
  });
  // A mic picked before it became the default shows on the default row until another row is picked.
  const picked = $derived(Math.max(0, rows.findIndex((r) => r.value === mic.id || (r.value === '' && mics.some((m) => m.isDefault && m.id === mic.id)))));

  function pick(row: Row) {
    mic = { id: row.value, name: row.value ? row.name : '' };
    chooseMic(mic);
    close();
  }

  function open() {
    active = picked;
    listOpen = true;
  }

  function close() {
    listOpen = false;
    field?.focus();
  }

  // The list works like the browser's own drop-down: arrows move, Enter or Space picks, Esc or Tab closes.
  function onKey(e: KeyboardEvent) {
    if (!listOpen) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) (e.preventDefault(), open());
      return;
    }
    if (e.key === 'Escape') (e.preventDefault(), e.stopPropagation(), close());
    else if (e.key === 'Tab') listOpen = false;
    else if (e.key === 'ArrowDown') (e.preventDefault(), (active = Math.min(rows.length - 1, active + 1)));
    else if (e.key === 'ArrowUp') (e.preventDefault(), (active = Math.max(0, active - 1)));
    else if (e.key === 'Home') (e.preventDefault(), (active = 0));
    else if (e.key === 'End') (e.preventDefault(), (active = rows.length - 1));
    else if (e.key === 'Enter' || e.key === ' ') (e.preventDefault(), pick(rows[active]));
  }
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && !e.defaultPrevented && onClose()} />

<div class="backdrop" role="presentation" onpointerdown={(e) => e.target === e.currentTarget && onClose()}>
  <div class="window" role="dialog" aria-modal="true" aria-labelledby="settings-title" tabindex="-1">
    <div class="top">
      <h2 id="settings-title">Settings</h2>
      <button class="close" aria-label="Close" onclick={onClose}>×</button>
    </div>
    <div class="body">
      <h3>Screen</h3>
      <label class="check"><input type="checkbox" checked={hidingHelp} onchange={(e) => hideHelp((hidingHelp = e.currentTarget.checked))} />
        <span>Hide help text<small>The grey lines that explain how things work. For people who know the app.</small></span></label>
      <h3 class="next">Voice-over</h3>
      <label for="mic">Microphone</label>
      <div class="picker" onfocusout={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && (listOpen = false)}>
        <button id="mic" class="field" bind:this={field} role="combobox" aria-haspopup="listbox" aria-expanded={listOpen}
          aria-controls="mics" aria-activedescendant={listOpen ? `mic-${active}` : undefined}
          onclick={() => (listOpen ? close() : open())} onkeydown={onKey}>
          <span class="name">{rows[picked]?.name}</span> <span class="tag">{rows[picked]?.tag}</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
            stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
        </button>
        {#if listOpen}
          <ul id="mics" class="list" role="listbox" aria-label="Microphone">
            {#each rows as row, i (row.value)}
              <!-- svelte-ignore a11y_click_events_have_key_events (the keys are on the field, as in a browser's drop-down) -->
              <li id="mic-{i}" role="option" aria-selected={i === picked} class:active={i === active}
                onpointerenter={() => (active = i)} onpointerdown={(e) => e.preventDefault()} onclick={() => pick(row)}>
                <span class="tick" aria-hidden="true">{i === picked ? '✓' : ''}</span><span class="name">{row.name}</span> <span class="tag">{row.tag}</span>
              </li>
            {/each}
          </ul>
        {/if}
      </div>
      <p class="hint" class:help={!listed || mics.length > 0}>
        {#if listed && !mics.length}
          The names of your microphones show once Chrome may use the mic: record a take, or allow it in the address bar.
        {:else}
          Used for every take you record. (default) is the mic set in the computer's sound settings.
        {/if}
      </p>
      <p class="group">Clean up each take</p>
      <label class="check"><input type="checkbox" checked={cleaning.crop} onchange={(e) => setCleaning({ crop: e.currentTarget.checked })} />
        <span>Crop the silence at the start and end<small class="help">Keeps a quarter second either side, and drops the click of the mouse.</small></span></label>
      <label class="check"><input type="checkbox" checked={cleaning.noise} onchange={(e) => setCleaning({ noise: e.currentTarget.checked })} />
        <span>Reduce background noise<small class="help">Edge's and Chrome's own noise reduction. A good mic in a quiet room may sound better without it.</small></span></label>
      <label class="check"><input type="checkbox" checked={cleaning.level} onchange={(e) => setCleaning({ level: e.currentTarget.checked })} />
        <span>Make every take equally loud<small class="help">So one row isn't louder than the next when the script plays or is joined into one file.</small></span></label>
      <p class="hint help">The recording itself is kept whole, so turning these off later brings it all back. Takes recorded before
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
      <p class="hint help">150 is a calm speaking speed. The teleprompter uses this speed too.</p>
      {#if voiceWpm && voiceWpm !== speaking.wpm}
        <p class="hint takes">Your takes average {voiceWpm} words a minute.
          <button class="outline use" onclick={() => setSpeed(voiceWpm)}>Use {voiceWpm}</button></p>
      {/if}
      <Shortcuts />
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
  .picker { position: relative; }
  .field { width: 100%; min-height: 44px; padding: 0 12px; display: flex; align-items: center; gap: 10px; border: 1px solid #d0d0d0;
    border-radius: 8px; background: #fff; color: var(--ink); font: inherit; font-size: 14px; text-align: left; }
  .field[aria-expanded='true'] { border-color: var(--accent); }
  .field svg { flex: none; color: var(--muted); }
  .name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .tag { flex: none; font-size: 13px; color: var(--muted); }
  .list { position: absolute; left: 0; right: 0; top: calc(100% + 4px); z-index: 1; margin: 0; padding: 6px; list-style: none;
    border: 1px solid #e6e6e6; border-radius: 10px; background: #fff; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1); }
  .list li { min-height: 40px; padding: 0 12px; display: flex; align-items: center; gap: 10px; border-radius: 6px; font-size: 14px; cursor: pointer; }
  .list li.active { background: #f2f5fd; }
  .tick { width: 14px; flex: none; color: var(--accent); }
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
