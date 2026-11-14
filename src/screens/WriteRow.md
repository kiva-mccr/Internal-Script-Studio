# `src/screens/WriteRow.svelte`

One row of Write (mock-up 3): its number (a Play button while there are takes), the comment bubble and RV-15's
mark, the row tools, flag and §, the mic, the three columns (or a dot for a folded one), the take line, and the
flag's note.

- **Used by:** `screens/Write.svelte`. **Tests:** `tests/e2e/editor.spec.ts`, `format.spec.ts`, `voice.spec.ts`,
  `play.spec.ts`, `flags.spec.ts`, `visit.spec.ts`, `comments.spec.ts`.

## Rules and pitfalls

- Split out of `Write.svelte` (the user asked for the large screen files to be split): same markup and look. It edits
  its row in place (`bind:block`, a function binding in Write that sets `script.blocks[i]`) and calls `onChange`.
  Anything that changes the blocks round it (move, add, delete, §, a paste that makes rows, the mic) is a callback
  to Write. Its CSS is its own, so `.grid`, `.tools` and `.note` are also in Write for the heading and sections.
- `data-row`, `data-block` and `data-visit` stay on the row's outer element: Write, Find, the Editor and the tests
  find rows by them.
- The recording clock runs only on the row being recorded, and starts from now when recording starts.
- Row tools are placed over the number column so they never make a row taller.
- Dialogue and On screen are `TextField.svelte` (formatting toolbar, marks shown as formatting).
- The mic is its own grid column between the number and the dialogue, pulled into the gap (`translateX`), so a row
  with no take is no taller. It is drawn as an SVG in the shape the user picked, so it takes the text colour.
- A folded column's cells are not drawn at all (no hidden text fields); a grey dot marks a row with something there.
- Recording (AU-4): the mic records from the click; while `voice.cue` (the first second) a red ring fills round it and the
  line says "Getting ready…", then ■ and "● Recording". Esc then throws the take away (the Editor's keys). The ▶ shows the
  cropped length (`span`), its title how much was cut. The take line is `Take.svelte`, shared with Review.
- The mic has no `title` (no hover text) in any state: it covered the line being read (user asked twice). Its
  name is only the `aria-label`. A test checks this.
- The takes live in the Editor's `VoiceOver` (`lib/voice.svelte.ts`); a row with no id yet can't record.
- Play the script (AU-2): the Editor's `Player` says which row is playing; that row is tinted (`.here`), scrolled
  to (by Write), and its take's bar fills (a row with no take shows a grey bar and "No take yet"). A row's number is a button
  ("Play from row n") only while there is something to play (`canPlay`). It shows ▶ while the mouse is anywhere on
  the row (AU-7, CSS only: `.n` and `.go`), and ❚❚ ("Pause at row n", pauses) on the row playing. A row's own ▶ pauses the script when it
  is the row being played, so its name is "Pause row n" then: tests tell it from the top bar's "Pause the script".
- Flags (AP-9, mock-up 22): the flag button sits in the third slot of the row tools' top line (left 50px, clear of
  the mic), seen on hover and focus and always once flagged. A new flag puts the cursor in its note; the note is
  written on blur or Enter (`onchange`), not per key. "Needs a source" is offered while the note is empty. ‹ › above
  the table (Write's) step in row order (`stepped`, tinted `.stepped`). The flag's Clear has no aria-label (the flag button
  already says "Clear the flag on row n"), so tests find it inside the row. Adding a flag goes through Write (`onToggleFlag`), which focuses the new note; saving is the Editor's (`onFlag`).
- Row to section and back (AP-30, mock-up 39): § sits under the flag (`.promote`, placed like the flag), ¶ in a
  section's tools (Write's). Both are Write's (`onToSection`) and go through the Undo bar (`onDeleted`). The Undo message is worked out before the splice: after
  it the row has no number. A section turned into a row gets a fresh id (no take, flag or comments).
- Before you started (AP-38, board 54): under a changed Dialogue or On screen cell (`start`, from `lib/started.ts`), a
  grey "▸ Before you started" opens the old words, plain, in a grey box under the box (`opened`, per cell, closed at
  first; it resets when Write is left). Put it back is Write's (`onPutBack`, through the Undo bar). The buttons' and the
  box's names never contain "Dialogue, row n" or "On screen, row n": tests find the text boxes with `getByLabel`, which
  matches part of a name.
