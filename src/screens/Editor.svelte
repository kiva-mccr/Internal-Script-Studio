<script lang="ts">
  import { onDestroy, onMount, tick, untrack } from 'svelte';
  import { assetList, missingFiles } from '../lib/assets';
  import { Player, plan } from '../lib/play.svelte';
  import { clock, speaking } from '../lib/readtime.svelte';
  import { askAccess, hasAccess } from '../lib/remember';
  import { takesSpeed, VoiceOver } from '../lib/voice.svelte';
  import { findScript, readScript, writeScriptFile } from '../lib/folder';
  import { share } from '../lib/share';
  import { shareLink } from '../lib/route';
  import { frontValue, newId, parseScript, rows, setFrontValue, withAuthor, writeScript, type Block, type Script } from '../lib/script';
  import { othersEditing, readEditing, removeEditing, writeEditing } from '../lib/editing';
  import { addVersion, ancestor, heads, listVersions, officialNumber, OUTSIDE, reviewNote, sha256, type Version } from '../lib/history';
  import { merge, type Merged, type Side } from '../lib/merge';
  import Assets from './Assets.svelte';
  import Conflict from './Conflict.svelte';
  import Export, { type Format, type PrintChoices } from './Export.svelte';
  import Header, { type Loose } from './Header.svelte';
  import History from './History.svelte';
  import Planning from './Planning.svelte';
  import Print from './Print.svelte';
  import Teleprompter from './Teleprompter.svelte';
  import Review from './Review.svelte';
  import Write from './Write.svelte';
  import { addNote, flags, listNotes, threads, type Field, type Note } from '../lib/comments';

  // review: opened from a shared link, so it starts on the Review tab (RV-10).
  let { folder, path, name, review = false }: { folder: FileSystemDirectoryHandle; path: string[]; name: string; review?: boolean } =
    $props();

  const SAVE_AFTER = 1500; // ms after the last change
  const CHECK_EVERY = 5000; // ms between looks for someone else's save
  const ENTRY_EVERY = 5 * 60 * 1000; // a history entry at most every 5 minutes of editing (docs/studio-folder.md)
  const HERE_EVERY = 30 * 1000; // the "… is editing" file is refreshed this often

  let dir = $state<FileSystemDirectoryHandle | null>(null);
  let script = $state<Script | null>(null);
  let missing = $state(false);
  // saved: all written. waiting: changes not written yet. saving. failed: the last write failed (tried again).
  // conflict: two saves made at the same time, waiting for the person to pick (`clash`).
  // locked: the browser took back its OK to edit the folder; only a click (Allow editing) can ask again.
  let status = $state<'saved' | 'waiting' | 'saving' | 'failed' | 'conflict' | 'locked'>('saved');
  let notice = $state('');
  // The last delete, kept a few seconds so it can be undone (no browser dialogs: the user's rule).
  let undo = $state<{ blocks: Block[]; what: string } | null>(null);
  let undoTimer: ReturnType<typeof setTimeout> | undefined;
  let printing = $state<(PrintChoices & { version: string }) | null>(null); // the print version, while printing (EX-1)
  let exporting = $state<{ to: Format; version: string } | null>(null); // the export screen (EX-9), in place of the script
  let onDisk = ''; // the text of script.md as last read or written by this page
  let timer: ReturnType<typeof setTimeout> | undefined;
  let checker: ReturnType<typeof setInterval> | undefined;
  let mode = $state<'write' | 'review' | 'history' | 'assets'>(untrack(() => review) ? 'review' : 'write');
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
  // Flagged rows (AP-9), in row order; kept with the comments.
  const flagged = $derived(flags(notes, script ? rows(script).map((row) => row.id) : []));
  // What is still open, shown before Approve (RV-5, mock-up 20): flags, open comments and suggestions, then missing files.
  const loose = $derived.by(() => {
    const numbers = new Map(script ? rows(script).map((row, i) => [row.id, i + 1]) : []);
    const items: Loose[] = [...flagged.values()].map((f) => ({ id: `flag:${f.row}`, head: `Flag · ${f.who} · row ${numbers.get(f.row)}`, text: f.text || 'No note' }));
    items.push(...threads(notes).filter((t) => !t.resolved).map((t) => {
      const n = numbers.get(t.comment.row ?? '');
      const suggestion = t.comment.kind === 'suggestion';
      return { id: t.comment.id, head: `${suggestion ? 'Suggestion' : 'Comment'} · ${t.comment.who} · ${n ? `row ${n}` : 'a deleted row'}`,
        text: suggestion ? `“${t.comment.replace}”` : t.comment.text ?? '' };
    }));
    const lost = lostFiles.size;
    if (lost) items.push({ id: '', head: `${lost} ${lost === 1 ? 'file' : 'files'} missing`, text: [...lostFiles].map((f) => f.split('/').pop()).join(', ') });
    return items;
  });
  let last: Version | null = null; // the newest history entry this page knows of
  let started: Promise<void> = Promise.resolve(); // History found or started on opening (sets `last`)
  let pendingSince = 0; // when the first save not yet in History was made
  let clash = $state<{
    merged: Merged; heading: string; mineLabel: string; theirsLabel: string; combined: string;
    parents: string[]; note: string; copy?: string;
  } | null>(null);
  let editors = $state<string[]>([]); // other people with this script open
  // Voice-over takes (AU-1): read with the script and with the 5 s check, so others' takes appear.
  const voice = new VoiceOver();
  // The top bar's length (AP-12): "1 of 6 · 0:04/13:42", the takes so far and the whole script (takes, plus read
  // time for rows with none, as Play times it). With no take yet, only the whole: "13:42".
  const taken = $derived(script ? rows(script).filter((row) => voice.takes[row.id]) : []);
  const voiceText = $derived.by(() => {
    if (!script) return '';
    const steps = plan(script, voice.takes, speaking.wpm);
    const total = steps.reduce((sum, step) => sum + step.seconds, 0);
    if (!taken.length) return total ? clock(total) : '';
    const seconds = taken.reduce((sum, row) => sum + voice.takes[row.id].seconds, 0);
    return `${taken.length} of ${rows(script).length} · ${clock(seconds)}/${clock(total)}`; // short, so the bar stays on one line (AP-16)
  });
  // Play the script (AU-2): the rows in order with their takes. Only in Write, and only once a row has a take.
  const player = new Player();
  const canPlay = $derived(mode === 'write' && !clash && taken.length > 0);
  $effect(() => {
    if (!canPlay || voice.recording || voice.playing) untrack(() => player.stop());
  });
  // From the top, from a row (its number in Write), or pause and carry on. Rows with no take last their read time
  // at the speaking speed (Settings, shared with the teleprompter).
  function play(from?: string) {
    if (!script || !dir) return;
    if (from === undefined && player.started) return player.toggle();
    voice.stopPlaying();
    const steps = plan(script, voice.takes, speaking.wpm);
    player.start(dir, steps, from === undefined ? 0 : Math.max(0, steps.findIndex((s) => s.id === from)));
  }
  // Space pauses and Esc stops, unless you are typing (Space on a button is that button's).
  function playKeys(event: KeyboardEvent) {
    const el = event.target as HTMLElement;
    if (!player.started || el.closest?.('input, textarea, select')) return;
    if (event.key === 'Escape') player.stop();
    else if (event.key === ' ' && !el.closest?.('button, a')) {
      event.preventDefault();
      player.toggle();
    }
  }
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
      started = startHistory(dir, text);
      await started;
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
    player.stop();
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
    await started; // an edit made just after opening waits for History to start, or it gets no entry
    if (!dir || !last) return;
    if ((await sha256(text)) === last.sha256) return;
    pendingSince ||= Date.now();
    if (!now && Date.now() - pendingSince < ENTRY_EVERY) return;
    last = await addVersion(dir, { parents: [last.id], who: name, kind: 'edit', text });
    pendingSince = 0;
  }

  // Leaving the script (or opening History): save what is waiting and put it in History.
  async function leave() {
    await changingStatus;
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

  // Flags a row with a note (AP-9), or clears its flag (null).
  const flag = (row: string, text: string | null) => note(text === null ? { kind: 'unflag', row } : { kind: 'flag', row, text });

  // A comment, reply, resolve or reopen, in this person's name. Returns false if it couldn't be written.
  // `files` are new files attached to it (RV-11).
  async function note(entry: Omit<Note, 'v' | 'id' | 'when' | 'who'>, files: File[] = []): Promise<boolean> {
    if (!dir) return false;
    try {
      await addNote(dir, { ...entry, who: name }, undefined, files);
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
  // The note sent with it for review (RV-8): read from History when Review opens while it is in review.
  let sent = $state<Version>();
  $effect(() => {
    if (mode !== 'review' || reviewStatus !== 'in review' || !dir) return void (sent = undefined);
    listVersions(dir).then((versions) => (sent = reviewNote(versions))).catch(() => {});
  });
  // A status change in progress: leaving waits for its History entry, or a quick switch of tab made a second entry
  // ("Changed the status") beside it.
  let changingStatus: Promise<void> = Promise.resolve();
  async function setStatus(to: 'draft' | 'in review' | 'approved', note: string, message = '') {
    if (!dir || !script) return;
    await leave();
    await (changingStatus = changeStatus(dir, script, to, note, message));
  }
  async function changeStatus(dir: FileSystemDirectoryHandle, script: Script, to: string, note: string, message: string) {
    script.front = setFrontValue(script.front, 'status', to);
    await save();
    if (status !== 'saved') return; // a clash or a failed save: shown already
    try {
      last = await addVersion(dir, { parents: last ? [last.id] : [], who: name, kind: 'review', text: onDisk, note, message });
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
    if (status === 'conflict' || status === 'locked') return; // kept in the page, saved once that is settled
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
      script.front = withAuthor($state.snapshot(script) as Script, name).front;
      // An empty section isn't written; Write removes it from the page once the cursor leaves it (AP-22).
      const kept = $state.snapshot(script) as Script;
      kept.blocks = kept.blocks.filter((b) => b.type === 'row' || b.title.trim() || b.note);
      const text = writeScript(kept);
      if (text !== now) await writeScriptFile(dir, text);
      onDisk = text;
      lastWritten = await sha256(text);
      await record(text, false).catch(() => {});
      here();
      // Edits typed while saving start another save.
      if (status === 'saving') status = 'saved';
    } catch {
      // Retrying can't bring back a lost OK (the browser asks only from a click), so that waits for Allow editing.
      if (!(await hasAccess(folder).catch(() => true))) return void (status = 'locked');
      status = 'failed';
      timer = setTimeout(save, SAVE_AFTER * 4);
    }
  }

  // Chrome and Edge take back the OK to edit the folder after the tab has been in the background a while. Checked
  // with the 5 s check and on coming back to the tab, so it shows before a save fails.
  async function checkAccess(): Promise<boolean> {
    if (status === 'locked') return false;
    if (await hasAccess(folder).catch(() => true)) return true;
    clearTimeout(timer);
    status = 'locked';
    return false;
  }

  // Allow editing (from a click): the browser asks, then what is in the page is saved.
  async function allow() {
    if (!(await askAccess(folder).catch(() => false))) return;
    status = 'waiting';
    await save();
  }

  async function checkFiles() {
    if (!dir || !script) return;
    const lost = await missingFiles(dir, assetList(script)).catch(() => lostFiles);
    if ([...lost].join('\n') !== [...lostFiles].join('\n')) lostFiles = lost;
  }

  // From the list before Approve (RV-5): to that comment in Review, or to the Assets tab for missing files.
  async function showLoose(id: string) {
    if (!id) return (mode = 'assets'), checkFiles();
    if (id.startsWith('flag:')) {
      mode = 'write';
      await tick();
      const row = document.querySelector(`[data-row="${id.slice(5)}"]`);
      row?.scrollIntoView({ block: 'center' });
      return row?.querySelector<HTMLElement>('.flag-note input')?.focus({ preventScroll: true });
    }
    const card = document.querySelector<HTMLElement>(`article[data-id="${id}"]`);
    card?.scrollIntoView({ block: 'center' });
    card?.click(); // marks it, and its quote, as the one being read
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
    if (!dir || document.hidden || !(await checkAccess())) return;
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

  // Export (EX-9): saves what is waiting, then opens the export screen on that format, in place of the script.
  async function openExport(to: Format) {
    if (!script) return;
    player.stop();
    exporting = { to, version: await version() };
  }

  // Copy for Teams (EX-10): saves what is waiting, then the script's facts as a short message (lib/share.ts).
  async function shareNow() {
    if (!script) throw new Error('No script');
    const v = await version();
    const newest = dir ? (await listVersions(dir).catch(() => [])).at(-1) : undefined;
    const who = newest && newest.who !== OUTSIDE ? newest.who : '';
    const voiced = script.blocks.filter((b) => b.type === 'row' && voice.takes[b.id]).length;
    return share({ title: title ?? '', link: shareLink(location.href), status: reviewStatus, version: v, who, when: newest ? Date.parse(newest.when) : 0,
      open: openCount, voice: voiced }, script);
  }

  // Leaving saves what is waiting. Only a failed save or a lost OK, which would lose work, asks the browser to hold the page.
  function beforeUnload(event: BeforeUnloadEvent) {
    leave();
    if (status === 'failed' || status === 'locked') event.preventDefault();
  }
</script>

<svelte:window onbeforeunload={beforeUnload} onafterprint={() => (printing = null)} onkeydown={playKeys} />
<svelte:document onvisibilitychange={() => (document.hidden ? status === 'waiting' && save() : checkOutside())} />

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

{#if exporting && script && dir}
  <Export {script} {dir} folder={folder.name} title={title ?? ''} version={exporting.version} start={exporting.to} onPrint={print} onBack={() => (exporting = null)} />
{:else}
<Header folder={folder.name} title={title ?? ''} ready={!!script} {mode} {openCount} {loose} missingCount={lostFiles.size} {voiceText} voiceWpm={takesSpeed(voice.takes)} {editors} {reviewStatus} {status}
  play={canPlay ? { time: player.started ? `${clock(player.time)} / ${clock(player.total)}` : '', on: player.on } : null} onPlay={() => play()} onStop={() => player.stop()}
  onMode={(to) => (to === 'review' ? showReview() : to === 'history' ? showHistory() : to === 'assets' ? ((mode = 'assets'), checkFiles()) : (mode = 'write'))}
  onAllow={allow} onStatus={setStatus} onLoose={showLoose} onExport={openExport} onShare={shareNow} onPrompt={() => (status === 'waiting' && save(), player.stop(), (prompting = true))} />

<div class="page">
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
    <Review {dir} {script} {notes} {flagged} me={name} {sent} onAdd={note} onApply={apply} />
  {:else if script && dir && mode === 'assets'}
    <Assets {script} {dir} missing={lostFiles} onJump={jump} onNotice={(m) => (notice = m)} />
  {:else if script && dir && mode === 'history'}
    <History {dir} onRestore={restore} onPublish={publish} />
  {:else if script && dir}
    <Write bind:script {dir} {voice} {player} canPlay={canPlay} onPlayFrom={play} {name} {flagged} onFlag={flag} onChange={changed} onDeleted={deleted} onNotice={(m) => (notice = m)} />
  {/if}
</main>
{#if script && dir && !clash && (mode === 'write' || mode === 'review')}
  <Planning {dir} />
{/if}
</div>
{/if}
<style>
  .toasts { position: fixed; z-index: 10; left: 50%; bottom: 24px; transform: translateX(-50%); width: min(720px, calc(100% - 32px));
    display: flex; flex-direction: column; gap: 8px; }
  .banner { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; padding: 10px 16px; border-radius: 10px;
    background: #fff7ed; border: 1px solid #f5d9b5; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08); }
  .banner.quiet { background: var(--ground); border-color: var(--line); }
  .banner p { margin: 0; flex: 1 1 300px; font-size: 14px; }
  .page { display: flex; }
  main { flex: 1; max-width: 1180px; margin: 0 auto; padding: 32px 16px 64px; }
  .empty { text-align: center; padding-top: 10vh; }
  .empty h1 { margin: 0 0 8px; font-size: 22px; font-weight: 600; }
  .empty p { margin: 0 auto 12px; max-width: 460px; color: var(--muted); line-height: 1.5; }
</style>
