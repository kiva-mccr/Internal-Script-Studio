<script lang="ts">
  // Keyboard shortcuts in Settings (AP-44, board 65): every key the app knows, by where it works. The new ones can be
  // changed: click the key, press the new one (Esc to stop), and it is kept in this browser; Reset brings it back.
  import { comboOf, DEFAULTS, saveShortcuts, shortcuts, show, type Action } from '../lib/shortcuts.svelte';

  type Line = { what: string; action?: Action; key?: string };
  const GROUPS: { head: string; lines: Line[] }[] = [
    { head: 'Rows, in Write', lines: [
      { what: 'Next / previous box', key: 'Tab / Shift+Tab' },
      { what: 'Row below', action: 'rowDown' },
      { what: 'Row above', action: 'rowUp' },
      { what: 'Add a row below', action: 'addBelow' },
      { what: 'Add a row above', action: 'addAbove' },
      { what: 'Move the row down', action: 'moveDown' },
      { what: 'Move the row up', action: 'moveUp' },
      { what: 'Delete the row', action: 'deleteRow' },
      { what: 'Bold, italic, underline, link', key: 'Ctrl+B, I, U, K' },
      { what: 'Find and replace', key: 'Ctrl+F' },
    ] },
    { head: 'Comments, in Review and Write', lines: [
      { what: 'Next comment', action: 'nextComment' },
      { what: 'Previous comment', action: 'prevComment' },
    ] },
    { head: 'Anywhere', lines: [
      { what: 'Save now', key: 'Ctrl+S' },
      { what: 'Pause / stop playing', key: 'Space / Esc' },
    ] },
  ];
  // Keys that can't be taken: the browser's or the app's own, or ones a text box needs.
  const TAKEN: Record<string, string> = {
    'Ctrl+B': 'bold', 'Ctrl+I': 'italic', 'Ctrl+U': 'underline', 'Ctrl+K': 'a link', 'Ctrl+F': 'Find and replace',
    'Ctrl+S': 'Save now', 'Ctrl+Z': 'undo', 'Ctrl+Y': 'redo', 'Ctrl+Shift+Z': 'redo', 'Ctrl+C': 'copy', 'Ctrl+V': 'paste',
    'Ctrl+X': 'cut', 'Ctrl+A': 'select all', 'Ctrl+P': 'print', 'Ctrl+W': "the browser's close tab", 'Ctrl+T': "the browser's new tab",
    'Ctrl+N': "the browser's new window", 'Ctrl+R': "the browser's reload", 'Ctrl+L': "the browser's address bar",
    'Ctrl+D': "the browser's bookmark", 'Ctrl+Shift+J': "the browser's developer tools", 'Ctrl+Shift+I': "the browser's developer tools",
    'Ctrl+Shift+Delete': "the browser's clear history", 'Alt+ArrowLeft': "the browser's back", 'Alt+ArrowRight': "the browser's forward",
  };
  const name = (action: Action) => GROUPS.flatMap((g) => g.lines).find((l) => l.action === action)!.what;

  let changing = $state<Action | null>(null);
  let message = $state('');

  function start(action: Action) {
    changing = changing === action ? null : action;
    message = '';
  }

  // While changing, the key pressed is the new key: nothing else on the page gets it.
  function press(e: KeyboardEvent, action: Action) {
    if (changing !== action) return;
    if (e.key === 'Tab') return void (changing = null);
    e.preventDefault();
    e.stopPropagation();
    if (e.key === 'Escape') return void ((changing = null), (message = ''));
    if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return;
    const combo = comboOf(e);
    if (!e.ctrlKey && !e.metaKey && !e.altKey) return void (message = 'Use Ctrl or Alt with it, so typing still works.');
    if (TAKEN[combo]) return void (message = `${show(combo)} is ${TAKEN[combo]}. Try another.`);
    const other = (Object.keys(DEFAULTS) as Action[]).find((a) => a !== action && shortcuts.key(a) === combo);
    if (other) return void (message = `${show(combo)} is already ${name(other)}. Try another.`);
    set(action, combo);
    changing = null;
    message = '';
  }

  function set(action: Action, combo: string) {
    const next = { ...shortcuts.changed };
    if (combo === DEFAULTS[action]) delete next[action];
    else next[action] = combo;
    shortcuts.changed = next;
    saveShortcuts();
  }
</script>

<h3 class="next">Keyboard shortcuts</h3>
{#each GROUPS as group (group.head)}
  <p class="group">{group.head}</p>
  {#each group.lines as line (line.what)}
    <div class="line">
      <span class="what">{line.what}</span>
      {#if line.action}
        {@const action = line.action}
        {#if shortcuts.changed[action]}
          <button class="reset" aria-label="Reset {line.what}" onclick={() => set(action, DEFAULTS[action])}>Reset</button>
        {/if}
        <button class="key" class:changing={changing === action} aria-label="{line.what}: {show(shortcuts.key(action))}. Change"
          title="Change" onclick={() => start(action)} onkeydown={(e) => press(e, action)} onblur={() => changing === action && (changing = null)}>
          {changing === action ? 'Press keys…' : show(shortcuts.key(action))}</button>
      {:else}
        <kbd>{line.key}</kbd>
      {/if}
    </div>
    {#if line.action && changing === line.action && message}<p class="message" role="status">{message}</p>{/if}
  {/each}
{/each}
<p class="hint">Click a key to change it. No key switches between Write, Review and History: that step is always a click.</p>

<style>
  h3 { margin: 24px 0 4px; font-size: 13px; font-weight: 600; color: var(--muted); }
  .group { margin: 14px 0 2px; font-size: 12px; font-weight: 600; color: var(--muted); }
  .line { display: flex; align-items: center; gap: 8px; min-height: 36px; border-bottom: 1px solid #f2f2f2; font-size: 14px; }
  .what { flex: 1; }
  kbd, .key { padding: 2px 8px; border: 1px solid #cfcfcf; border-bottom-width: 2px; border-radius: 5px; background: #fafafa;
    font-family: inherit; font-size: 12px; font-weight: 500; line-height: 18px; color: var(--ink); white-space: nowrap; }
  .key { min-height: 28px; cursor: pointer; }
  .key:hover { border-color: var(--accent); }
  .key.changing { border-color: var(--accent); background: #f2f5fd; color: var(--accent); }
  .reset { border: 0; background: none; padding: 4px; font-size: 12px; color: var(--accent); cursor: pointer; }
  .message { margin: 4px 0 0; font-size: 13px; color: #9a3412; }
  .hint { margin: 12px 0 0; font-size: 13px; line-height: 1.5; color: var(--muted); }
</style>
