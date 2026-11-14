// Keyboard shortcuts (AP-44, board 65): the keys for moving between rows and comments, adding, moving and deleting
// rows, matched from a key press and shown in Settings and the row buttons' hover text.
import { recall, keep } from './remember';

export type Action = 'rowDown' | 'rowUp' | 'addBelow' | 'addAbove' | 'moveDown' | 'moveUp' | 'deleteRow'
  | 'nextComment' | 'prevComment';

export const DEFAULTS: Record<Action, string> = {
  rowDown: 'Ctrl+ArrowDown',
  rowUp: 'Ctrl+ArrowUp',
  addBelow: 'Ctrl+Enter',
  addAbove: 'Ctrl+Shift+Enter',
  moveDown: 'Alt+ArrowDown',
  moveUp: 'Alt+ArrowUp',
  deleteRow: 'Ctrl+Shift+Backspace',
  nextComment: 'Alt+N',
  prevComment: 'Alt+P',
};

// A key press as "Ctrl+Alt+Shift+Key". Ctrl stands for ⌘ too. Letters and digits come from the key's place on the
// keyboard (`code`), so Alt+N is still N on a Mac, where Alt changes the letter typed.
export function comboOf(e: KeyboardEvent): string {
  const key = /^Key[A-Z]$/.test(e.code) ? e.code.slice(3) : /^Digit\d$/.test(e.code) ? e.code.slice(5)
    : e.key.length === 1 ? e.key.toUpperCase() : e.key;
  return [e.ctrlKey || e.metaKey ? 'Ctrl' : '', e.altKey ? 'Alt' : '', e.shiftKey ? 'Shift' : '', key]
    .filter(Boolean).join('+');
}

const ARROWS: Record<string, string> = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' };
const mac = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform);

// How a key reads on screen: arrows as arrows, and ⌘ for Ctrl on a Mac.
export function show(combo: string): string {
  return combo.split('+').map((part) => ARROWS[part] ?? (part === 'Ctrl' && mac ? '⌘' : part)).join('+');
}

const STORE = 'shortcuts';

class Shortcuts {
  // Keys changed in this browser, over the defaults.
  changed = $state<Partial<Record<Action, string>>>(read());

  key(action: Action): string {
    return this.changed[action] ?? DEFAULTS[action];
  }

  // The action a key press stands for, among those asked about.
  match(e: KeyboardEvent, among: Action[]): Action | undefined {
    const combo = comboOf(e);
    return among.find((action) => this.key(action) === combo);
  }

  // A row button's hover text with its key: "Delete · Ctrl+Shift+Backspace".
  title(text: string, action: Action): string {
    return `${text} · ${show(this.key(action))}`;
  }
}

function read(): Partial<Record<Action, string>> {
  try {
    const saved = JSON.parse(recall(STORE) || '{}');
    return Object.fromEntries(Object.entries(saved).filter(([a, k]) => a in DEFAULTS && typeof k === 'string'));
  } catch {
    return {};
  }
}

export const shortcuts = new Shortcuts();
export const saveShortcuts = () => keep(STORE, JSON.stringify(shortcuts.changed));

// Alt+N / Alt+P (AP-44): the open comment after or before the one being read, in the order shown, going round at
// the ends; undefined when the key is not one of them. Only moves: replying and deciding stay clicks (the user's rule).
export function stepComment(e: KeyboardEvent, ids: string[], active: string): string | undefined {
  const action = shortcuts.match(e, ['nextComment', 'prevComment']);
  if (!action || !ids.length) return undefined;
  e.preventDefault();
  const by = action === 'nextComment' ? 1 : -1;
  const at = ids.indexOf(active);
  return ids[at < 0 ? (by > 0 ? 0 : ids.length - 1) : (at + by + ids.length) % ids.length];
}
