// Hide help text (AP-43, board 64): a switch in Settings, off by default and kept in this browser. Turned on, every
// element marked class="help" (the grey lines that explain how a feature works) is hidden by one rule in app.css,
// through a class on <html>, so no screen needs to know about the setting.
import { keep, recall } from './remember';

const KEY = 'hide-help';
const CLASS = 'help-off';

export function helpHidden(): boolean {
  return recall(KEY) === 'on';
}

export function hideHelp(on: boolean): void {
  keep(KEY, on ? 'on' : '');
  applyHelp();
}

// Called once when the app starts, and on every change.
export function applyHelp(): void {
  document.documentElement.classList.toggle(CLASS, helpHidden());
}
