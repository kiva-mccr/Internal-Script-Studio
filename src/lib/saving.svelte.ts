// One open script on disk (FX-2, docs/studio-folder.md): reading it, saving this person's changes as change files,
// folding in everyone else's, "… is editing", and, on the keeper's computer, script.md and History. The screens are
// Editor.svelte's; this file has no page of its own.
import { untrack } from 'svelte';
import { askAccess, hasAccess } from './remember';
import { findScript, readScript, writeScriptFile } from './folder';
import { newId, parseScript, rows, setFrontValue, withAuthor, writeScript, type Script } from './script';
import { fileName, FRESH_FOR, readEditing, othersEditing, writeEditing, writerOf, type Editing } from './editing';
import { addVersion, heads, listVersions, officialNumber, OUTSIDE, sendVersion, sha256, type Version } from './history';
import { merge, type Merged, type Side } from './merge';
import { diff, fold } from './changes';
import { listChanges, readChange, readFolded, removeChange, writeChange, writeFolded } from './changefiles';

// How long typing waits before it is saved (the user's pick: 30 s, or at once with Ctrl+S). Tests make it shorter
// through `save-every` in this browser's storage.
const SAVE_EVERY = (() => {
  try {
    return Number(localStorage.getItem('save-every')) || 30_000;
  } catch {
    return 30_000;
  }
})();
const RETRY_AFTER = 6000; // a failed save, tried again
const ENTRY_EVERY = 5 * 60 * 1000; // a History entry at most every 5 minutes of editing (docs/studio-folder.md)
const KEEP_CHANGES = 2 * 60 * 1000; // change files already in script.md are removed once this old
const STALE_AFTER = 60 * 1000; // a change this much older than script.md was surely folded in already

// saved: all written. waiting: changes not written yet. saving. failed: the last write failed (tried again).
// conflict: someone else changed a place you changed too, waiting for the person to pick (`clash`).
// locked: the browser took back its OK to edit the folder; only a click (Allow editing) can ask again.
export type Status = 'saved' | 'waiting' | 'saving' | 'failed' | 'conflict' | 'locked';

export type Clash = { merged: Merged; heading: string; mineLabel: string; theirsLabel: string; combined: string; copy?: string };

const errorText = (e: unknown) => (e instanceof Error ? `${e.name}: ${e.message}` : String(e));

export class Saving {
  dir = $state<FileSystemDirectoryHandle | null>(null);
  script = $state<Script | null>(null);
  status = $state<Status>('saved');
  clash = $state<Clash | null>(null);
  editors = $state<string[]>([]); // other people with this script open
  problem = $state(''); // why the last save failed, in the browser's words, for the person to report
  folding = $state(''); // whose changes are being folded in right now (a spinner beside "… is editing")
  shared = ''; // the script as everyone has it: script.md plus every change file folded in, this person's too
  last: Version | null = null; // the newest History entry this page knows of
  #seen = new Set<string>(); // change files already in `shared`
  #authors = new Set<string>(); // whose changes are in `shared` since the last History entry
  #entries: Editing[] = []; // everyone's "… is editing" files, from the last check
  #wrote = ''; // script.md as this page last read or wrote it, to tell an edit made outside the app
  #started: Promise<void> = Promise.resolve(); // History found or started on opening (sets `last`)
  #timer: ReturnType<typeof setTimeout> | undefined;
  #saving: Promise<void> = Promise.resolve(); // the save being written, for saveWaiting
  // A status change in progress: leaving waits for its History entry, or a quick switch of tab made a second entry
  // ("Changed the status") beside it.
  #changingStatus: Promise<void> = Promise.resolve();
  #since = new Date().toISOString();

  // name: a getter, since the Editor's props can go before its leaving is done. notice: a message for the person.
  // onEntry: a status change's History entry was written (the Editor reads Review's notes again).
  constructor(
    private folder: FileSystemDirectoryHandle,
    private name: () => string,
    private notice: (message: string) => void,
    private onEntry: () => void,
  ) {}

  // Opens the script: false when there is none at that path. Throws when it can't be read (mid-sync).
  async open(path: string[]): Promise<boolean> {
    const dir = (this.dir = await findScript(this.folder, path));
    if (!dir) return false;
    const text = await readScript(dir);
    const folded = await readFolded(dir).catch(() => null);
    for (const name of folded?.changes ?? []) this.#seen.add(name);
    this.shared = this.#wrote = text;
    this.load(text);
    this.#started = this.#startHistory(dir, text, folded?.sha256 ?? '');
    await this.#started;
    await this.here();
    await this.readEditors();
    await this.#lookForCopies(dir, text);
    await this.#sync();
    return true;
  }

  // "… is editing": a new file for this person, with when they were last here and what they last wrote.
  async here() {
    if (!this.dir) return;
    const entry: Editing = { v: 1, who: this.name(), since: this.#since, seen: new Date().toISOString(), last_written: await sha256(this.#wrote) };
    await writeEditing(this.dir, entry).catch(() => {});
  }

  // On opening: the newest version should match script.md. If not, the keeper wrote it since (its note says so),
  // or it was changed outside the app (Notepad), which gets its own entry. No versions: History starts.
  async #startHistory(dir: FileSystemDirectoryHandle, text: string, foldedSha: string) {
    try {
      const versions = await listVersions(dir);
      const newest = versions.at(-1);
      const sha = await sha256(text);
      const matching = heads(versions).findLast((v) => v.sha256 === sha);
      if (!newest) this.last = await addVersion(dir, { parents: [], who: this.name(), kind: 'restart', text });
      else if (matching) this.last = matching;
      else if (sha === foldedSha) this.last = newest; // the app's own; its entry comes with the keeper's next one
      else {
        // Someone's last save that never got its entry (their laptop closed): credit it to them.
        const writer = writerOf(await readEditing(dir), sha, this.name());
        this.last = writer
          ? await addVersion(dir, { parents: [newest.id], who: writer, kind: 'edit', text })
          : await addVersion(dir, { parents: [newest.id], who: OUTSIDE, kind: 'outside', text });
      }
    } catch {
      // History can't be written (read-only folder?): editing still works.
    }
  }

  // On opening: a copy OneDrive kept beside script.md (script-LAPTOP-SAM.md) is combined row by row, then saved as
  // a change of this person's; the copy is removed once that is saved.
  async #lookForCopies(dir: FileSystemDirectoryHandle, text: string) {
    try {
      for await (const name of dir.keys()) {
        if (!/^script-.+\.md$/i.test(name)) continue;
        const copy = await (await (await dir.getFileHandle(name)).getFile()).text();
        return this.#offer(merge(this.last?.text ?? text, text, copy), {
          heading: 'OneDrive kept two copies of this script', mineLabel: 'script.md', theirsLabel: name,
          mineName: 'script.md', theirsName: name, copy: name,
        });
      }
    } catch {
      // Can't be read yet (mid-sync): looked at again next time the script opens.
    }
  }

  // Shows a combination, or takes it straight away when nothing clashes.
  async #offer(merged: Merged, o: { heading: string; mineLabel: string; theirsLabel: string; mineName: string; theirsName: string; copy?: string }) {
    if (!merged.clashes.length) return this.#take(merged.text({}), o.copy);
    const parts = [
      ...merged.onlyTheirs.map((n) => `row ${n} (only ${o.theirsName} changed it)`),
      ...merged.onlyMine.map((n) => `row ${n} (only ${o.mineName} changed it)`),
    ];
    this.clash = {
      merged, heading: o.heading, mineLabel: o.mineLabel, theirsLabel: o.theirsLabel, copy: o.copy,
      combined: parts.length ? `Also combined: ${parts.join(', ')}.` : '',
    };
    this.status = 'conflict';
  }

  // A combined script goes into the page and is saved at once, as this person's change.
  async #take(text: string, copy?: string) {
    this.clash = null;
    this.#show(text);
    if (this.status !== 'waiting') return;
    await this.save();
    if (copy && (this.status as Status) === 'saved') await this.dir?.removeEntry(copy).catch(() => {}); // only once it is saved
  }

  // The person's picks in Conflict.svelte.
  resolve(picks: Record<string, Side>) {
    const clash = this.clash;
    if (clash) this.#take(clash.merged.text(picks), clash.copy);
  }

  // Others' change files that aren't in `shared` yet are folded in, oldest first: into `shared` as they are, and into
  // the page with this person's own unsaved changes kept; a place both changed is shown to pick (`clash`). Then the
  // keeper's work. The 5 s check, and on opening; in line with saves, which change `shared` too.
  sync(): Promise<void> {
    return (this.#saving = this.#saving.then(() => this.#sync()));
  }

  async #sync() {
    const dir = this.dir;
    if (!dir || this.status === 'conflict' || this.status === 'locked') return;
    const names = await listChanges(dir).catch(() => []);
    let folded = '';
    for (const name of names) {
      if (this.#seen.has(name)) continue;
      const change = await readChange(dir, name);
      if (!change || (this.status as Status) === 'conflict') continue; // still being written: next time
      this.folding = folded = change.who;
      // A change from well before script.md was last written that isn't in the keeper's note: the keeper closed
      // between writing script.md and its note, so script.md most likely holds it already. Folding it again changes
      // nothing, except where a later change changed the same place: there script.md is kept, never asked about.
      const stale = Date.parse(fromStamp(name)) < (await scriptTime(dir)) - STALE_AFTER;
      const ours = fold(change.delta, this.shared);
      this.shared = ours.text(Object.fromEntries(ours.clashes.map((c) => [c.key, stale ? 'mine' : 'theirs'])));
      this.#seen.add(name);
      this.#authors.add(change.who);
      let merged = fold(change.delta, this.#pageText(false));
      if (stale && merged.clashes.length) merged = { ...merged, clashes: [], text: () => merged.text(Object.fromEntries(merged.clashes.map((c) => [c.key, 'mine']))) };
      const who = fileName(change.who) === fileName(this.name()) ? 'You, earlier,' : change.who;
      if (merged.clashes.length) {
        await this.#offer(merged, { heading: `${who} and you both changed the same place`, mineLabel: 'Yours', theirsLabel: this.#label(change.who), mineName: 'you', theirsName: change.who });
      } else this.#show(merged.text({}));
    }
    if (folded) setTimeout(() => this.folding === folded && (this.folding = ''), 800); // long enough to be seen
    await this.#keep();
  }

  // Shows `text` in the page; what differs from `shared` is this person's, still to save.
  #show(text: string) {
    this.load(text);
    if (text !== this.shared) this.changed();
  }

  #label = (who: string) => (fileName(who) === fileName(this.name()) ? 'Yours, from before' : `${who}’s`);

  // The keeper: the one who opened the script first among those editing it now (the next takes over when they go).
  // Only the keeper writes script.md, so two computers never write it at once.
  #keeper(): boolean {
    const now = Date.now();
    const others = this.#entries.filter((e) => fileName(e.who) !== fileName(this.name()) && now - Date.parse(e.seen) < FRESH_FOR);
    const here = [...others, { who: this.name(), since: this.#since }];
    here.sort((a, b) => a.since.localeCompare(b.since) || a.who.localeCompare(b.who));
    return fileName(here[0].who) === fileName(this.name());
  }

  // The keeper's work: script.md brought up to `shared` (an edit made outside the app is folded in first), a note of
  // which change files it holds, a History entry every 5 minutes (or now, when leaving), and old change files
  // removed.
  async #keep(leaving = false) {
    const dir = this.dir;
    if (!dir || this.status === 'conflict' || this.status === 'locked' || !this.#keeper()) return;
    try {
      const now = await readScript(dir);
      if (now !== this.#wrote && now !== this.shared && (await readFolded(dir))?.sha256 !== (await sha256(now))) {
        // Changed outside the app since: folded in like anyone's change, and given its own History entry.
        const outside = diff(this.#wrote, now);
        if (outside) {
          const ours = fold(outside, this.shared);
          this.shared = ours.text(Object.fromEntries(ours.clashes.map((c) => [c.key, 'theirs'])));
          this.#wrote = now;
          const page = fold(outside, this.#pageText(false));
          if (page.clashes.length) {
            return this.#offer(page, { heading: 'Someone changed the script outside the app', mineLabel: 'Yours', theirsLabel: 'Outside the app', mineName: 'you', theirsName: OUTSIDE });
          }
          this.#show(page.text({}));
          await this.#record(now, OUTSIDE, true);
        }
      }
      if (now !== this.shared) {
        await writeScriptFile(dir, this.shared);
        await writeFolded(dir, { sha256: await sha256(this.shared), changes: [...this.#seen] });
        this.#wrote = this.shared;
        await this.here();
      } else this.#wrote = now;
      await this.#record(this.shared, '', leaving);
      for (const name of await listChanges(dir)) {
        if (this.#seen.has(name) && Date.now() - Date.parse(fromStamp(name)) > KEEP_CHANGES) await removeChange(dir, name);
      }
    } catch {
      // Tried again at the next check (the next keeper, if this computer goes).
    }
  }

  // A History entry for `text`: at most every 5 minutes, or now when `now` is set; after the newest entry, so two
  // people's entries follow one another. Credited to whoever's changes it holds.
  async #record(text: string, who: string, now: boolean) {
    await this.#started; // an edit made just after opening waits for History to start, or it gets no entry
    const dir = this.dir;
    if (!dir) return;
    const newest = (await listVersions(dir)).at(-1) ?? this.last;
    if (!newest || (await sha256(text)) === newest.sha256) return;
    if (!now && Date.now() - Date.parse(newest.when) < ENTRY_EVERY) return;
    const authors = who || [...this.#authors].join(' and ') || this.name();
    this.last = await addVersion(dir, { parents: [newest.id], who: authors, kind: who === OUTSIDE ? 'outside' : 'edit', text });
    if (!who) this.#authors.clear();
  }

  // Leaving the script (or opening History): save what is waiting and put it in History.
  async leave() {
    await this.#changingStatus;
    await this.saveWaiting();
    if (this.status !== 'saved') return;
    if (this.#keeper()) await this.#keep(true);
    else await this.#record(this.shared, '', true).catch(() => {});
  }

  // Puts an older version back as the script. False if it couldn't be written (a message is shown).
  async restore(version: Version): Promise<boolean> {
    if (!this.dir) return false;
    try {
      await this.leave();
      this.#show(version.text);
      await this.save();
      if (this.status !== 'saved') throw new Error('not saved');
      const when = new Date(version.when).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
      await this.#entry('restore', `Restored the version from ${when.replace(' AM', ' am').replace(' PM', ' pm')}`);
      return true;
    } catch {
      this.notice("That version couldn't be restored. If the shared folder is busy, wait a moment and try again.");
      return false;
    }
  }

  // An entry of its own kind, now, for the script as everyone has it.
  async #entry(kind: 'restore' | 'official' | 'review', note: string, extra: { message?: string; official?: boolean } = {}) {
    const dir = this.dir!;
    const newest = (await listVersions(dir)).at(-1) ?? this.last;
    this.last = await addVersion(dir, { parents: newest ? [newest.id] : [], who: this.name(), kind, text: this.shared, note, ...extra });
    this.#authors.clear();
    return this.last;
  }

  // An official version: the script as it is now, named. Returns null if it couldn't be written.
  async publish(official: string): Promise<Version | null> {
    if (!this.dir) return null;
    try {
      await this.leave();
      return await this.#entry('official', official);
    } catch {
      this.notice("The official version couldn't be published. If the shared folder is busy, wait a moment and try again.");
      return null;
    }
  }

  // Review status (RV-3): saved at once, with a History entry.
  async setStatus(to: 'draft' | 'in review' | 'approved', note: string, message = '') {
    const [dir, script] = [this.dir, this.script];
    if (!dir || !script) return;
    await this.leave();
    await (this.#changingStatus = this.#changeStatus(dir, script, to, note, message));
  }

  async #changeStatus(dir: FileSystemDirectoryHandle, script: Script, to: string, note: string, message: string) {
    script.front = setFrontValue(script.front, 'status', to);
    this.changed();
    await this.save();
    if (this.status !== 'saved') return; // a clash or a failed save: shown already
    try {
      // A send for review is also the next official version, unless nothing changed since the newest one (RV-9).
      const official = to === 'in review' && !sendVersion(await listVersions(dir), this.shared).still;
      await this.#entry('review', note, { message, official });
      untrack(this.onEntry); // the new entry: the review note, or the marks start again from here
    } catch {
      // History can't be written: the status itself is saved.
    }
  }

  load(text: string) {
    const parsed = parseScript(text);
    // Ids are given now, not on save, so a row keeps the same id from its first save on.
    const used = new Set(rows(parsed).map((row) => row.id));
    for (const row of rows(parsed)) if (!row.id) used.add((row.id = newId(used)));
    clearTimeout(this.#timer);
    this.#timer = undefined;
    this.script = parsed;
    this.status = 'saved';
  }

  // Something was edited: saved within 30 s (not put off by more typing), or at once with Ctrl+S.
  changed() {
    if (this.status === 'conflict' || this.status === 'locked') return; // kept in the page, saved once that is settled
    if (this.status !== 'failed') this.status = 'waiting';
    this.#timer ??= setTimeout(() => this.save(), SAVE_EVERY);
  }

  // One save at a time: a second one started mid-write would write the same change twice.
  save(): Promise<void> {
    return (this.#saving = this.#saving.then(() => this.#write()));
  }

  // What is typed, saved: a save already being written is waited for (without that, History opened mid-save got
  // no entry for it, and Print or Send for review read the script before it), then what is still waiting is saved.
  async saveWaiting() {
    // Until no save is left in line: one can be queued behind the one being waited for.
    let saving: Promise<void>;
    do await (saving = this.#saving);
    while (saving !== this.#saving);
    if (this.status === 'waiting' || this.status === 'failed') await this.save();
  }

  // The page as a script.md text. `forSave`: with this person among the authors and empty sections left out (a
  // copy: Write removes an empty section from the page once the cursor leaves it, AP-22).
  #pageText(forSave: boolean): string {
    const kept = $state.snapshot(this.script) as Script;
    if (!forSave) return writeScript(kept);
    kept.front = withAuthor(kept, this.name()).front;
    kept.blocks = kept.blocks.filter((b) => b.type === 'row' || b.title.trim() || b.note);
    return writeScript(kept);
  }

  // Saves what changed since `shared` as a new change file (never a file someone else could be reading).
  async #write() {
    if (!this.dir || !this.script || this.status === 'conflict' || this.status === 'locked') return;
    clearTimeout(this.#timer);
    this.#timer = undefined;
    this.status = 'saving';
    try {
      const text = this.#pageText(true);
      const delta = diff(this.shared, text);
      if (delta) {
        this.#seen.add(await writeChange(this.dir, this.name(), delta));
        this.shared = text;
        this.#authors.add(this.name());
        this.script.front = parseScript(text).front; // this person among the authors, in the page too
      }
      this.problem = '';
      // Edits typed while saving start another save.
      if (this.status === 'saving') this.status = 'saved';
      await this.#keep();
    } catch (e) {
      // Retrying can't bring back a lost OK (the browser asks only from a click), so that waits for Allow editing.
      if (!(await hasAccess(this.folder).catch(() => true))) return void (this.status = 'locked');
      this.problem = `Writing your changes: ${errorText(e)}`;
      this.status = 'failed';
      this.#timer = setTimeout(() => this.save(), RETRY_AFTER);
    }
  }

  // Chrome and Edge take back the OK to edit the folder after the tab has been in the background a while. Checked
  // with the 5 s check and on coming back to the tab, so it shows before a save fails.
  async checkAccess(): Promise<boolean> {
    if (this.status === 'locked') return false;
    if (await hasAccess(this.folder).catch(() => true)) return true;
    clearTimeout(this.#timer);
    this.#timer = undefined;
    this.status = 'locked';
    return false;
  }

  // Allow editing (from a click): the browser asks, then what is in the page is saved.
  async allow() {
    if (!(await askAccess(this.folder).catch(() => false))) return;
    this.status = 'waiting';
    await this.save();
  }

  // The 5 s check: who else has the script open (and so who the keeper is).
  async readEditors() {
    if (!this.dir) return;
    this.#entries = await readEditing(this.dir).catch(() => this.#entries);
    this.editors = othersEditing(this.#entries, this.name());
  }

  // Saves what is waiting, then names the version the script is: "v3" while it is still that official version, ''
  // for a draft. Print and the exports carry it (EX-7).
  async version(): Promise<string> {
    await this.saveWaiting();
    const versions = this.dir ? await listVersions(this.dir).catch(() => []) : [];
    const n = officialNumber(versions, this.shared);
    return n ? `v${n}` : '';
  }

  // What Send for review will make (RV-9), for its panel: saves what is waiting, then the next version or "still v2".
  async nextVersion(): Promise<{ n: number; still: boolean }> {
    await this.saveWaiting();
    return sendVersion(this.dir ? await listVersions(this.dir).catch(() => []) : [], this.shared);
  }
}

// When script.md was last written (0 if it can't be read).
async function scriptTime(dir: FileSystemDirectoryHandle): Promise<number> {
  try {
    return (await (await dir.getFileHandle('script.md')).getFile()).lastModified;
  } catch {
    return 0;
  }
}

// A change file's time, from its name (20261113T204500123Z_…): as an ISO date.
function fromStamp(name: string): string {
  const t = name.slice(0, name.indexOf('_'));
  return `${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)}T${t.slice(9, 11)}:${t.slice(11, 13)}:${t.slice(13, 15)}.${t.slice(15, 18)}Z`;
}
