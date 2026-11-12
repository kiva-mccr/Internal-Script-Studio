// Play the script (AU-2, mock-up 14): the rows in order, each for as long as its take, with the take's sound. A row
// with no take waits in silence for its read time, so the timing stays true (the user's choice over skipping it).
import { countWords } from './readtime.svelte';
import { rows, type Script } from './script';
import { takeFile, type Take } from './voice.svelte';

// One row's turn: how long it lasts, whether it has a take to hear, and when it starts (seconds from the top).
export type Step = { id: string; seconds: number; take: boolean; start: number };

// The rows to play, in order. A row with no take lasts its dialogue's read time at `speed` words a minute; a row
// with no take and no dialogue is skipped. No gap between rows, like the exported voice-over.
export function plan(script: Script, takes: Record<string, Take>, speed: number): Step[] {
  const steps: Step[] = [];
  let start = 0;
  for (const row of rows(script)) {
    const take = takes[row.id];
    const seconds = take ? take.seconds : (countWords(row.dialogue) / speed) * 60;
    if (!(seconds > 0)) continue;
    steps.push({ id: row.id, seconds, take: !!take, start });
    start += seconds;
  }
  return steps;
}

const TICK = 100; // ms between looks at how far it has played

// Plays a plan. Kept as state: the Editor makes one, the top bar shows its time and Write tints its row.
export class Player {
  steps = $state.raw<Step[]>([]);
  i = $state(-1); // the step being played, -1 when stopped
  on = $state(false); // playing (not paused)
  elapsed = $state(0); // seconds into the step
  #dir: FileSystemDirectoryHandle | null = null;
  #audio: HTMLAudioElement | null = null;
  #url = '';
  #timer: ReturnType<typeof setInterval> | undefined;
  #last = 0; // when the silent clock was last read (ms)
  #turn = 0; // goes up with every step and stop, so a take that loads late is dropped

  get started() { return this.i >= 0; }
  get row() { return this.steps[this.i]?.id ?? ''; }
  get total() { const last = this.steps.at(-1); return last ? last.start + last.seconds : 0; }
  // Seconds from the top, and how far through the row (0 to 1).
  get time() { const step = this.steps[this.i]; return step ? step.start + Math.min(this.elapsed, step.seconds) : 0; }
  get at() { const step = this.steps[this.i]; return step ? Math.min(1, this.elapsed / step.seconds) : 0; }

  async start(dir: FileSystemDirectoryHandle, steps: Step[], from = 0) {
    this.stop();
    if (!steps[from]) return;
    this.#dir = dir;
    this.steps = steps;
    this.on = true;
    this.#timer = setInterval(() => this.#tick(), TICK);
    await this.#go(from);
  }

  // Pause, or carry on from where it paused.
  toggle() {
    if (!this.started) return;
    this.on = !this.on;
    this.#last = performance.now();
    if (this.on) this.#audio?.play().catch(() => this.#silent());
    else this.#audio?.pause();
  }

  stop() {
    this.#turn++;
    clearInterval(this.#timer);
    this.#drop();
    this.i = -1;
    this.on = false;
    this.elapsed = 0;
  }

  async #go(i: number) {
    const step = this.steps[i];
    if (!step || !this.#dir) return this.stop();
    const turn = ++this.#turn;
    this.#drop();
    this.i = i;
    this.elapsed = 0;
    this.#last = performance.now();
    if (!step.take) return;
    try {
      const url = URL.createObjectURL(await takeFile(this.#dir, step.id));
      if (turn !== this.#turn) return URL.revokeObjectURL(url);
      const audio = new Audio(url);
      audio.onended = () => turn === this.#turn && this.#go(i + 1);
      audio.onerror = () => turn === this.#turn && this.#silent();
      this.#audio = audio;
      this.#url = url;
      if (this.on) await audio.play();
    } catch {
      // A take that isn't there (still syncing) or can't be played: its length passes in silence.
      if (turn === this.#turn) this.#silent();
    }
  }

  #silent() {
    this.#drop();
    this.#last = performance.now();
  }

  #drop() {
    if (this.#audio) {
      this.#audio.onended = this.#audio.onerror = null;
      this.#audio.pause();
    }
    this.#audio = null;
    if (this.#url) URL.revokeObjectURL(this.#url);
    this.#url = '';
  }

  // A take ends when its sound does; a silent row when its time is up.
  #tick() {
    const step = this.steps[this.i];
    if (!step || !this.on) return;
    if (this.#audio) {
      this.elapsed = this.#audio.currentTime;
      return;
    }
    const now = performance.now();
    this.elapsed += (now - this.#last) / 1000;
    this.#last = now;
    if (this.elapsed >= step.seconds) this.#go(this.i + 1);
  }
}
