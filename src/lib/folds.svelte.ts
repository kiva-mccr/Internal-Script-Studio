// Columns folded away to a thin strip (AP-17 in Write, RV-23 in Review): which are folded, remembered in this browser
// for every script under the screen's own key, never in the script.
import { keep, recall } from './remember';

export type Column = 'dialogue' | 'screen' | 'files';
export const COLUMNS: { key: Column; name: string }[] = [
  { key: 'dialogue', name: 'Dialogue' },
  { key: 'screen', name: 'On screen' },
  { key: 'files', name: 'Images & files' },
];

export class Folds {
  folded = $state(new Set<Column>());

  constructor(private key: string) {
    const stored = new Set(recall(key).split(',').filter((c): c is Column => COLUMNS.some((col) => col.key === c)));
    // Never all three: the last one open has no fold button, and a stored "all folded" opens Dialogue again.
    if (stored.size === COLUMNS.length) stored.delete('dialogue');
    this.folded = stored;
  }

  has = (key: Column) => this.folded.has(key);

  toggle = (key: Column) => {
    const next = new Set(this.folded);
    if (!next.delete(key)) next.add(key);
    this.folded = next;
    keep(this.key, [...next].join(','));
  };

  open = (key: Column) => {
    if (this.folded.has(key)) this.toggle(key);
  };

  // The grid's columns: `lead` (the number and so on) then each column at its share, or a 28px strip when folded.
  grid(lead: string, fr: [number, number, number]): string {
    return `${lead} ${COLUMNS.map((c, i) => (this.folded.has(c.key) ? '28px' : `minmax(0, ${fr[i]}fr)`)).join(' ')}`;
  }
}
