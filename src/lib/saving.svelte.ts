// One open script on disk: reading it, saving it on its own, its History, "… is editing", and combining saves made
// at the same time. The screens are Editor.svelte's; this file has no page of its own.
import { untrack } from 'svelte';
import { askAccess, hasAccess } from './remember';
import { findScript, readScript, scriptStamp, writeScriptFile } from './folder';
import { newId, parseScript, rows, setFrontValue, withAuthor, writeScript, type Script } from './script';
import { readEditing, othersEditing, writeEditing } from './editing';
import { addVersion, ancestor, heads, listVersions, officialNumber, OUTSIDE, sendVersion, sha256, type Version } from './history';
import { merge, type Merged, type Side } from './merge';

const SAVE_AFTER = 1500; // ms after the last change
const ENTRY_EVERY = 5 * 60 * 1000; // a history entry at most every 5 minutes of editing (docs/studio-folder.md)

// saved: all written. waiting: changes not written yet. saving. failed: the last write failed (tried again).
// conflict: two saves made at the same time, waiting for the person to pick (`clash`).
// locked: the browser took back its OK to edit the folder; only a click (Allow editing) can ask again.
export type Status = 'saved' | 'waiting' | 'saving' | 'failed' | 'conflict' | 'locked';

export type Clash = {
  merged: Merged; heading: string; mineLabel: string; theirsLabel: string; combined: string;
  parents: string[]; note: string; copy?: string;
};

export class Saving {
  dir = $state<FileSystemDirectoryHandle | null>(null);
  script = $state<Script | null>(null);
  status = $state<Status>('saved');
  clash = $state<Clash | null>(null);
  editors = $state<string[]>([]); // other people with this script open
  problem = $state(''); // why the last save failed, in the browser's words, for the person to report
  onDisk = ''; // the text of script.md as last read or written by this page
  last: Version | null = null; // the newest history entry this page knows of
  #started: Promise<void> = Promise.resolve(); // History found or started on opening (sets `last`)
  #pendingSince = 0; // when the first save not yet in History was made
  #timer: ReturnType<typeof setTimeout> | undefined;
  #saving: Promise<void> = Promise.resolve(); // the save being written, for saveWaiting
  // A status change in progress: leaving waits for its History entry, or a quick switch of tab made a second entry
  // ("Changed the status") beside it.
  #changingStatus: Promise<void> = Promise.resolve();
  #since = new Date().toISOString();
  #lastWritten = ''; // fingerprint of what this page last wrote to script.md
  #stamp = ''; // script.md's time and size when the 5 s check last read it ('' after this page writes it)

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
    this.load(text);
    this.#started = this.#startHistory(dir, text);
    await this.#started;
    await this.here();
    await this.#lookForClashes(dir, text);
    return true;
  }

  // "… is editing": this person's file, with when they were last here and what they last wrote.
  async here() {
    if (!this.dir) return;
    const now = new Date().toISOString();
    await writeEditing(this.dir, { v: 1, who: this.name(), since: this.#since, seen: now, last_written: this.#lastWritten }).catch(() => {});
  }

  // On opening: the newest version should match script.md. If not, it was changed outside the app (Notepad, a
  // laptop that closed before its entry was written), and that gets its own entry. No versions: History starts.
  async #startHistory(dir: FileSystemDirectoryHandle, text: string) {
    try {
      const versions = await listVersions(dir);
      const newest = versions.at(-1);
      const sha = await sha256(text);
      const matching = heads(versions).findLast((v) => v.sha256 === sha);
      if (!newest) this.last = await addVersion(dir, { parents: [], who: this.name(), kind: 'restart', text });
      else if (matching) this.last = matching;
      else {
        // Someone's last save that never got its entry (their laptop closed): credit it to them.
        const writer = (await readEditing(dir)).find((e) => e.last_written === sha)?.who;
        this.last = writer
          ? await addVersion(dir, { parents: [newest.id], who: writer, kind: 'edit', text })
          : await addVersion(dir, { parents: [newest.id], who: OUTSIDE, kind: 'outside', text });
      }
    } catch {
      // History can't be written (read-only folder?): editing still works.
    }
  }

  // On opening: two saves made at the same time show up as two newest versions, or as a copy OneDrive kept
  // beside script.md (script-LAPTOP-SAM.md). Either way, the two are combined row by row.
  async #lookForClashes(dir: FileSystemDirectoryHandle, text: string) {
    try {
      for await (const name of dir.keys()) {
        if (!/^script-.+\.md$/i.test(name)) continue;
        const copy = await (await (await dir.getFileHandle(name)).getFile()).text();
        const base = this.last?.text ?? text;
        return this.#offer(merge(base, text, copy), {
          heading: 'OneDrive kept two copies of this script', mineLabel: 'script.md', theirsLabel: name,
          mineName: 'script.md', theirsName: name, parents: this.last ? [this.last.id] : [], copy: name,
        });
      }
      const versions = await listVersions(dir);
      const tips = heads(versions);
      if (tips.length < 2) return;
      const sha = await sha256(text);
      const a = tips.findLast((v) => v.sha256 === sha) ?? tips.at(-1)!;
      const b = tips.filter((v) => v !== a).at(-1)!;
      const base = ancestor(versions, a, b);
      const [aName, bName] = [this.#person(a.who), this.#person(b.who)];
      this.#offer(merge(base?.text ?? '', a.text, b.text), {
        heading: `${cap(bName)} and ${aName} both saved at the same time`,
        mineLabel: this.#label(a.who), theirsLabel: this.#label(b.who), mineName: aName, theirsName: bName, parents: [a.id, b.id],
      });
    } catch {
      // Can't be read yet (mid-sync): looked at again next time the script opens.
    }
  }

  // Shows a combination of two saves, or saves it straight away when nothing clashes.
  async #offer(
    merged: Merged,
    o: { heading: string; mineLabel: string; theirsLabel: string; mineName: string; theirsName: string; parents: string[]; copy?: string },
  ) {
    const note = `Combined ${o.theirsName === OUTSIDE ? 'two saves' : `${o.theirsName}’s and ${o.mineName === 'you' ? 'your' : `${o.mineName}’s`} changes`}`;
    if (!merged.clashes.length) return this.#combine(merged.text({}), o.parents, note, o.copy);
    const parts = [
      ...merged.onlyTheirs.map((n) => `row ${n} (only ${o.theirsName} changed it)`),
      ...merged.onlyMine.map((n) => `row ${n} (only ${o.mineName} changed it)`),
    ];
    this.clash = {
      merged, heading: o.heading, mineLabel: o.mineLabel, theirsLabel: o.theirsLabel, parents: o.parents, note, copy: o.copy,
      combined: parts.length ? `Also combined: ${parts.join(', ')}.` : '',
    };
    this.status = 'conflict';
  }

  // Writes the combined script and its "merge" entry, with both saves as parents.
  async #combine(text: string, parents: string[], note: string, copy?: string) {
    const dir = this.dir;
    if (!dir) return;
    try {
      await writeScriptFile(dir, text);
      this.#lastWritten = await sha256(text);
      this.last = await addVersion(dir, { parents, who: this.name(), kind: 'merge', text, note });
      if (copy) await dir.removeEntry(copy).catch(() => {}); // deleted only once its merge is saved
      this.#pendingSince = 0;
      this.clash = null;
      this.load(text);
      await this.here();
    } catch {
      this.notice("The combined script couldn't be saved. If OneDrive is still syncing, wait a moment and try again.");
    }
  }

  // The person's picks in Conflict.svelte.
  resolve(picks: Record<string, Side>) {
    const clash = this.clash;
    if (clash) this.#combine(clash.merged.text(picks), clash.parents, clash.note, clash.copy);
  }

  #person = (who: string) => (who === this.name() ? 'you' : who);
  #label = (who: string) => (who === this.name() ? 'Yours' : `${who}’s`);

  // A history entry for what was saved: at most every 5 minutes of editing, or now when `now` is set.
  async #record(text: string, now: boolean) {
    await this.#started; // an edit made just after opening waits for History to start, or it gets no entry
    const dir = this.dir;
    if (!dir || !this.last) return;
    if ((await sha256(text)) === this.last.sha256) return;
    this.#pendingSince ||= Date.now();
    if (!now && Date.now() - this.#pendingSince < ENTRY_EVERY) return;
    this.last = await addVersion(dir, { parents: [this.last.id], who: this.name(), kind: 'edit', text });
    this.#pendingSince = 0;
  }

  // Leaving the script (or opening History): save what is waiting and put it in History.
  async leave() {
    await this.#changingStatus;
    await this.saveWaiting();
    if (this.status === 'saved' && this.onDisk) await this.#record(this.onDisk, true).catch(() => {});
  }

  // Puts an older version back as the script. False if it couldn't be written (a message is shown).
  async restore(version: Version): Promise<boolean> {
    const dir = this.dir;
    if (!dir) return false;
    try {
      await this.leave();
      await writeScriptFile(dir, version.text);
      const when = new Date(version.when).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
      this.last = await addVersion(dir, {
        parents: this.last ? [this.last.id] : [], who: this.name(), kind: 'restore', text: version.text,
        note: `Restored the version from ${when.replace(' AM', ' am').replace(' PM', ' pm')}`,
      });
      this.#pendingSince = 0;
      this.load(version.text);
      return true;
    } catch {
      this.notice("That version couldn't be restored. If OneDrive is still syncing, wait a moment and try again.");
      return false;
    }
  }

  // An official version: the script as it is now, named. Returns null if it couldn't be written.
  async publish(official: string): Promise<Version | null> {
    const dir = this.dir;
    if (!dir) return null;
    try {
      await this.leave();
      const text = await readScript(dir);
      this.last = await addVersion(dir, { parents: this.last ? [this.last.id] : [], who: this.name(), kind: 'official', text, note: official });
      this.#pendingSince = 0;
      return this.last;
    } catch {
      this.notice("The official version couldn't be published. If OneDrive is still syncing, wait a moment and try again.");
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
    await this.save();
    if (this.status !== 'saved') return; // a clash or a failed save: shown already
    try {
      // A send for review is also the next official version, unless nothing changed since the newest one (RV-9).
      const official = to === 'in review' && !sendVersion(await listVersions(dir), this.onDisk).still;
      this.last = await addVersion(dir, { parents: this.last ? [this.last.id] : [], who: this.name(), kind: 'review', text: this.onDisk, note, message, official });
      this.#pendingSince = 0;
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
    this.script = parsed;
    this.onDisk = text;
    this.status = 'saved';
  }

  // Something was edited: saved 1.5 s after the last change.
  changed() {
    if (this.status === 'conflict' || this.status === 'locked') return; // kept in the page, saved once that is settled
    this.status = 'waiting';
    clearTimeout(this.#timer);
    this.#timer = setTimeout(() => this.save(), SAVE_AFTER);
  }

  // One save at a time: a second one started mid-write (typing on while a slow write waits) would write script.md
  // twice at once, and two renames onto it can clash on a network share.
  save(): Promise<void> {
    return (this.#saving = this.#saving.then(() => this.#write()));
  }

  // What is typed, on disk: a save already being written is waited for (without that, History opened mid-save got
  // no entry for it, and Print or Send for review read the script before it), then what is still waiting is saved.
  async saveWaiting() {
    // Until no save is left in line: one can be queued behind the one being waited for.
    let saving: Promise<void>;
    do await (saving = this.#saving);
    while (saving !== this.#saving);
    if (this.status === 'waiting') await this.save();
  }

  async #write() {
    if (!this.dir || !this.script) return;
    clearTimeout(this.#timer);
    this.status = 'saving';
    let step = 'Reading script.md';
    try {
      const now = await readScript(this.dir);
      if (now !== this.onDisk) {
        // Someone else saved while you were typing: combine the two, row by row.
        const mine = writeScript(withAuthor($state.snapshot(this.script) as Script, this.name()));
        const newest = (await listVersions(this.dir)).at(-1);
        const theirsSynced = newest && newest.sha256 === (await sha256(now)) && newest.id !== this.last?.id;
        const who = this.editors[0] ?? (theirsSynced && newest.who !== this.name() ? newest.who : 'Someone else');
        await this.#offer(merge(this.onDisk, mine, now), {
          heading: `${who} and you both saved at the same time`, mineLabel: 'Yours', theirsLabel: this.#label(who),
          mineName: 'you', theirsName: who,
          parents: [...(this.last ? [this.last.id] : []), ...(theirsSynced ? [newest.id] : [])],
        });
        return;
      }
      this.script.front = withAuthor($state.snapshot(this.script) as Script, this.name()).front;
      // An empty section isn't written; Write removes it from the page once the cursor leaves it (AP-22).
      const kept = $state.snapshot(this.script) as Script;
      kept.blocks = kept.blocks.filter((b) => b.type === 'row' || b.title.trim() || b.note);
      const text = writeScript(kept);
      step = 'Writing script.md';
      if (text !== now) await writeScriptFile(this.dir, text);
      this.#stamp = '';
      this.problem = '';
      this.onDisk = text;
      this.#lastWritten = await sha256(text);
      await this.#record(text, false).catch(() => {});
      this.here();
      // Edits typed while saving start another save.
      if (this.status === 'saving') this.status = 'saved';
    } catch (e) {
      // Retrying can't bring back a lost OK (the browser asks only from a click), so that waits for Allow editing.
      if (!(await hasAccess(this.folder).catch(() => true))) return void (this.status = 'locked');
      const error = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
      this.problem = `${step}: ${error}`;
      this.status = 'failed';
      this.#timer = setTimeout(() => this.save(), SAVE_AFTER * 4);
    }
  }

  // Chrome and Edge take back the OK to edit the folder after the tab has been in the background a while. Checked
  // with the 5 s check and on coming back to the tab, so it shows before a save fails.
  async checkAccess(): Promise<boolean> {
    if (this.status === 'locked') return false;
    if (await hasAccess(this.folder).catch(() => true)) return true;
    clearTimeout(this.#timer);
    this.status = 'locked';
    return false;
  }

  // Allow editing (from a click): the browser asks, then what is in the page is saved.
  async allow() {
    if (!(await askAccess(this.folder).catch(() => false))) return;
    this.status = 'waiting';
    await this.save();
  }

  // The 5 s check: who else has the script open.
  async readEditors() {
    if (this.dir) this.editors = othersEditing(await readEditing(this.dir).catch(() => []), this.name());
  }

  // The 5 s check: someone else saved (OneDrive brought their change). With nothing of yours waiting, shown quietly.
  async lookOutside() {
    const dir = this.dir;
    if (!dir || this.status !== 'saved') return;
    try {
      // Read only when it changed: every read holds script.md open for a moment, and on a network share a save
      // from another computer can't replace a file someone has open.
      const stamp = await scriptStamp(dir);
      if (stamp && stamp === this.#stamp) return;
      const now = await readScript(dir);
      this.#stamp = stamp;
      if (now !== this.onDisk && this.status === 'saved') {
        this.load(now);
        // Follows their newest version, if it has synced.
        const newest = (await listVersions(dir).catch(() => [])).at(-1);
        if (newest && newest.sha256 === (await sha256(now))) this.last = newest;
      }
    } catch {
      // Mid-sync: try again next time.
    }
  }

  // Saves what is waiting, then names the version the script is: "v3" while it is still that official version, ''
  // for a draft. Print and the exports carry it (EX-7).
  async version(): Promise<string> {
    await this.saveWaiting();
    const versions = this.dir ? await listVersions(this.dir).catch(() => []) : [];
    const n = officialNumber(versions, this.onDisk);
    return n ? `v${n}` : '';
  }

  // What Send for review will make (RV-9), for its panel: saves what is waiting, then the next version or "still v2".
  async nextVersion(): Promise<{ n: number; still: boolean }> {
    await this.saveWaiting();
    return sendVersion(this.dir ? await listVersions(this.dir).catch(() => []) : [], this.onDisk);
  }
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
