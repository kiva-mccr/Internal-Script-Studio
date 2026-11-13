// Which of the script's three columns print (EX-16, board 38), and how wide each printed column is.
export type Column = 'dialogue' | 'screen' | 'files';
export const COLUMNS: { id: Column; name: string }[] = [
  { id: 'dialogue', name: 'Dialogue' },
  { id: 'screen', name: 'On screen' },
  { id: 'files', name: 'Images & files' },
];

// Widths in % of the page, # column included. `hidden` is in the order the columns were unticked: the first one's
// room goes to Dialogue, the next one's to the Notes column, taking turns (the user's rule); with neither printing,
// to the first column that prints.
export function widths(hidden: Column[], notes: boolean): { num: number; notes: number } & Record<Column, number> {
  const w = notes ? { num: 4, dialogue: 29, screen: 23, files: 22, notes: 22 } : { num: 4, dialogue: 38, screen: 32, files: 26, notes: 0 };
  const takers = [!hidden.includes('dialogue') && 'dialogue', notes && 'notes'].filter((t): t is 'dialogue' | 'notes' => !!t);
  const first = COLUMNS.find((c) => !hidden.includes(c.id))?.id ?? 'dialogue';
  hidden.forEach((c, i) => {
    w[takers.length ? takers[i % takers.length] : first] += w[c];
    w[c] = 0;
  });
  return w;
}

// Remembered as the hidden columns in order ("files,screen"), so a new browser prints all three. One always prints.
export function readHidden(kept: string): Column[] {
  const hidden = [...new Set(kept.split(','))].filter((c): c is Column => COLUMNS.some((k) => k.id === c));
  return hidden.length < COLUMNS.length ? hidden : hidden.filter((c) => c !== 'dialogue');
}
