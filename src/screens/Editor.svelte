<script lang="ts">
  import { onDestroy, onMount, tick, untrack } from 'svelte';
  import { assetList, missingFiles } from '../lib/assets';
  import { clock } from '../lib/readtime';
  import { VoiceOver } from '../lib/voice.svelte';
  import { findScript, readScript, safeName, writeScriptFile } from '../lib/folder';
  import { toFdx } from '../lib/fdx';
  import { toFountain } from '../lib/fountain';
  import { frontValue, newId, parseScript, rows, setFrontValue, withAuthor, writeScript, type Block, type Script } from '../lib/script';
  import { othersEditing, readEditing, removeEditing, writeEditing } from '../lib/editing';
  import { addVersion, ancestor, heads, listVersions, officialNumber, OUTSIDE, sha256, type Version } from '../lib/history';
  import { merge, type Merged, type Side } from '../lib/merge';
  import Assets from './Assets.svelte';
  import Conflict from './Conflict.svelte';
  import Header, { type PrintChoices } from './Header.svelte';
  import History from './History.svelte';
  import Print from './Print.svelte';
  import Teleprompter from './Teleprompter.svelte';
  import Review from './Review.svelte';
  import Write from './Write.svelte';
  import { addNote, listNotes, threads, type Field, type Note } from '../lib/comments';

  let { folder, path, name }: { folder: FileSystemDirectoryHandle; path: string[]; name: string } = $props();

  const SAVE_AFTER = 1500; // ms after the last change
  const CHECK_EVERY = 5000; // ms between looks for someone else's save
  const ENTRY_EVERY = 5 * 60 * 1000; // a history entry at most every 5 minutes of editing (docs/studio-folder.md)
  const HERE_EVERY = 30 * 1000; // the "… is editing" file is refreshed this often

  let dir = $state<FileSystemDirectoryHandle | null>(null);
  let script = $state<Script | null>(null);
  let missing = $state(false);
  // saved: all written. waiting: changes not written yet. saving. failed: the last write failed.
  // conflict: two saves made at the same time, waiting for the person to pick (`clash`).
  let status = $state<'saved' | 'waiting' | 'saving' | 'failed' | 'conflict'>('saved');
  let notice = $state('');
  // The last delete, kept a few seconds so it can be undone (no browser dialogs: the user's rule).
  let undo = $state<{ blocks: Block[]; what: string } | null>(null);
  let undoTimer: ReturnType<typeof setTimeout> | undefined;
  let printing = $state<(PrintChoices & { version: string }) | null>(null); // the print version, while printing (EX-1)
  let onDisk = ''; // the text of script.md as last read or written by this page
  let timer: ReturnType<typeof setTimeout> | undefined;
  let checker: ReturnType<typeof setInterval> | undefined;
  let mode = $state<'write' | 'review' | 'history' | 'assets'>('write');
  // The Files column's paths that aren't in the folder (EX-6): the Assets tab's count and list. Checked again when
  // the files change, when the tab opens and with the 5 s check, since OneDrive may bring a file in at any time.
  let lostFiles = $state<Set<string>>(new Set());
  const fileLines = $derived(script ? JSON.stringify(script.blocks.flatMap((b) => (b.type === 'row' ? b.files : []))) : '');
  $effect(() => {
    if (fileLines) untrack(checkFiles);
  });
  let prompting = $state(false); // the teleprompter is open (EX-2)
  let notes = $state<Note[]>([]); // comments, replies and resolves (Review)
  const openCount = $derived(threads(notes).filter((t) => !t.resolved).length);
  let last: Version | null = null; // the newest history entry this page knows of
  let pendingSince = 0; // when the first save not yet in History was made
  let clash = $state<{
    merged: Merged; heading: string; mineLabel: string; theirsLabel: string; combined: string;
    parents: string[]; note: string; copy?: string;
  } | null>(null);
  let editors = $state<string[]>([]); // other people with this script open
  // Voice-over takes (AU-1): read with the script and with the 5 s check, so others' takes appear.
  const voice = new VoiceOver();
  const voiceText = $derived.by(() => {
    if (!script) return '';
    const rowsNow = script.blocks.filter((b) => b.type === 'row');
    const taken = rowsNow.filter((b) => voice.takes[b.id]);
    if (!taken.length) return '';
    const seconds = taken.reduce((sum, b) => sum + voice.takes[b.id].seconds, 0);
    return `Voice-over ${taken.length} of ${rowsNow.length} rows · ${clock(seconds)}`;
  });
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  const since = new Date().toISOString();
  let lastWritten = ''; // fingerprint of what this page last wrote to script.md

  const title = $derived(script ? frontValue(script.front, 'title') || path.at(-1) : path.at(-1));

  onMount(async () => {
    try {
      dir = await findScript(folder, path);
      if (!dir) {
        missing = true;
        return;
      }
      const text = await readScript(dir);
      load(text);
      await startHistory(dir, text);
      await here();
      await lookForClashes(dir, text);
      notes = await listNotes(dir).catch(() => []);
      await voice.load(dir);
      checker = setInterval(checkOutside, CHECK_EVERY);
      heartbeat = setInterval(here, HERE_EVERY);
    } catch {
      notice = "The script couldn't be opened. If OneDrive is still syncing, wait a moment and reload.";
    }
  });

  onDestroy(() => {
    voice.stopPlaying();
    clearInterval(checker);
    clearInterval(heartbeat);
    const d = dir;
    leave().finally(() => d && removeEditing(d, name));
  });

  // "… is editing": this person's file, with when they were last here and what they last wrote.
  async function here() {
    if (!dir) return;
    const now = new Date().toISOString();
    await writeEditing(dir, { v: 1, who: name, since, seen: now, last_written: lastWritten }).catch(() => {});
  }

  // On opening: the newest version should match script.md. If not, it was changed outside the app (Notepad, a
  // laptop that closed before its entry was written), and that gets its own entry. No versions: History starts.
  async function startHistory(dir: FileSystemDirectoryHandle, text: string) {
    try {
      const versions = await listVersions(dir);
      const newest = versions.at(-1);
      const sha = await sha256(text);
      const matching = heads(versions).findLast((v) => v.sha256 === sha);
      if (!newest) last = await addVersion(dir, { parents: [], who: name, kind: 'restart', text });
      else if (matching) last = matching;
      else {
        // Someone's last save that never got its entry (their laptop closed): credit it to them.
        const writer = (await readEditing(dir)).find((e) => e.last_written === sha)?.who;
        last = writer
          ? await addVersion(dir, { parents: [newest.id], who: writer, kind: 'edit', text })
          : await addVersion(dir, { parents: [newest.id], who: OUTSIDE, kind: 'outside', text });
      }
    } catch {
      // History can't be written (read-only folder?): editing still works.
    }
  }

  // On opening: two saves made at the same time show up as two newest versions, or as a copy OneDrive kept
  // beside script.md (script-LAPTOP-SAM.md). Either way, the two are combined row by row.
  async function lookForClashes(dir: FileSystemDirectoryHandle, text: string) {
    try {
      for await (const name of dir.keys()) {
        if (!/^script-.+\.md$/i.test(name)) continue;
        const copy = await (await (await dir.getFileHandle(name)).getFile()).text();
        const base = last?.text ?? text;
        return offer(merge(base, text, copy), {
          heading: 'OneDrive kept two copies of this script', mineLabel: 'script.md', theirsLabel: name,
          mineName: 'script.md', theirsName: name, parents: last ? [last.id] : [], copy: name,
        });
      }
      const versions = await listVersions(dir);
      const tips = heads(versions);
      if (tips.length < 2) return;
      const sha = await sha256(text);
      const a = tips.findLast((v) => v.sha256 === sha) ?? tips.at(-1)!;
      const b = tips.filter((v) => v !== a).at(-1)!;
      const base = ancestor(versions, a, b);
      const [aName, bName] = [person(a.who), person(b.who)];
      offer(merge(base?.text ?? '', a.text, b.text), {
        heading: `${cap(bName)} and ${aName} both saved at the same time`,
        mineLabel: label(a.who), theirsLabel: label(b.who), mineName: aName, theirsName: bName, parents: [a.id, b.id],
      });
    } catch {
      // Can't be read yet (mid-sync): looked at again next time the script opens.
    }
  }

  // Shows a combination of two saves, or saves it straight away when nothing clashes.
  async function offer(
    merged: Merged,
    o: { heading: string; mineLabel: string; theirsLabel: string; mineName: string; theirsName: string; parents: string[]; copy?: string },
  ) {
    const note = `Combined ${o.theirsName === OUTSIDE ? 'two saves' : `${o.theirsName}’s and ${o.mineName === 'you' ? 'your' : `${o.mineName}’s`} changes`}`;
    if (!merged.clashes.length) return combine(merged.text({}), o.parents, note, o.copy);
    const parts = [
      ...merged.onlyTheirs.map((n) => `row ${n} (only ${o.theirsName} changed it)`),
      ...merged.onlyMine.map((n) => `row ${n} (only ${o.mineName} changed it)`),
    ];
    clash = {
      merged, heading: o.heading, mineLabel: o.mineLabel, theirsLabel: o.theirsLabel, parents: o.parents, note, copy: o.copy,
      combined: parts.length ? `Also combined: ${parts.join(', ')}.` : '',
    };
    status = 'conflict';
  }

  // Writes the combined script and its "merge" entry, with both saves as parents.
  async function combine(text: string, parents: string[], note: string, copy?: string) {
    if (!dir) return;
    try {
      await writeScriptFile(dir, text);
      lastWritten = await sha256(text);
      last = await addVersion(dir, { parents, who: name, kind: 'merge', text, note });
      if (copy) await dir.removeEntry(copy).catch(() => {}); // deleted only once its merge is saved
      pendingSince = 0;
      clash = null;
      load(text);
      await here();
    } catch {
      notice = "The combined script couldn't be saved. If OneDrive is still syncing, wait a moment and try again.";
    }
  }

  function resolve(picks: Record<string, Side>) {
    if (clash) combine(clash.merged.text(picks), clash.parents, clash.note, clash.copy);
  }

  const person = (who: string) => (who === name ? 'you' : who);
  const label = (who: string) => (who === name ? 'Yours' : `${who}’s`);
  const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

  // After someone else's change is shown: follow their newest version, if it has synced.
  async function followHistory(text: string) {
    if (!dir) return;
    const newest = (await listVersions(dir).catch(() => [])).at(-1);
    if (newest && newest.sha256 === (await sha256(text))) last = newest;
  }

  // A history entry for what was saved: at most every 5 minutes of editing, or now when `now` is set.
  async function record(text: string, now: boolean) {
    if (!dir || !last) return;
    if ((await sha256(text)) === last.sha256) return;
    pendingSince ||= Date.now();
    if (!now && Date.now() - pendingSince < ENTRY_EVERY) return;
    last = await addVersion(dir, { parents: [last.id], who: name, kind: 'edit', text });
    pendingSince = 0;
  }

  // Leaving the script (or opening History): save what is waiting and put it in History.
  async function leave() {
    if (status === 'waiting') await save();
    if (status === 'saved' && onDisk) await record(onDisk, true).catch(() => {});
  }

  async function showHistory() {
    await leave();
    mode = 'history';
  }

  async function restore(version: Version) {
    if (!dir) return;
    try {
      await leave();
      await writeScriptFile(dir, version.text);
      const when = new Date(version.when).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
      last = await addVersion(dir, {
        parents: last ? [last.id] : [], who: name, kind: 'restore', text: version.text,
        note: `Restored the version from ${when.replace(' AM', ' am').replace(' PM', ' pm')}`,
      });
      pendingSince = 0;
      undo = null;
      load(version.text);
      mode = 'write';
    } catch {
      notice = "That version couldn't be restored. If OneDrive is still syncing, wait a moment and try again.";
    }
  }

  // An official version: the script as it is now, named. Returns null if it couldn't be written.
  async function publish(official: string): Promise<Version | null> {
    if (!dir) return null;
    try {
      await leave();
      const text = await readScript(dir);
      last = await addVersion(dir, { parents: last ? [last.id] : [], who: name, kind: 'official', text, note: official });
      pendingSince = 0;
      return last;
    } catch {
      notice = "The official version couldn't be published. If OneDrive is still syncing, wait a moment and try again.";
      return null;
    }
  }

  // A comment, reply, resolve or reopen, in this person's name. Returns false if it couldn't be written.
  async function note(entry: Omit<Note, 'v' | 'id' | 'when' | 'who'>): Promise<boolean> {
    if (!dir) return false;
    try {
      await addNote(dir, { ...entry, who: name });
      notes = await listNotes(dir);
      return true;
    } catch {
      notice = "That couldn't be saved. If OneDrive is still syncing, wait a moment and try again.";
      return false;
    }
  }

  // An accepted suggestion (or its Undo): `from` becomes `to` in the row's field, then saved as usual.
  function apply(row: string, field: Field, from: string, to: string): boolean {
    const block = script?.blocks.find((b) => b.type === 'row' && b.id === row);
    if (!block || block.type !== 'row' || field === 'files') return false;
    const key = field === 'on_screen' ? 'onScreen' : 'dialogue';
    if (!from || !block[key].includes(from)) {
      notice = 'That text has changed since the suggestion was made. Change it in Write instead.';
      return false;
    }
    block[key] = block[key].replace(from, to);
    changed();
    return true;
  }

  // Review status (RV-3): draft → in review → approved, or sent back to draft. Saved at once, with a History entry.
  const reviewStatus = $derived(script ? frontValue(script.front, 'status') || 'draft' : 'draft');
  async function setStatus(to: 'draft' | 'in review' | 'approved', note: string) {
    if (!dir || !script) return;
    await leave();
    script.front = setFrontValue(script.front, 'status', to);
    await save();
    if (status !== 'saved') return; // a clash or a failed save: shown already
    try {
      last = await addVersion(dir, { parents: last ? [last.id] : [], who: name, kind: 'review', text: onDisk, note });
      pendingSince = 0;
    } catch {
      // History can't be written: the status itself is saved.
    }
  }

  async function showReview() {
    await leave();
    mode = 'review';
  }

  function load(text: string) {
    const parsed = parseScript(text);
    // Ids are given now, not on save, so a row keeps the same id from its first save on.
    const used = new Set(rows(parsed).map((row) => row.id));
    for (const row of rows(parsed)) if (!row.id) used.add((row.id = newId(used)));
    script = parsed;
    onDisk = text;
    status = 'saved';
  }

  function changed() {
    if (status === 'conflict') return;
    status = 'waiting';
    clearTimeout(timer);
    timer = setTimeout(save, SAVE_AFTER);
  }

  async function save() {
    if (!dir || !script) return;
    clearTimeout(timer);
    status = 'saving';
    try {
      const now = await readScript(dir);
      if (now !== onDisk) {
        // Someone else saved while you were typing: combine the two, row by row.
        const mine = writeScript(withAuthor($state.snapshot(script) as Script, name));
        const newest = (await listVersions(dir)).at(-1);
        const theirsSynced = newest && newest.sha256 === (await sha256(now)) && newest.id !== last?.id;
        const who = editors[0] ?? (theirsSynced && newest.who !== name ? newest.who : 'Someone else');
        await offer(merge(onDisk, mine, now), {
          heading: `${who} and you both saved at the same time`, mineLabel: 'Yours', theirsLabel: label(who),
          mineName: 'you', theirsName: who,
          parents: [...(last ? [last.id] : []), ...(theirsSynced ? [newest.id] : [])],
        });
        return;
      }
      script.blocks = script.blocks.filter((b) => b.type === 'row' || b.title.trim() || b.note);
      script.front = withAuthor($state.snapshot(script) as Script, name).front;
      const text = writeScript($state.snapshot(script) as Script);
      if (text !== now) await writeScriptFile(dir, text);
      onDisk = text;
      lastWritten = await sha256(text);
      await record(text, false).catch(() => {});
      here();
      // Edits typed while saving start another save.
      if (status === 'saving') status = 'saved';
    } catch {
      status = 'failed';
      timer = setTimeout(save, SAVE_AFTER * 4);
    }
  }

  async function checkFiles() {
    if (!dir || !script) return;
    const lost = await missingFiles(dir, assetList(script)).catch(() => lostFiles);
    if ([...lost].join('\n') !== [...lostFiles].join('\n')) lostFiles = lost;
  }

  // From the Assets tab: back to Write, at that row.
  async function jump(row: number) {
    mode = 'write';
    await tick();
    const field = document.querySelector<HTMLElement>(`[aria-label="Dialogue, row ${row}"]`);
    field?.scrollIntoView({ block: 'center' });
    field?.focus({ preventScroll: true });
  }

  // Someone else saved (OneDrive brought their change): with nothing of yours waiting, show it quietly.
  async function checkOutside() {
    if (!dir || document.hidden) return;
    checkFiles();
    if (!voice.recording) voice.load(dir);
    editors = othersEditing(await readEditing(dir).catch(() => []), name);
    notes = await listNotes(dir).catch(() => notes);
    if (status !== 'saved') return;
    try {
      const now = await readScript(dir);
      if (now !== onDisk && status === 'saved') {
        load(now);
        await followHistory(now);
      }
    } catch {
      // Mid-sync: try again next time.
    }
  }

  // A row or section was deleted in Write: kept a few seconds so it can be undone.
  function deleted(blocks: Block[], what: string) {
    undo = { blocks, what };
    clearTimeout(undoTimer);
    undoTimer = setTimeout(() => (undo = null), 10000);
  }

  function undoDelete() {
    if (!script || !undo) return;
    script.blocks = undo.blocks;
    undo = null;
    changed();
  }

  // Print (EX-1): saves what is waiting, then shows the print version and opens the browser's print window once its
  // images and equations are in. The version is "v3" only while the script is still that official version.
  async function print(choices: PrintChoices) {
    if (!script || !dir || printing) return;
    printing = { ...choices, version: await version() };
  }

  // Saves what is waiting, then names the version the script is: "v3" while it is still that official version, ''
  // for a draft. Print and the exports carry it (EX-7).
  async function version(): Promise<string> {
    if (status === 'waiting') await save();
    const versions = dir ? await listVersions(dir).catch(() => []) : [];
    const n = officialNumber(versions, await sha256(onDisk));
    return n ? `v${n}` : '';
  }

  // Export: the script as a Fountain (EX-3) or Final Draft (EX-4) file, downloaded.
  async function exportAs(to: 'fountain' | 'fdx') {
    if (!script) return;
    const v = await version();
    const state = reviewStatus === 'draft' ? '' : reviewStatus[0].toUpperCase() + reviewStatus.slice(1);
    const stand = [v || 'Draft', state].filter(Boolean).join(' · ');
    const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const text = (to === 'fdx' ? toFdx : toFountain)(script, title ?? '', stand, date);
    download(`${safeName(title ?? '') || 'script'}.${to}`, text);
  }

  function download(name: string, text: string) {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: name });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  // Leaving saves what is waiting. Only a failed save, which would lose work, asks the browser to hold the page.
  function beforeUnload(event: BeforeUnloadEvent) {
    leave();
    if (status === 'failed') event.preventDefault();
  }
</script>

<svelte:window onbeforeunload={beforeUnload} onafterprint={() => (printing = null)} />
<svelte:document onvisibilitychange={() => document.hidden && status === 'waiting' && save()} />

<Header folder={folder.name} title={title ?? ''} ready={!!script} {mode} {openCount} missingCount={lostFiles.size} {voiceText} {editors} {reviewStatus} {status}
  onMode={(to) => (to === 'review' ? showReview() : to === 'history' ? showHistory() : to === 'assets' ? ((mode = 'assets'), checkFiles()) : (mode = 'write'))}
  onStatus={setStatus} onPrint={print} onExport={exportAs} onPrompt={() => (status === 'waiting' && save(), (prompting = true))} />

{#if prompting && script}
  <Teleprompter {script} onClose={() => (prompting = false)} />
{/if}

{#if printing && script && dir}
  <Print {script} {dir} title={title ?? ''} version={printing.version} column={printing.column} lines={printing.lines} scale={printing.scale / 100} onReady={() => window.print()} />
{/if}

<!-- Messages sit at the bottom of the window, so they are seen wherever you have scrolled to. -->
<div class="toasts">
  {#if undo}
    <div class="banner quiet" aria-live="polite">
      <p>{undo.what}</p>
      <button class="outline" onclick={undoDelete}>Undo</button>
    </div>
  {/if}
  {#if notice}
    <div class="banner" role="alert">
      <p>{notice}</p>
      <button class="link" onclick={() => (notice = '')}>OK</button>
    </div>
  {/if}
</div>

<main>
  {#if missing}
    <div class="empty">
      <h1>No script called "{path.join(' / ')}"</h1>
      <p>It isn't in {folder.name}. It may have been renamed, or OneDrive may still be bringing it to this computer.</p>
      <p><a href="#/">Back to the list</a></p>
    </div>
  {:else if clash}
    <Conflict clashes={clash.merged.clashes} heading={clash.heading} mineLabel={clash.mineLabel}
      theirsLabel={clash.theirsLabel} combined={clash.combined} onSave={resolve} />
  {:else if script && dir && mode === 'review'}
    <Review {script} {notes} onAdd={note} onApply={apply} />
  {:else if script && dir && mode === 'assets'}
    <Assets {script} {dir} missing={lostFiles} onJump={jump} onNotice={(m) => (notice = m)} />
  {:else if script && dir && mode === 'history'}
    <History {dir} onRestore={restore} onPublish={publish} />
  {:else if script && dir}
    <Write bind:script {dir} {voice} {name} onChange={changed} onDeleted={deleted} onNotice={(m) => (notice = m)} />
  {/if}
</main>
<style>
  .toasts { position: fixed; z-index: 10; left: 50%; bottom: 24px; transform: translateX(-50%); width: min(720px, calc(100% - 32px));
    display: flex; flex-direction: column; gap: 8px; }
  .banner { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; padding: 10px 16px; border-radius: 10px;
    background: #fff7ed; border: 1px solid #f5d9b5; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08); }
  .banner.quiet { background: var(--ground); border-color: var(--line); }
  .banner p { margin: 0; flex: 1 1 300px; font-size: 14px; }
  main { max-width: 1180px; margin: 0 auto; padding: 32px 16px 64px; }
  .empty { text-align: center; padding-top: 10vh; }
  .empty h1 { margin: 0 0 8px; font-size: 22px; font-weight: 600; }
  .empty p { margin: 0 auto 12px; max-width: 460px; color: var(--muted); line-height: 1.5; }
</style>
