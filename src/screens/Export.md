# `src/screens/Export.svelte`

The export screen (EX-9, board 27): opened from an item under Export in Export / Share, in place of the script.
Formats on the left (Print / PDF, Fountain, Final Draft, Voice-over), the real result in the middle, settings and
Print… or Save on the right. Back to the script, the title in the breadcrumb, or Esc returns.

- **Used by:** `screens/Editor.svelte` (`openExport`, which saves what is waiting and works out the version first).
  **Tests:** `tests/e2e/export.spec.ts`, `print.spec.ts`, `editor.spec.ts`, `voice.spec.ts`.

## Rules and pitfalls

- The preview is drawn from the same code as the file: Print is `Print.svelte` with `onScreen`, Fountain shows the
  text `toFountain` gives, voice-over plays the WAV that Save writes. Only the "screenplay look" (`look` snippet)
  is drawn here, roughly as the apps show it, and must follow `lib/fountain.ts` and `lib/fdx.ts` when they change.
- Settings are remembered with `keep`/`recall`: Print keeps its keys from before (`print-notes`, `print-lines`,
  `print-line-count` (EX-15, 2 to 8, kept while the lines are off), `print-scale`, `print-hide` for EX-16's hidden columns, in the order they were unticked, and `print-page`, "landscape" or empty (EX-18)); the others are JSON (`export-fountain`, `export-fdx`, `export-voice`), merged over the defaults so a
  setting added later gets its default. Defaults are what the exports did before EX-9.
- Final Draft's one checkbox, "Row numbers and files", sets both `numbers` and `files` (board 27 drew one).
- Voice-over takes are decoded once, the first time the format is picked; the settings only line them up again
  (`lineUp`, `join`), so ticking a box doesn't decode again. Silence for a row lasts its read time at the speaking
  speed (Settings). A row in the list plays the file from where that row starts.
- Esc goes back, but not from a text field (the speaker name).
- Printing still goes through the Editor (`onPrint`): it mounts the real `Print.svelte` at the top level, which
  the print CSS needs. The preview's own Print sits inside this screen, hidden when printing.
- Print's preview is drawn at the printed width (a Letter page less Print's margins: 725 px, 965 px landscape) and
  shrunk with `zoom` to fit the box, so the columns wrap as they will on paper. Change both if Print's margins change.
- Messages (no takes, takes that can't be read) are shown in the preview, not as the Editor's toasts.
- The Credits switch (AP-31) is one setting for Print, Fountain and Final Draft (`printing.credits`, kept as
  `export-credits`), shown only when the script has credits.
