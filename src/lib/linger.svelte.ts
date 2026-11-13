// Cards kept in place with Undo for a few seconds after they are decided, resolved or put on hold (RV-18, RV-19),
// each on its own timer, then let go to move into Resolved or On hold.

export class Linger {
  ids = $state<string[]>([]);
  #timers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(private wait = 5000) {}

  has(id: string) {
    return this.ids.includes(id);
  }

  // Again for the same one starts a new wait.
  add(id: string) {
    clearTimeout(this.#timers.get(id));
    this.ids = [...this.ids.filter((r) => r !== id), id];
    this.#timers.set(id, setTimeout(() => (this.#timers.delete(id), (this.ids = this.ids.filter((r) => r !== id))), this.wait));
  }

  clear() {
    this.#timers.forEach(clearTimeout);
  }
}
