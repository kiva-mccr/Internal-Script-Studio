# `src/screens/Header.svelte`

The bar at the top of a script: the folder name (back to the list), the title and the save status beside it, the Write · Review · History · Assets
switch with the number of open comments and of missing files, "… is editing", the review buttons (Send for review, Send back to writer,
Approve), Play (AU-2: ▶ Play, then the time and ■, shown in Write once a row has a take), the voice-over total (short: "3 of 4 · 0:14"), and two menus (asked by the user, to keep the bar short): Export / Share, with Share (Copy link,
Copy for Teams, EX-10) above Export (Print… with its choices, Fountain, Final Draft, Voice-over and later exports), and ⋯ with Teleprompter and Settings (AU-3, `Settings.svelte`).

- **Used by:** `screens/Editor.svelte`. **Tests:** `tests/e2e/editor.spec.ts`, `review.spec.ts`, `print.spec.ts`,
  `conflict.spec.ts`, `settings.spec.ts`.

## Rules and pitfalls

- One menu is open at a time (`menu`). It closes on Esc, on a click outside both menus, after choosing, and a
  moment after a copy (the item says "Link copied" or "Copied, paste it in Teams"; a failed copy says so in the menu).
  Tests open ⋯ with the "More" button, and Print with "Export" (it matches "Export / Share") then "Print…".
- Copy link copies `shareLink(location.href)`, which opens on Review (RV-10).
- Copy for Teams hands the clipboard promises (`ClipboardItem`) and asks `onShare` for the text, so the click still
  counts while the Editor saves and reads History. The text itself is `lib/share.ts`.
- A new export goes in the Export menu, and `onExport` grows a new `to`.

- It only shows and asks: switching tabs, the status and printing are done by `Editor.svelte` (`onMode`,
  `onStatus`, `onPrompt`, `onPrint`, `onExport`, `onPlay`, `onStop`), which saves what is waiting first.
- The button names contain "Write" (Send back to writer), so tests pick the Write tab with `exact: true`.
- Print's choices (notes column, notes space, text size) are remembered with `recall`/`keep` (`lib/remember.ts`).
- While the script plays, the bar is `position: sticky` (`.pinned`) so Pause and ■ stay in view as the page follows
  the rows; it then covers Write's sticky column headings, which is fine for that while.
  It also covers the top of `main`, so a test must not click there to leave a text field while playing (`play.spec.ts`
  blurs instead).
- While the browser's OK to edit the folder is lost (`status` 'locked', mock-up 18 option A), the status reads "Not
  saved: the browser needs your OK to edit the folder" with an Allow editing button (`onAllow`). That is too long
  for one line beside the tabs, so the breadcrumb stops shrinking (`.crumbs.locked`) and the bar wraps (a click on
  the button was being caught by the tabs when it overlapped them).
- The save status sits beside the title (AP-16, the user's pick from mock-up 17), not among the buttons. At 1280 px
  the bar stays on one line with Send for review, Play, the total and Export / Share: the title shortens with "…"
  (`.crumbs` shrinks, down to its 280 px basis, and then the bar wraps rather than squash the name to a stub). With
  "… is editing" too it wraps. `editor.spec.ts` measures this; CI installs Inter so it measures the app's own font.
