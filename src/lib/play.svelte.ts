// Play the script (AU-2, mock-up 14): the rows in order, each for as long as its take, with the take's sound. A row
// with no take waits in silence for its read time, so the timing stays true (the user's choice over skipping it).
import { countWords } from './readtime.svelte';
import type { Row, Script } from './script';
import { layout } from './timeline';
import { Sound, takeFile, takeLength, type Take } from './voice.svelte';

// One turn: a row (its id), or a hold or placeholder after one (SB-1: "hold:<id>", "placeholder:<id>", always
// silent); how long it lasts, whether it has a take to hear, and when it starts (seconds from the top).
export type Step = { id: string; seconds: number; take: boolean; start: number };

// What plays, in order: the storyboard timeline's blocks (lib/timeline.ts layout), so the two always agree. A row
// with no take lasts its dialogue's read time at `speed` words a minute; a row with no take and no dialogue is
// skipped. No gap between rows, like the exported voice-over.
export function plan(script: Script, takes: Record<string, Take>, speed: number): Step[] {
  const length = (row: Row) => {
    const take = takes[row.id];
    return take ? { seconds: takeLength(take), take: true } : { seconds: (countWords(row.dialogue) / speed) * 60, take: false };
  };
  return layout(script, length).blocks.map((b) => ({ id: b.id, seconds: b.seconds, take: b.kind === 'row' && b.take, start: b.start }));
}

const TICK = 100; // ms between looks at how far it has played

// Plays a plan. Kept as state: the Editor makes one, the top bar shows its time and Write tints its row.
export class Player {
  steps = $state.raw<Step[]>([]);
  i = $state(-1); // the step being played, -1 when stopped
  on = $state(false); // playing (not paused)
  elapsed = $state(0); // seconds into the step
  #dir: FileSystemDirectoryHandle | null = null;
  #takes: Record<string, Take> = {};
  #sound: Sound | null = null;
  #timer: ReturnType<typeof setInterval> | undefined;
  #last = 0; // when the silent clock was last read (ms)
  #turn = 0; // goes up with every step and stop, so a take that loads late is dropped

  get started() { return this.i >= 0; }
  get row() { return this.steps[this.i]?.id ?? ''; }
  get total() { const last = this.steps.at(-1); return last ? last.start + last.seconds : 0; }
  // Seconds from the top, and how far through the row (0 to 1).
  get time() { const step = this.steps[this.i]; return step ? step.start + Math.min(this.elapsed, step.seconds) : 0; }
  get at() { const step = this.steps[this.i]; return step ? Math.min(1, this.elapsed / step.seconds) : 0; }

  async start(dir: FileSystemDirectoryHandle, steps: Step[], from = 0, takes: Record<string, Take> = {}) {
    this.stop();
    if (!steps[from]) return;
    this.#dir = dir;
    this.#takes = takes;
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
    if (this.on) this.#sound?.play().catch(() => this.#silent());
    else this.#sound?.pause();
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
      const file = await takeFile(this.#dir, step.id);
      if (turn !== this.#turn) return;
      const sound = await Sound.open(file, this.#takes[step.id] ?? { by: '', at: 0, seconds: step.seconds, text: '' });
      if (turn !== this.#turn) return sound.close();
      sound.onended = () => turn === this.#turn && this.#go(i + 1);
      this.#sound = sound;
      if (this.on) await sound.play();
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
    this.#sound?.close();
    this.#sound = null;
  }

  // A take ends when its sound does; a silent row when its time is up.
  #tick() {
    const step = this.steps[this.i];
    if (!step || !this.on) return;
    if (this.#sound) {
      this.elapsed = this.#sound.time;
      return;
    }
    const now = performance.now();
    this.elapsed += (now - this.#last) / 1000;
    this.#last = now;
    if (this.elapsed >= step.seconds) this.#go(this.i + 1);
  }
}
