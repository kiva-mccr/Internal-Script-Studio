# `src/lib/helptext.ts`

Hide help text (AP-43, board 64): `helpHidden`, `hideHelp` (the Settings tick box) and `applyHelp` (run once in
`main.ts`). Kept in this browser under `hide-help`. Turned on, `<html>` gets the class `help-off`, and one rule in
`app.css` hides every element marked `class="help"`.

- **Used by:** `main.ts`, `screens/Settings.svelte`. **Tests:** `tests/e2e/helptext.spec.ts`.

## Rules and pitfalls

- A new line that explains how a feature works gets `class="help"` (on the element, or a `<span class="help">`
  around the explaining part of an empty screen's text, so the short fact stays: "No history yet.").
- Never mark as help: errors and warnings, a line that says why something can't be done right now (the mic hint
  before Chrome may use the mic), the line under Hide help text itself, the tour, hover titles, "Kept in this
  browser only.", or a line with a button in it ("Use 160").
- The app.css rule uses `!important` so a screen's own scoped `display` (flex on a hint) can't win over it.
