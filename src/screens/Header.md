# `src/screens/Header.svelte`

The bar at the top of a script: a folder icon (back to the list, AP-27), the title, and the save status and length beside it, the Write · Review · History · Assets
switch with the number of open comments and of missing files, "… is editing", the review buttons (Send for review, Send back to writer,
Approve), Play (AU-2: ▶ Play, then the time and ■, shown in Write once a row has a take), and two menus (asked by the user, to keep the bar short): Export / Share, with Share (Copy link,
Copy for Teams, EX-10) above Export (Print…, Fountain, Final Draft, Voice-over and later exports, each opening the export screen, EX-9), and ⋯ with Find and replace (Write only, AP-32), Teleprompter, Credits (AP-31, `Credits.svelte`, mounted by the Editor) and Settings (AU-3, `Settings.svelte`).

- **Used by:** `screens/Editor.svelte`. **Tests:** `tests/e2e/editor.spec.ts`, `review.spec.ts`, `print.spec.ts`,
  `conflict.spec.ts`, `settings.spec.ts`.

## Rules and pitfalls

- One menu is open at a time (`menu`). It closes on Esc, on a click outside both menus, after choosing, and a
  moment after a copy (the item says "Link copied" or "Copied, paste it in Teams"; a failed copy says so in the menu).
  Tests open ⋯ with the "More" button, and an export with "Export" (it matches "Export / Share") then its item.
- Copy link copies `shareLink(location.href)`, which opens on Review (RV-10).
- Copy for Teams hands the clipboard promises (`ClipboardItem`) and asks `onShare` for the text, so the click still
  counts while the Editor saves and reads History. The text itself is `lib/share.ts`.
- A new export goes in the Export menu and in `Export.svelte`'s formats (`Format`).

- Approve with something still open (`loose`: comments, suggestions, missing files) opens a panel under it, like the
  menus (mock-up 20, RV-5): each line goes to that item (`onLoose`), Keep reviewing or Esc closes, Approve anyway
  approves with the History note "Approved, N still open". It warns and never blocks; nothing open approves at once.
- Send for review opens a panel under it with a note for the reviewers (RV-8, mock-up 26), like Approve's: optional,
  focused on opening; Cancel or Esc closes it and keeps the note (`sendNote`) until sent or the page is left. Its
  region and its button are both named "Send for review": tests pick the button inside the region. Opening it asks
  `nextVersion` and then says "It becomes v3 in History." or "Still v2: …" (RV-9); the Editor makes the version.
- Send back to writer opens the same kind of panel with a note for the writer (RV-13); it tops Write's Comments tab.
  Its region and button are both named "Send back to writer": tests pick the button inside the region.
- Send for review shows only in Write (asked by the user); Review has Send back to writer and Approve, and History
  and Assets show neither. Tests that send for review go to Write first.
- It only shows and asks: switching tabs, the status and exports are done by `Editor.svelte` (`onMode`,
  `onStatus`, `onPrompt`, `onExport`, `onPlay`, `onStop`), which saves what is waiting first.
- The button names contain "Write" (Send back to writer), so tests pick the Write tab with `exact: true`.
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
- The length (AP-12: "0:25", or with takes "0:14/0:35") follows the save status in the breadcrumb, "Saved · 0:25"
  (AP-27, mock-up 30 option A; the user dropped "1 of 5"). The "· " is drawn by CSS so `.voice`'s text is just the
  time, which the tests read. It is hidden while the status is red (`bad`), so the warning is never pushed off.
- The folder is only an icon: its name is in `aria-label` and `title` ("Back to Video Scripts"); tests click the link
  by that name (a part match on "Video Scripts" still finds it).
- A failed save shows the browser's error name in the bar and all of it on hover (`problem`, FX-1), so the user can
  report what a real shared folder said.
- While someone's changes are being folded in (`folding`, FX-2), a small spinner shows inside "… is editing" (the
  user's ask), with "Bringing in Ana's changes" for screen readers and on hover.
- `heldCount` (RV-19): with comments on hold, the Send for review box says they come back into the open list.
