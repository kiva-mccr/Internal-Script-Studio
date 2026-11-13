<script lang="ts">
  import { onDestroy, onMount, tick, untrack } from 'svelte';
  import { assetList, missingFiles } from '../lib/assets';
  import { Player, plan } from '../lib/play.svelte';
  import { clock, speaking } from '../lib/readtime.svelte';
  import { keep, recall } from '../lib/remember';
  import { takeLength, takesSpeed, VoiceOver } from '../lib/voice.svelte';
  import { addAsset, assetFile } from '../lib/folder';
  import { share } from '../lib/share';
  import { shareLink } from '../lib/route';
  import { frontValue, rows, type Block } from '../lib/script';
  import { removeEditing } from '../lib/editing';
  import { backNote, listVersions, OUTSIDE, reviewEnd, reviewNote, type Version } from '../lib/history';
  import { Saving } from '../lib/saving.svelte';
  import Assets from './Assets.svelte';
  import Comments from './Comments.svelte';
  import Conflict from './Conflict.svelte';
  import Credits from './Credits.svelte';
  import { shownCredits } from '../lib/people';
  import Export, { type Format, type PrintChoices } from './Export.svelte';
  import Header, { type Loose } from './Header.svelte';
  import History from './History.svelte';
  import Planning from './Planning.svelte';
  import Print from './Print.svelte';
  import Teleprompter from './Teleprompter.svelte';
  import Review from './Review.svelte';
  import Tour from './Tour.svelte';
  import Write from './Write.svelte';
  import VisitBar from './VisitBar.svelte';
  import { sinceVisit, visitKey, type Marks, type Visit } from '../lib/visit';
  import { addNote, flags, listNotes, threads, type Attachment, type Field, type Note } from '../lib/comments';

  // review: opened from a shared link, so it starts on the Review tab (RV-10). tour: in the example only, the guided
  // tour (AP-34), a count that goes up when Take the tour is clicked.
  let { folder, path, name, review = false, tour }: { folder: FileSystemDirectoryHandle; path: string[]; name: string; review?: boolean; tour?: number } =
    $props();

  const CHECK_EVERY = 5000; // ms between looks for someone else's save
  const HERE_EVERY = 30 * 1000; // the "… is editing" file is refreshed this often

  // The script on disk: reading, saving, History and clashes (lib/saving.svelte.ts).
  const file = new Saving(untrack(() => folder), () => name, (message) => (notice = message), () => readReview());
  const dir = $derived(file.dir);
  const script = $derived(file.script);
  const status = $derived(file.status);
  const clash = $derived(file.clash);
  const changed = () => file.changed();
  const save = () => file.save();
  let missing = $state(false);
  let notice = $state('');
  // The last delete, kept a few seconds so it can be undone (no browser dialogs: the user's rule).
  let undo = $state<{ blocks: Block[]; what: string } | null>(null);
  let undoTimer: ReturnType<typeof setTimeout> | undefined;
  let printing = $state<(PrintChoices & { version: string }) | null>(null); // the print version, while printing (EX-1)
  let exporting = $state<{ to: Format; version: string } | null>(null); // the export screen (EX-9), in place of the script
  let checker: ReturnType<typeof setInterval> | undefined;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let mode = $state<'write' | 'review' | 'history' | 'assets'>(untrack(() => review) ? 'review' : 'write');
  // The Files column's paths that aren't in the folder (EX-6): the Assets tab's count and list. Checked again when
  // the files change, when the tab opens and with the 5 s check, since OneDrive may bring a file in at any time.
  let lostFiles = $state<Set<string>>(new Set());
  const fileLines = $derived(script ? JSON.stringify(script.blocks.flatMap((b) => (b.type === 'row' ? b.files : []))) : '');
  $effect(() => {
    if (fileLines) untrack(checkFiles);
  });
  let prompting = $state(false); // the teleprompter is open (EX-2)
  let crediting = $state(false); // the Credits window is open (AP-31)
  let promptFrom = $state(0); // the block it opens at (AU-7)
  let cursorBlock = -1; // the block the cursor was last in, in Write
  // The teleprompter opens at the block the cursor was last in, or else the first one on screen (AU-7). The cursor's
  // block counts even once scrolled away: ⋯ is at the top of the page, so reaching it scrolls the page back up.
  function whereAmI() {
    if (cursorBlock >= 0) return cursorBlock;
    const first = [...document.querySelectorAll<HTMLElement>('[data-block]')].find((el) => el.getBoundingClientRect().top >= 0);
    return first ? Number(first.dataset.block) : 0;
  }
  let notes = $state<Note[]>([]); // comments, replies and resolves (Review)
  const openThreads = $derived(threads(notes).filter((t) => !t.resolved));
  const openCount = $derived(openThreads.length);
  // The side panel (Planning, and in Write Comments, RV-13): open or closed and its tab are this browser's.
  let sideOpen = $state(recall('planning-open') === '1');
  let sideTab = $state<'planning' | 'comments'>(recall('side-tab') === 'comments' ? 'comments' : 'planning');
  let talking = $state(''); // the comment being read in Write's Comments tab
  let goTo = $state(0); // bumped on every bubble or quote click, so the same card is scrolled to again (RV-17)
  // A bubble or a quote in Write: the panel opens on Comments at that card.
  function showComment(id: string) {
    talking = id;
    goTo++;
    sideTab = 'comments';
    sideOpen = true;
  }
  // A card in the panel: Write scrolls to its row.
  function showRow(id: string) {
    document.querySelector(`[data-row="${id}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
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
  // Voice-over takes (AU-1): read with the script and with the 5 s check, so others' takes appear.
  const voice = new VoiceOver();
  // The top bar's length (AP-12), beside Saved: "0:04/13:42", the takes so far and the whole script (takes, plus read
  // time for rows with none, as Play times it). With no take yet, only the whole: "13:42". No "1 of 6" (the user's call).
  const taken = $derived(script ? rows(script).filter((row) => voice.takes[row.id]) : []);
  const voiceText = $derived.by(() => {
    if (!script) return '';
    const steps = plan(script, voice.takes, speaking.wpm);
    const total = steps.reduce((sum, step) => sum + step.seconds, 0);
    if (!taken.length) return total ? clock(total) : '';
    const seconds = taken.reduce((sum, row) => sum + takeLength(voice.takes[row.id]), 0);
    return `${clock(seconds)}/${clock(total)}`;
  });
  // Play the script (AU-2): the rows in order with their takes. In Write and Review (AU-9), once a row has a take.
  const player = new Player();
  const canPlay = $derived((mode === 'write' || mode === 'review') && !clash && taken.length > 0);
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
    player.start(dir, steps, from === undefined ? 0 : Math.max(0, steps.findIndex((s) => s.id === from)), voice.takes);
  }
  // Space pauses and Esc stops, unless you are typing (Space on a button is that button's).
  function playKeys(event: KeyboardEvent) {
    const el = event.target as HTMLElement;
    // Esc while the ring fills round the mic throws the new take away (AU-4).
    if (event.key === 'Escape' && voice.cue) return void voice.cancel();
    if (!player.started || el.closest?.('input, textarea, select')) return;
    if (event.key === 'Escape') player.stop();
    else if (event.key === ' ' && !el.closest?.('button, a')) {
      event.preventDefault();
      player.toggle();
    }
  }
  let finding = $state(false); // the find and replace bar in Write (AP-32)


  // What changed since you last looked (RV-15, board 45): worked out once on opening, from History and the time
  // this browser last opened the script. Seen marks and Got it last until the script is left.
  let visit = $state<Visit | null>(null);
  let visitSeen = $state(new Set<string>());
  let visitOn = $state(''); // the changed row stepped to
  let visitEdits = $state(!!recall('review-edits')); // Show the edits, shared with Review's (RV-4)
  $effect(() => keep('review-edits', visitEdits ? '1' : ''));
  const marks = $derived.by((): Marks | null => {
    if (!visit || !script) return null;
    const here = new Set(rows(script).map((row) => row.id));
    const changed = new Map([...visit.changed].filter(([id]) => here.has(id) && !visitSeen.has(id)));
    if (!changed.size && !visit.removed.length) return null;
    return { ...visit, changed, on: visitOn, edits: visitEdits, onSeen: (id) => (visitSeen = new Set([...visitSeen, id])) };
  });
  const visitIds = $derived(script && marks ? rows(script).map((row) => row.id).filter((id) => marks.changed.has(id)) : []);
  function stepVisit(by: number) {
    const count = visitIds.length;
    if (!count) return;
    const at = visitIds.indexOf(visitOn);
    visitOn = visitIds[at < 0 ? (by > 0 ? 0 : count - 1) : (at + by + count) % count];
    document.querySelector(`[data-visit="${visitOn}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  const title = $derived(script ? frontValue(script.front, 'title') || path.at(-1) : path.at(-1));

  onMount(async () => {
    const opened = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
    try {
      if (!(await file.open(path))) return void (missing = true);
      const key = visitKey(folder.name, path);
      const before = recall(key);
      keep(key, opened);
      if (file.dir && file.script) visit = sinceVisit(await listVersions(file.dir).catch(() => []), file.script, before, name);
      if (file.dir) notes = await listNotes(file.dir).catch(() => []);
      if (file.dir) await voice.load(file.dir);
      checker = setInterval(checkOutside, CHECK_EVERY);
      heartbeat = setInterval(() => file.here(), HERE_EVERY);
    } catch {
      notice = "The script couldn't be opened. If OneDrive is still syncing, wait a moment and reload.";
    }
  });

  onDestroy(() => {
    voice.stopPlaying();
    player.stop();
    clearInterval(checker);
    clearInterval(heartbeat);
    const d = file.dir;
    const who = name; // read now: leaving the example takes the props away before leave() is done
    file.leave().finally(() => d && removeEditing(d, who));
  });

  // The newest mode asked for: Review or History, shown only once what is waiting is saved, never replaces a mode
  // picked meanwhile (History then straight to Write stayed on History).
  let asked = 0;
  function switchMode(to: typeof mode) {
    if (to === 'review') return showReview();
    if (to === 'history') return showHistory();
    asked++;
    mode = to;
    if (to === 'assets') checkFiles();
  }

  async function showHistory() {
    const ask = ++asked;
    await file.leave();
    if (dir) notes = await listNotes(dir).catch(() => notes);
    if (ask === asked) mode = 'history';
  }

  // From History (RV-6): a still-open comment, in Review.
  async function openComment(id: string) {
    await showReview();
    await tick();
    showLoose(id);
  }

  async function restore(version: Version) {
    if (!(await file.restore(version))) return;
    undo = null;
    switchMode('write');
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

  // "Use in script" (RV-12, board 49): a file on a comment is copied from .studio/files/ into assets/ (a name already
  // there gets " 2") and added under the row's files, saved as usual. `came` names where it came from, under its chip.
  let came = $state<{ row: string; line: string; from: string } | null>(null);
  async function useFile(row: string, item: Attachment, from: string): Promise<boolean> {
    const block = script?.blocks.find((b) => b.type === 'row' && b.id === row);
    if (!dir || !block || block.type !== 'row') return false;
    const file = await assetFile(dir, item.path);
    if (!file) {
      notice = `${item.name} isn't here yet. If it was just added, OneDrive may still be syncing.`;
      return false;
    }
    try {
      const line = await addAsset(dir, new File([file], item.name, { type: file.type }));
      block.files = [...block.files, line];
      came = { row, line, from };
      changed();
      return true;
    } catch {
      notice = "The file couldn't be copied into the script's folder.";
      return false;
    }
  }

  // Review status (RV-3): draft → in review → approved, or sent back to draft. Saved at once, with a History entry.
  const reviewStatus = $derived(script ? frontValue(script.front, 'status') || 'draft' : 'draft');
  // Read from History when Review opens, and again after a status change: the note sent with it for review
  // (RV-8, only while it is in review), and the version from when the last review ended (RV-4). In Write, the send
  // back (RV-13) while it is a draft again: its note tops the Comments tab, which opens by itself the first time this
  // browser sees a send back by someone else.
  let sent = $state<Version>();
  let reviewedAt = $state<Version>();
  // RV-15's bar: in Write, and in Review only when that has no "What's changed" round of its own (RV-4).
  const showVisit = $derived(!!marks && (mode === 'write' || (mode === 'review' && !reviewedAt)));
  let back = $state<Version>();
  let reading = 0; // only the newest read counts: an older one can finish later
  function readReview() {
    const n = ++reading;
    const [m, status] = [mode, reviewStatus];
    if ((m !== 'review' && m !== 'write') || !dir) return void ((sent = undefined), (reviewedAt = undefined), (back = undefined));
    listVersions(dir)
      .then((versions) => {
        if (n !== reading) return;
        sent = m === 'review' && status === 'in review' ? reviewNote(versions) : undefined;
        reviewedAt = m === 'review' ? reviewEnd(versions) : undefined;
        back = m === 'write' && status === 'draft' ? backNote(versions) : undefined;
        if (back && back.who !== name && recall('seen-back') !== back.id) {
          keep('seen-back', back.id);
          sideTab = 'comments';
          sideOpen = true;
        }
      })
      .catch(() => {});
  }
  $effect(readReview);
  async function setStatus(to: 'draft' | 'in review' | 'approved', note: string, message = '') {
    await file.setStatus(to, note, message);
  }

  async function showReview() {
    const ask = ++asked;
    await file.leave();
    if (ask === asked) mode = 'review';
  }

  async function checkFiles() {
    if (!dir || !script) return;
    const lost = await missingFiles(dir, assetList(script)).catch(() => lostFiles);
    if ([...lost].join('\n') !== [...lostFiles].join('\n')) lostFiles = lost;
  }

  // From the list before Approve (RV-5): to that comment in Review, or to the Assets tab for missing files.
  async function showLoose(id: string) {
    if (!id) return switchMode('assets');
    if (id.startsWith('flag:')) {
      switchMode('write');
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
    switchMode('write');
    await tick();
    const field = document.querySelector<HTMLElement>(`[aria-label="Dialogue, row ${row}"]`);
    field?.scrollIntoView({ block: 'center' });
    field?.focus({ preventScroll: true });
  }

  // The 5 s check: missing files, takes, who else is here, comments, and someone else's save.
  async function checkOutside() {
    if (!file.dir || document.hidden || !(await file.checkAccess())) return;
    checkFiles();
    if (!voice.recording) voice.load(file.dir);
    await file.readEditors();
    notes = await listNotes(file.dir).catch(() => notes);
    await file.lookOutside();
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
    printing = { ...choices, version: await file.version() };
  }

  // Export (EX-9): saves what is waiting, then opens the export screen on that format, in place of the script.
  async function openExport(to: Format) {
    if (!script) return;
    player.stop();
    exporting = { to, version: await file.version() };
  }

  // Copy for Teams (EX-10): saves what is waiting, then the script's facts as a short message (lib/share.ts).
  async function shareNow() {
    if (!script) throw new Error('No script');
    const v = await file.version();
    const newest = dir ? (await listVersions(dir).catch(() => [])).at(-1) : undefined;
    const who = newest && newest.who !== OUTSIDE ? newest.who : '';
    const voiced = script.blocks.filter((b) => b.type === 'row' && voice.takes[b.id]).length;
    return share({ title: title ?? '', link: shareLink(location.href), status: reviewStatus, version: v, who, when: newest ? Date.parse(newest.when) : 0,
      open: openCount, voice: voiced }, script);
  }

  // Leaving saves what is waiting. Only a failed save or a lost OK, which would lose work, asks the browser to hold the page.
  function beforeUnload(event: BeforeUnloadEvent) {
    file.leave();
    if (status === 'failed' || status === 'locked') event.preventDefault();
  }
</script>

<svelte:window onbeforeunload={beforeUnload} onafterprint={() => (printing = null)} onkeydown={playKeys} />
<svelte:document onfocusin={(e) => { const at = (e.target as HTMLElement).closest?.<HTMLElement>('[data-block]'); if (at) cursorBlock = Number(at.dataset.block); }} onvisibilitychange={() => (document.hidden ? status === 'waiting' && save() : checkOutside())} />

{#if prompting && script}
  <Teleprompter {script} from={promptFrom} onClose={() => (prompting = false)} />
{/if}

{#if crediting && script}
  <Credits root={folder} bind:script={() => script!, (s) => (file.script = s)} me={name} onChange={changed} onClose={() => (crediting = false)} />
{/if}

{#if printing && script && dir}
  <Print {script} {dir} title={title ?? ''} version={printing.version} column={printing.column} lines={printing.lines} scale={printing.scale / 100} hidden={printing.hidden} landscape={printing.landscape} credits={printing.credits ? shownCredits(script.front) : []} onReady={() => window.print()} />
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
<Header folder={folder.name} title={title ?? ''} ready={!!script} {mode} {openCount} {loose} missingCount={lostFiles.size} {voiceText} voiceWpm={takesSpeed(voice.takes)} editors={file.editors} {reviewStatus} {status} problem={file.problem}
  play={canPlay ? { time: player.started ? `${clock(player.time)} / ${clock(player.total)}` : '', on: player.on } : null} onPlay={() => play()} onStop={() => player.stop()}
  onMode={switchMode}
  onAllow={() => file.allow()} onStatus={setStatus} onLoose={showLoose} onExport={openExport} onShare={shareNow} nextVersion={() => file.nextVersion()} onFind={() => (switchMode('write'), (finding = true))} onCredits={() => (crediting = true)} onPrompt={() => (status === 'waiting' && save(), player.stop(), (promptFrom = whereAmI()), (prompting = true))} />

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
      theirsLabel={clash.theirsLabel} combined={clash.combined} onSave={(picks) => file.resolve(picks)} />
  {:else if script && dir && mode === 'review'}
    {#if showVisit && marks}{@render visitBar(marks)}{/if}
    <Review {dir} {script} {notes} {flagged} me={name} {sent} {reviewedAt} visit={reviewedAt ? null : marks} {voice} {player} {canPlay} onPlayFrom={play} onNotice={(m) => (notice = m)} onAdd={note} onApply={apply} />
  {:else if script && dir && mode === 'assets'}
    <Assets {script} {dir} missing={lostFiles} onJump={jump} onNotice={(m) => (notice = m)} />
  {:else if script && dir && mode === 'history'}
    <History {dir} {notes} onRestore={restore} onPublish={(official) => file.publish(official)} onOpen={openComment} />
  {:else if script && dir}
    {#if showVisit && marks}{@render visitBar(marks)}{/if}
    <Write bind:script={() => script!, (s) => (file.script = s)} bind:finding {dir} root={folder} folderName={path[0]} {voice} {player} canPlay={canPlay} onPlayFrom={play} {name} {flagged} onFlag={flag} onChange={changed} onDeleted={deleted} onNotice={(m) => (notice = m)}
      talk={openThreads} {talking} onTalk={showComment} visit={marks} {came} />
  {/if}
</main>
{#snippet visitBar(shown: Marks)}
  <VisitBar visit={shown} left={visitSeen.size > 0} at={visitIds.indexOf(visitOn)} bind:edits={visitEdits} onStep={stepVisit}
    onDone={() => ((visit = null), (visitOn = ''))} />
{/snippet}
{#if script && dir && !clash && (mode === 'write' || mode === 'review')}
  <Planning {dir} bind:open={sideOpen} bind:tab={sideTab} count={openCount} comments={mode === 'write' ? comments : undefined} />
{/if}
{#if tour !== undefined && script && dir && !clash && !printing && !exporting}<Tour tab={mode} again={tour} />{/if}
{#snippet comments()}
  {#if script && dir}
    <Comments {dir} {script} {notes} me={name} {back} bind:active={talking} {goTo} onAdd={note} onApply={apply} onShow={showRow} onUse={useFile} />
  {/if}
{/snippet}
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
