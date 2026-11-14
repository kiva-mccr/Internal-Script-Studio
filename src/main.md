# `src/main.ts` and `src/app.css`

`main.ts` applies Hide help text (`lib/helptext.ts`, AP-43) and mounts `App.svelte`. `app.css` holds the page basics, the colour variables (`--ink`, `--muted`,
`--line`, `--accent`, …, taken from the mock-ups) and the two buttons used everywhere (`.primary`, `.link`).

## Rules and pitfalls

- `html` keeps the scrollbar's room (`scrollbar-gutter: stable`, asked by the user), so the top bar doesn't shift
  sideways when a tab is too short to scroll. Headless Chromium hides scrollbars, so `tests/e2e/scrollbar.spec.ts`
  turns them back on to measure it.
- `:root.help-off .help` hides help text (AP-43); see `lib/helptext.md` for what counts as help.
