// The line before you started (AP-38, board 54): each row's words as they were when the script was opened, so Write
// can show them under a cell you have changed. Someone else's change moves that row's words along, so only your own
// changes show; rows you add have none.
import { SvelteMap } from 'svelte/reactivity';
import { parseScript, rows, type Row, type Script } from './script';

export type Words = { dialogue: string; onScreen: string };

const words = (row: Row): Words => ({ dialogue: row.dialogue, onScreen: row.onScreen });

export class Started {
  rows = new SvelteMap<string, Words>();

  // On opening: the page's rows (their ids are given on loading, so even a hand-written row has one).
  take(script: Script) {
    this.rows.clear();
    for (const row of rows(script)) if (row.id) this.rows.set(row.id, words(row));
  }

  // Someone else's change, from the shared text `before` to `after`: where it changed a row's Dialogue or On screen,
  // that is the row's "before" now; a row they added starts with their words.
  follow(before: string, after: string) {
    if (before === after) return;
    const old = new Map(rows(parseScript(before)).map((row) => [row.id, row]));
    for (const row of rows(parseScript(after))) {
      if (!row.id) continue;
      const was = old.get(row.id);
      const kept = this.rows.get(row.id);
      if (!was) {
        if (!kept) this.rows.set(row.id, words(row));
      } else if (kept && (was.dialogue !== row.dialogue || was.onScreen !== row.onScreen)) {
        this.rows.set(row.id, {
          dialogue: was.dialogue !== row.dialogue ? row.dialogue : kept.dialogue,
          onScreen: was.onScreen !== row.onScreen ? row.onScreen : kept.onScreen,
        });
      }
    }
  }
}
