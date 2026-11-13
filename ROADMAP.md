# P2P Script Studio roadmap

Every step, what was asked, what was built and what was picked, and the decisions. `[x]` built, `[ ]` planned,
`[-]` on hold, `[?]` a tentative idea, not planned. IDs are stable: tick `[x]` as steps land and never renumber.

Goal: a free web app where a small team writes three-column educational video scripts, reviews them with comments
and suggestions, keeps every version, and exports them for production.

### Guardrails (promises, not suggestions)

- Minimalist: easy to use and to understand where you are. Navigation is the folder name (back to the list) and
  one switch: Write · Review · History. No sidebars, no nested menus.
- Free to run: GitHub Pages only. No server, no database, no sign-in, no paid service.
- Private content: scripts and assets stay in the team's OneDrive folder, never in this (public) repo, never
  uploaded anywhere. Captions run in the browser.

### Constraints that shape the plan

- A web page can only open a folder the person picks (File System Access API): Chrome and Edge on desktop only. The
  browser remembers the pick; a link carries the script's path inside that folder (`#/Episode-03`).
- OneDrive syncs in seconds to minutes, not live: saves are separate small files so two people rarely collide.
- Git cannot live inside a synced OneDrive folder, so the app keeps its own history files.

## Phase 1: script format

- [x] **SF-1** The script format: three-column Markdown (dialogue, on screen, images and files), rows numbered per
  shot, front matter (title, status, authors), asset references. A short spec and one sample script.
  Built: docs/script-format.md and a made-up example (docs/example/). The user picked one section per row
  (`## 1 <!-- id: … -->` with `Dialogue:`, `On screen:`, `Files:` labels) over a Markdown table, which cannot hold
  several paragraphs in a cell. Optional `# ` sections group rows. One folder per script (`script.md`, `assets/`,
  `.studio/`). Row ids keep comments and history attached when rows move; numbers are renumbered on save.
- [x] **SF-2** The folder layout: each save and each comment as its own file, the "… is editing" marker, and how a
  change made outside the app (Notepad, a deleted history folder) is spotted and logged in History.
  Built: docs/studio-folder.md. Files in `.studio/` are written once, never edited (`editing/` aside). Versions
  are full copies with parents and a fingerprint; an entry at most every 5 minutes of editing plus on leaving,
  review, restore and merge (the user agreed). Outside changes and a deleted `.studio/` get their own entries.
  Conflicts (two newest versions, or OneDrive's `script-*.md` copies) are merged row by row. "… is editing"
  refreshes every 30 s and is ignored after 2 min. Comments, replies and suggestions are one file each; resolve,
  accept and reject are new files about them. Your name is typed once per computer.

## Phase 2: the core app

- [x] **AP-1** Set-up: stack, tests, GitHub Pages deploy, CI that skips docs-only pushes.
  Built: Svelte 5 + TypeScript with Vite (picked by default: small and readable; React and plain JS offered);
  Vitest for logic, Playwright for the app in Chromium; tests.yml and deploy.yml skip `.md` and docs-only pushes.
  A placeholder page reads the link (`#/Episode%2003`) through src/lib/route.ts.
- [x] **AP-2** First-time screen: OneDrive set-up instructions ("Add shortcut to My files"), pick the folder,
  remember it.
  Built as mock-up 1 plus what was proposed: a name field (kept in the browser), "Before you start" folded under
  the button, a Chrome-or-Edge note for other browsers, and a "Welcome back" one-click screen when the browser
  asks for permission again. "Change folder" in the header goes back. The user approved building on to an MVP
  (AP-2 to AP-5) unattended, merging once checks pass.
- [x] **AP-3** Open a script from a link.
  Built: `#/<script folder>` opens that script, also straight after set-up; Copy link in the editor; a link to a
  script that is not there says so (renamed, or not synced yet).
- [x] **AP-4** The script list: name, status, last edited by and when.
  Built as mock-up 2: title (or folder name), status dot, when, newest first; New script (makes the folder and a
  `script.md` with one empty row); re-read when the window gets focus. Not yet: "by whom", which needs History's
  files (AP-6). Picking one script's folder by mistake is explained.
- [x] **AP-5** The three-column editor: edit, add, move and remove rows, link assets, autosave.
  Built as mock-up 3, without the Write · Review · History switch and Export until those exist. Sections can be
  renamed, added, moved and deleted. Files: choose a file (copied into `assets/`), paste a link, or describe it.
  Saves 1.5 s after typing stops; adds you to `authors`. Someone else's save shows up on its own; if you had
  changes waiting, it asked "theirs or mine" (replaced by the row-by-row merge in AP-7). No history entries yet (AP-6).
  The column headings stay at the top while scrolling, and there are no browser dialogs: deleting shows Undo,
  messages sit at the bottom of the window; images show a thumbnail in the Images & files column (all asked by
  the user after the MVP).
- [x] **AP-6** History: every save, who and when, what changed, restore; outside changes logged.
  Built as mock-up 5 with a Write · History switch (Review joins it in RV-1). Entries as SF-2 says: at most every 5
  minutes of editing, on leaving the script or opening History, on restore; a new script's first version; a
  script.md that doesn't match the newest version is logged "Changed outside the app". A script with no history
  starts with "History starts here" (wording changed from "started again", since scripts made before AP-6 have
  none). The list now shows who edited last. Not yet: History for comments (RV).
- [x] **AP-7** "… is editing" and conflict resolution: colliding saves shown side by side, pick per row.
  Built as mock-up 6. Saves at the same time are combined row by row (rows matched by id); only a field both people
  changed is shown side by side to pick, then saved as a "merge" version with both as parents. Caught three ways:
  on saving over someone's change, two newest versions on opening, and a OneDrive copy beside script.md (removed
  once combined). "Sam is editing" shows in the header from `.studio/editing/`; a closed laptop's last save is
  credited to its owner. Picks are per field (dialogue, on screen, files), finer than per row.
- [ ] **AP-8** Citations (asked by the user): attach a source to what a row says or shows (title, author or
  publisher, link, date), numbered in the row and gathered into a Sources list at the end of the script; exports
  carry them (print, the video description). The format change (SF-1) and the look are agreed before building.
  When built, a "Needs a source" flag (AP-9) clears itself once its row gets a source.
- [x] **AP-9** Flags (asked by the user): a writer flags a row to come back to, with an optional note ("check this
  fact"); flagged rows are marked in the editor, counted in the list, and can be stepped through and cleared. Where
  a flag is stored (in `script.md` or `.studio/`) and the look are agreed before building. Refined (the user
  agreed): built together with AP-8, with a "needs a source" flag that clears itself when a citation is attached,
  so fact-checking is a list to step through. Built as mock-up 22 (the user picked "Build now, as drawn", before
  AP-8, with the suggested choices): flags are `flag` / `unflag` notes in `.studio/comments/`, never in script.md
  (no History version, no clash, not in exports); the flag button under a row's number shows on hover and focus,
  with an optional note and a "Needs a source" quick note; ‹ › above the table steps through them; Review shows them
  without buttons; the list says "2 flagged"; they come first in the check before Approve. "Needs a source" clearing
  itself waits for AP-8.
- [x] **AP-10** Official versions (asked by the user): publish a named, numbered version (v1, v2 …) from History;
  History shows official versions and folds the small saves between them into one line until opened. Mock-up:
  board 7. Built as drawn (the user picked "Yes, as drawn", not also on Approved): a version of kind `official`
  named by the person; numbers come from publish order. History opens on the newest official version, which is
  compared with the one before it.
- [x] **AP-11** Formatting (asked by the user): bold, italic, underline, strikethrough, links, LaTeX equations and
  clear formatting, from a small toolbar over selected text (and Ctrl+B, I, U, K). Kept as plain marks in
  script.md (`**bold**`, `*italic*`, `<u>underline</u>`, `~~strike~~`, `[link](…)`, `$equation$`), shown as formatting
  when not being typed in. Mock-up: board 8. Built as drawn (the user: "perf"), before RV-2: the toolbar appears
  over selected text; Review and History show formatting too. Equations use KaTeX, loaded only when a script has
  one. Comment quotes are marked with the browser's highlights, so a quote can cross formatting.
- [x] **AP-12** Read time (suggested, the user agreed): the word count as minutes, for each section and the whole
  script, at a speaking speed the person sets. Later feeds the teleprompter (EX-2), SRT (EX-5) and storyboard
  timings (SB-1). The look is agreed before building. Also asked by the user: the script list shows each script's
  length, the read time or, where every row has a take, the recorded voice-over's length.
  Mock-up: board 21, agreed with the extras and one change (the user: top bar "1 of 6 · 0:04/13:42"). Built: each
  section's read time at the right of its title (Write and Review), dialogue only; the top bar shows the whole
  length, "0:25", or with takes "1 of 6 · 0:04/0:25" (since AP-27 "0:04/0:25", beside Saved; the whole is takes plus read time for the rest, as Play times
  it). Settings > Read time sets the speaking speed (− +, 60 to 400, kept in this browser), the same speed as the
  teleprompter, Play and Copy for Teams, and offers "Use N", the takes' average speed. The script list's Length
  column: read time, or the recorded length with a mic once every row has a take.
- [x] **AP-13** Paste a draft (suggested, the user agreed): pasting several paragraphs into Dialogue makes one row
  for each paragraph (drafts written in Word). Built: each line of the pasted text is a paragraph (blank lines and
  spaces around them dropped); the first goes where the cursor is, the others get new rows below, and what followed
  the cursor ends the last one. One line pastes as usual. The Undo bar ("Pasted as n rows.") puts it back.
- [x] **AP-14** Keyboard flow (suggested, the user agreed): Tab between cells, Ctrl+Enter for a new row below,
  Alt+Up / Alt+Down to move a row, so writing never needs the mouse.
  Built: Tab and Shift+Tab go between the text boxes only (section titles, Dialogue, On screen), past the row's
  buttons and files; Ctrl+Enter adds a row below (or a section's first row, from its title) and puts the cursor in it;
  Alt+Up / Alt+Down move the row (or section) and the cursor stays where it was.
- [ ] **AP-15** New script from a template (suggested, the user agreed): New script can start as a copy of a script
  the person picks (its sections and rows, not its history or comments). The look is agreed before building.
- [x] **AP-16** A better place for the save status (asked by the user: where it sat, between Send for review and
  Export, "felt awkward and not matching"). Three places mocked up (board 17); the user picked A: the status sits
  right after the script's name, like Word and Google Docs. The voice-over total shortens to "3 of 4 · 0:14" and stays
  with the buttons. At 1280 px the bar keeps to one line with Send for review, Play, the total and Export / Share,
  the name shortening with "…"; with "… is editing" as well it wraps to two clean lines rather than squash the name.
- [x] **AP-17** Columns that fold away sideways (asked by the user): each column can be collapsed, so early on the
  dialogue can take more of the screen.
  Built as mock-up 16: a ‹ beside each heading folds that column to a thin strip, whose › brings it back. A folded
  column shows a grey dot on rows with something in it. Any column can fold but the last one open. Remembered in
  this browser for every script, not in the script; Write only (Review, History, print and exports show all three).
- [x] **AP-18** The GitHub side renamed to p2p-script-studio (asked by the user): README, docs, notes and the repo's
  description and links use the app's name and address, not "Internal Script Studio".
  Built: README, roadmap and notes are titled P2P Script Studio, the package is p2p-script-studio, and the app's
  GitHub link points at github.com/kiva-mccr/p2p-script-studio. The user renamed the repository in its settings.
- [x] **AP-19** More files previewed in Images & files (asked by the user): .tif, .svg, .gif, .mp4 and other video,
  audio, .pdf, .docx, .txt, .md, and other useful kinds, shown as a picture, a player or the first lines of text,
  where the browser can draw them. Mock-up 41, agreed as drawn. Built: video shows a still and its length, ▶ plays
  it small in the cell; sound gets a slim player; PDF a picture of page 1 and "Page 1 of N" (pdf.js, fetched only
  when a PDF is shown); Word, .txt, .md, .csv their first 3 lines (Word read with the browser's own unzip); .tif a
  picture (UTIF, fetched only when needed); PowerPoint, Excel, zip and the like, or a video the browser can't play,
  a chip with the kind and size. The same previews on comment files, and Assets thumbnails for .tif, PDF and video.
  Previews are at most 120 px tall.
- [x] **AP-20** First-time screen without OneDrive in its wording (asked by the user): "Pick the shared folder your
  team keeps scripts in", since a team may sync another way.
- [ ] **AP-21** Set-up help for other ways of syncing (asked by the user, later): the "Before you start"
  instructions for OneDrive, Google Drive, Dropbox, a network drive …, with screenshots so they are easy to follow.
  Mock-up first.
- [x] **AP-22** Adding sections, smoother (asked by the user): a new section starts empty with "New section" as
  grey stand-in text, like the empty cells, not as real text; an emptied section is removed only once the cursor
  leaves its box, never while still typing in it; and the section button adds the section right after the box the
  cursor is in, or at the end when no box is in use. Built: the new section takes the cursor; from a section's title
  it goes after that section's rows; it gets an empty row only when no rows follow it.
- [ ] **AP-23** Named links with a preview (asked by the user): a pasted link can be given a name, shown instead of
  the address, and shows a preview of the page. Mock-up first; goes with AP-19.
- [x] **AP-25** Saving when the browser takes back access (a bug the user hit: "Couldn't save, trying again").
  Chrome and Edge take back the OK to edit the folder after the tab has been in the background a while, and only a
  click can ask again, so the retries never worked. Mock-up 18, option A: the status says "Not saved: the browser
  needs your OK to edit the folder" with an Allow editing button; once allowed, what was typed meanwhile is saved.
  Also shown by the 5 s check and on coming back to the tab. Other failed saves still retry.
- [x] **AP-24** A planning panel (asked by the user): a fold-out panel at the side of Write, opened by a small arrow
  labelled "Planning", for notes, outlining and the script's learning goals. Kept with the script. Mock-up first.
  Built as mock-up 23 with the suggested choices (the user: "Love it"): `plan.md` beside script.md, saved 1.5 s
  after typing and checked every 5 s like the script, two saves at once keep both (theirs' new lines after yours);
  no History versions, not in exports. A tab on the right edge of Write and Review; the 380 px panel pushes the
  columns narrower (in Review at 1280 px the comments then move under the script). One text box with the cells'
  formatting plus bullets, numbers and tick boxes; open or closed is remembered by the browser.
- [ ] **AP-26** Opens without wifi (asked by the user; explore first): keep the whole app in the browser (a service
  worker caching its files) so it opens and works offline. The scripts are already on the computer through the synced
  folder; OneDrive catches up once back online. To explore: how an update reaches people (a new version on the next
  visit), and what stays online-only (Follow my voice's first model download, links, Copy for Teams).
- [x] **AP-27** A folder icon, and the length beside Saved (asked by the user: the length "feels weird behind the
  buttons"). Mock-up 30, option A, with one change (the user: drop the "1 of 5", it wastes space). Built: the folder
  name in the top bar is a folder icon back to the list ("Back to <folder>" on hover and for screen readers); the
  length follows the save status as one grey line, "Saved · 0:25", or with takes "Saved · 0:04/0:25", and steps
  aside while a red save message shows.
- [x] **AP-29** Numbered lists that renumber themselves (asked by the user). Mock-up 40, agreed as drawn. Built: in
  the planning panel and in Dialogue and On screen, numbered lines that touch are one list and count on from its
  first line's number after every change (Enter, Delete, Backspace, cut, paste, the list button); a blank or plain
  line ends a list. Enter in the middle of a list line splits it into two items; Backspace just after a list mark
  takes the mark off. Ctrl+Z undoes the renumbering, then the change. Cells get this for lists typed by hand, with no
  list buttons. Not in this step: lists inside lists, letters or Roman numerals.
- [x] **AP-31** Credits and contacts (asked by the user): the people who work on the scripts are kept once for the
  whole folder, each with their contact details, so the team always knows where to find someone; each script's
  credits pick from them and only add a short blurb on what that person did on it or their role, so the credits stay
  accurate. Anyone can add and edit. Mock-up 50, agreed with contact details cut to email and LinkedIn (no phone).
  Built: ⋯ › Credits in a script, People on the script list; people in the folder's `.studio/people/` (written once,
  newest counts), a script's credits a `credits:` line in its front matter, combined person by person when two save at
  once. A new person's first blurb becomes their usual role. Print (after the rows), Fountain and Final Draft (title
  page) and Copy for Teams carry names and blurbs, never contacts; one export switch leaves them out. Not in this
  step: renaming a person (a typo means removing and adding again once no script credits them).

- [x] **AP-30** Turn a row into a section and back (asked by the user, first in the round): a row can become a
  section heading where it is, and a section a row, without reaching for "+ Add section" at the bottom of a long
  script. Mock-up 39 with the suggested choices, the buttons grey like the other tools (the user). Built: a § row tool
  under the flag and a ¶ beside a section's ↑ ↓ ×; the title is the dialogue as plain text, On screen and files stay
  in a row under it; the row's take, flag and comments are put away as a delete would; each goes through the Undo bar.

## Phase 3: review

- [x] **RV-1** Comments on a row or a selection, reply, resolve.
  Built as mock-up 4, without suggestions (RV-2) and Approve / Send back (RV-3). A Review tab, with the number of
  open comments, shows the script to read and the comments beside it; quotes are marked in their cells. Resolved
  comments fold under "Resolved" and can be reopened. Not yet: comments in History.
- [x] **RV-2** Suggestions: accept or reject.
  Built as mock-up 4: select text, Suggest a change (starts from the selected words); the card says "Replace … with
  …" with Accept, Reject and Reply. Accepting changes the script; a decision stays in place with Undo. The old words
  are struck through in the script; the new ones show in the card, not inline. A suggestion on text that has since
  changed is not applied (a message says to change it in Write). Not on Images & files.
- [x] **RV-3** Status: Draft, In review, Approved; Approve and Send back to writer.
  Built as mock-up 4: Send for review (in Write, when not in review; only in Write, asked by the user), and in Review, Send back to writer and Approve. The
  status is the script's `status:` and each change is saved at once with a History entry ("Sent for review",
  "Approved", "Sent back to writer"). Anyone can press them (roles on trust).
- [x] **RV-4** Changed since last review (suggested, the user agreed): Review marks the rows edited since the
  script was last sent for review or approved, so a reviewer rereads only those.
  Built as mock-up 28 (the user agreed, with all suggested choices and their own switch): compared with the version
  from when the last review ended (Sent back to writer or Approved), since comparing with the last send would mark
  nothing on a second round. Changed rows get a blue bar and "Changed" or "New"; a removed row stays as one grey
  struck line; a moved row is not marked. A bar above the script: "What's changed" (on by default, the reviewer can
  turn it off; remembered), the count and since when, "Only changed rows" (folds each unchanged run to one line) and
  "Show the edits" (old text struck above the new, as in History; off at first, remembered). No marks on a first
  review; marks last until the next Sent back or Approve.
- [x] **RV-5** A check before Approve (suggested, the user agreed): Approve shows what is still open (comments,
  suggestions, and once built, flags and rows without a source) as a warning in the page, never a block.
  Built as mock-up 20 (the user agreed, with both suggested choices): with something open, Approve opens a panel
  under it listing each open comment and suggestion and the missing files (one line); a line goes to it, Keep
  reviewing or Esc closes, Approve anyway approves and History says "Approved, N still open". Nothing open: Approve
  approves at once, as before. Flags joined the list with AP-9; sources join it when AP-8 is built.
- [x] **RV-6** Comments in History (suggested, the user agreed; left out of RV-1): a version shows the comments
  made on it, so it is clear why a line changed. Built as board 48 ("looks good", every suggested choice): each
  comment and suggestion shows once, under the first change to its cell made after it, else at the bottom of the
  version current when it was made ("Comments on this version, nothing changed for them yet"). An accepted
  suggestion names itself in its change's header. The version list says "· 2 comments". Read-only: the state
  (Open, Resolved by Sam, Accepted by Sam), replies folded behind "1 reply", files as in Review, "Open in Review" on
  an open one; deleted ones left out, edited ones show their newest text. An official version gathers the comments
  of the saves folded under it. No switch to hide them. Worked out each time, nothing stored.
- [x] **RV-7** Edit your own comments and suggestions (asked by the user). `.studio/` files are written once, so
  an edit is a new note that replaces the old one. Mock-up: board 24, built as drawn ("Looks perfect", every
  suggestion taken): Edit and Delete only on what you wrote (comments, replies, suggestions), only while it is open
  (not resolved, accepted or rejected); Edit opens the box in place (Save, Cancel, Esc); an edited one shows
  "edited" after its time, the old text kept in its file but not shown; Delete has no dialog, the card becomes
  "… deleted. Undo" until Review is left, and a deleted comment takes its replies. Kept as `edit`, `delete` and
  `undelete` notes; only the author's count. Files on comments (RV-11) are to show in the same edit box.
- [x] **RV-8** A note with Send for review (asked by the user): a box to tell the reviewers what to look for; shown
  to them in Review and kept in History with the status change. The user's design note: the same style as the
  check before Approve (RV-5, board 20), a small panel that opens under the button, with the note box in it.
  Built as mock-up 26 (the user agreed, with all suggested choices): Send for review always opens the panel; the note
  is optional; Cancel or Esc closes it and keeps what was typed. Reviewers see it at the top of Review while it is in
  review (Hide folds it to "Sam's note"); History shows it under "Sent for review", in that entry's `message`. Not on
  Send back to writer for now.
- [x] **RV-9** Send for review makes a version (asked by the user): sending for review publishes the script as the
  next official version (AP-10), or keeps the current version when nothing has changed since it. Built as mock-up 51
  (the user agreed, with every suggested choice, and asked that a version published by hand and then sent with no
  changes is never made twice): the send panel says "It becomes v3 in History." or "Still v2: nothing has changed
  since it."; the version is named "Sent for review" (no name box), its note shown with it; one count with versions
  published by hand; one History line ("v3 · Sent for review"), and a send that made none shows as "Sent for review
  (still v2)". Kept as the send's own `review` entry with `official: true`. "Nothing changed" leaves out the status
  and authors lines, so print and exports also keep "v2" after an approve. Approve and Send back make no version.
- [x] **RV-10** A shared link opens in Review (asked by the user): a link sent to someone opens the script on the
  Review tab by default (Copy link, and the Teams embed of EX-10). Built: shared links end in `?review`; the app opens
  Review and drops the mark from the address, so a reload after moving to Write stays in Write.
- [x] **RV-11** Files on comments (asked by the user): a reviewer can attach files to a comment, kept in the script's
  folder. Built as mock-up 25 (the user agreed "Yes, as drawn", with every suggested choice): Attach file in the
  comment and reply boxes, plus dropping files and pasting a screenshot; × takes one off before sending; a comment
  or reply can be only files. Not on suggestions. Kept in `.studio/files/<note id>/`, written once and never
  deleted (not in assets/, so never on the Assets tab or counted missing); 50 MB a file, with a message saying to
  use a OneDrive link instead. Cards show images as a small preview and other files as a chip with the size;
  clicking opens it in a new tab (Word and the like download). Editing your own (RV-7) can take files off or add
  new ones. Left out as agreed: a "Use in script" button (idea below).

## Phase 4: exports

- [x] **EX-1** PDF: the three-column print version. Mock-up: board 9, built as drawn ("Yes, as drawn"): a Print
  button opens the browser's print window, where "Save as PDF" makes the PDF (no PDF library). Portrait, image
  previews beside file names, no comments; headings repeat on every page, rows never split, footer with page N of M.
  The version shows "v3" only while the script is still that official version, else "Draft". Asked while building:
  Print's choices, remembered: a blank Notes column on each row and a lined Notes space at the end (the user picked
  both, for notes during production), and a text size slider (60 to 140%).
- [x] **EX-2** Teleprompter view. Refined (the user agreed): scrolls at the read time speed (AP-12), with a mirror
  switch. Mock-up: board 10, built as drawn ("Yes, as drawn"): a Teleprompter button opens it full screen; the
  dialogue big, sections small, a marker a third of the way down; Start/Pause, speed in words a minute (150 to
  start, kept for AP-12 to share), text size, Mirror, On-screen cues, time left; Space, ↑ ↓, Esc. Following your
  voice is EX-8.
- [x] **EX-8** Teleprompter follows your voice (asked by the user): a "Follow my voice" switch; Whisper in the
  browser (as CC-1, nothing uploaded) hears the microphone, matches the words to the script and keeps the line
  being read at the marker; waits on pauses, copes with skipped or ad-libbed lines. A one-time model download
  (about 40 to 80 MB) and about a second of lag on an ordinary laptop. Built after EX-2. Mock-up: board 10, built
  as drawn (the user: "looks good"): whisper-base.en (about 75 MB at 8 bits) through transformers.js in a worker,
  the last 4 s heard about once a second, matched to the script by its last 8 words; download progress, a
  Listening dot, plain messages for a blocked microphone or a failed download. The user tried it: works on
  desktop, didn't move on a phone; asked for each word to grey out once said (done, also with Start). For phones:
  the sound is resumed and resampled, and a Whisper that stops working says so. Still didn't follow on a Pixel 8
  in Chrome; shelved by the user as a bug (issue #24).
- [x] **EX-12** Follow my voice feels slow (asked by the user). Found: mostly Whisper itself (it always works through
  30 s of sound, on one core); the 1 s steps added about half a second, the matching 0.03 ms, and the marker stopped
  between hearings. Agreed with the user (no mock-up, nothing new to see): Moonshine instead of Whisper, on the
  graphics card (WebGPU) where there is one, otherwise the processor; hearings as soon as the last is done (up to 4 a
  second); between hearings the marker keeps going at the pace learnt from the voice, up to 4 words on. The user is
  to read a page aloud to check accuracy; if Moonshine mishears more, go back to Whisper on WebGPU. Issue #24.
  The user tried it: "much better", but it skipped ahead on repeated "The …" sentences, jumped instead of gliding,
  and the scroll bar did nothing. Polished: a far place needs 4 words and two hearings in a row; the marker follows
  a line fitted to the last 4 s heard, smoothly; the page behind loses its scroll bar, the teleprompter shows its own.
- [ ] **EX-13** A speed limit for Follow my voice (asked by the user): while following, the teleprompter never moves
  faster than the words a minute set for playing it, so a mishearing or a jump ahead can't race the text away.
- [ ] **EX-14** Follow my voice, smoother still (asked by the user: "still a little choppy, much better though").
  Shelved by the user. Ideas, to measure on the user's computer first: a gentler catch-up and a longer window for
  the pace; scrolling by the line's real height instead of its share of words (a long line moves faster); allowing
  for the half second each hearing takes; the next words of the script given to the model as a hint (Whisper takes
  one, Moonshine doesn't), so fewer misheard words pull the marker.
- [x] **EX-15** Print: notes on every page (asked by the user). Mock-up: board 42, built as drawn ("go ahead"):
  "Notes space at the end" became "Notes lines on every page"; the lines sit at the foot of every printed page,
  above the footer (on the last page too), with a small "Notes" heading, full page width; 4 lines to start, − / +
  for 2 to 8, remembered. Printed as a fixed block Chrome repeats on each page, with a table footer as tall keeping
  the rows clear of it.
- [x] **EX-16** Print: collapse columns (asked by the user): choose which of the three columns print (for example the
  dialogue only, or no Images & files), and the rest widen to fill the page; kept with Print's other choices. Mock-up:
  board 38, built as drawn: "Columns to print" ticks at the top of Print's settings, all on by default; the last one
  can't be unticked. The user's widening rule: the first column unticked gives its room to Dialogue, the next to the
  Notes column, in turns (no Notes column: all to Dialogue; Dialogue hidden: to Notes, or else the first column left).
  # and section headings always print; a row's grey note goes in the first column that prints.
- [x] **EX-18** Print: landscape or portrait (asked by the user): a choice in Print's settings for the page's
  orientation, kept with Print's other choices; landscape gives the columns more room. Mock-up: board 47, built as
  drawn ("looks perfect"): "Page: Portrait / Landscape" at the top of Print's settings, portrait by default. The app
  sets the page (`@page size`), so the print window opens turned and Chrome hides its own Layout choice. Same text
  size, wider columns, fewer rows a page; the preview is drawn at the printed width and shrunk to fit.
- [x] **EX-3** Fountain (Trelby and other screenplay programs). Mock-up: board 11, built as drawn, under a new
  Export button (asked by the user: "an export button, that holds print, .fountain, and anything else we add");
  the ⋯ menu keeps Teleprompter and Copy link. A section is a scene heading (`.TITLE`), NARRATOR speaks the
  dialogue, the On screen column is the action, row numbers, notes and files are `[[notes]]`; the title page has
  the authors and "Draft date: v3 · Approved · date".
- [x] **EX-4** Final Draft (.fdx). Built without a mock-up (the user: "for now just get the functionality in
  place"), in the Export menu, laid out as EX-3: sections are scene headings, the On screen column is action,
  NARRATOR speaks the dialogue; the row number, note and files are a General paragraph above each row (Final
  Draft's own notes are pinned to character positions); bold, italic and underline carry over; the title page has
  the title, authors and "v3 · Approved · date".
- [x] **EX-6** Asset list (suggested, the user agreed): every file, link and "still to find" note across the rows in
  one list, with missing files marked, and a count of what is missing in the script list. The look is agreed before
  building. Mock-up: board 12, built as drawn, as an Assets tab beside History (the user's choice) with a red
  count; grouped missing, still to find, then the rest, or by row under the sections ("Order", remembered); each
  asset once with its rows, which jump to Write; the script list shows "2 missing". Links aren't checked online.
- [x] **EX-7** Exports carry the version (suggested, the user agreed): every export is stamped with the official
  version and the status ("v2 · Approved", else "Draft"), as print (EX-1) already is, so nobody records from a draft.
  Done along the way: print, Fountain and Final Draft all use `version()` in the Editor; later exports must too.
- [x] **EX-9** Export preview and settings (asked by the user; board 27, agreed as drawn): each item under Export
  opens an export screen in place of the script: formats on the left, the real result in the middle (the print page,
  the Fountain file beside a screenplay look, Final Draft's look, the joined voice-over with its rows), settings and
  Print… or Save on the right. New settings: the speaker's name and sections as scene headings for Fountain and Final
  Draft, row numbers and files as notes; for voice-over half a second between takes and silence for rows with no
  take. Defaults are what the exports did before; settings are remembered in this browser.
- [x] **EX-10** Export becomes Export / Share (asked by the user; board 15, agreed as drawn): Share on top (Copy link,
  moved in from the ⋯ menu, and Copy for Teams), the exports below. Copy for Teams puts a formatted message on the
  clipboard (plain text too): the title as a link, status, version when official, rows, read-aloud time, who edited
  last and when, open comments, voice-over progress, and an Open in Script Studio link. A snapshot; a live Teams
  preview card would need a server.
- [x] **EX-11** Voice-over as one file (asked by the user, needed for their work): Export > Voice-over (.wav) joins
  every row's take in row order into one WAV (the user's choice over a file per row), 48 kHz mono, with no gap
  between takes. Rows with no take are left out, and the page says how many. Built without a mock-up. Open question
  from the user, to talk through: .wav or .mp3? (WAV is what editors take without loss; MP3 is about a tenth of
  the size but needs an encoder in the app.)

## Phase 5: later (asked by the user; mock-ups agreed before any of these is built)

- [ ] **HI-2** A graph view of the changes: versions as a timeline or tree, showing who changed what and where two
  saves were combined.
- [ ] **SB-1** Animatic / storyboard timeline: the rows' images laid out in order along a timeline, with timings.
  More from the user: a timeline view on the Write page, at the very bottom of the script while editing or
  reviewing, and locked to the bottom of the screen while the script plays (AU-2). Later it holds the photos of a
  storyboard column, collaged and in sequence, and can be output as an .mp4 or another video format. Mock-up first.
- [ ] **YT-1** The published video: link the final YouTube video and keep its title, description and thumbnail with
  the script.
- [x] **AU-1** Recording audio for each line: record the dialogue of a row in the browser, kept beside the script
  in its folder, played back from the row (a scratch read before the real voice-over). Mock-up: board 13, redrawn
  as the user asked (a plain mic in the user's style between the row number and the dialogue, grey with no take,
  blue with one; words a minute instead of "on time"), then "Looks good". One take per row, replaced by recording
  again; ▶ length, progress, wpm, who and when, ×; "Outdated" once the line changes (asked by the user); the top
  bar adds them up. Kept as voice/row-<id>.webm and .json in the script's folder.
- [x] **AU-2** Play the script (asked by the user): goes line by line and plays each row's recorded take in time.
  Built as agreed on board 14: it plays in Write (the row being spoken is tinted and the page follows it), with one
  Play button in the top bar that becomes the time ("❚❚ 0:06 / 0:18") and ■ to stop. A row with no take waits in
  silence for its read time (the teleprompter's speed); a row with no take and no dialogue is skipped; an outdated
  take still plays; no gap between rows. A row's number plays from that row; Space pauses and Esc stops when not
  typing. Offered once a row has a take.
- [x] **AU-3** Pick the microphone (asked by the user): choose which microphone to record with, in the app, and
  remember it in this browser. Mock-up: board 19; the user asked for a Settings window to grow into, so ⋯ >
  Settings opens one with a Voice-over heading and a Microphone drop-down (Default first), kept in this browser.
  Before Chrome may use the mic only Default is listed, with why; an unplugged pick records with the default and
  says so.
- [x] **AU-4** A start cue and clean-up for takes (asked by the user). Agreed on board 31 (the user turned down a
  3-2-1 countdown, then a pulsing mic): clicking a row's mic records at once while a red ring fills around it for one
  second, then it becomes ■, the cue to read. Each take is cropped: the silence before the first word and after the
  last (and the mouse click) goes, a quarter second kept either side, never in the middle. The webm stays whole; the
  cut and a loudness gain are kept in the take's JSON and used by Play, Play the script, the joined WAV, the length
  and wpm; hovering ▶ says how much was cut. Esc while the ring fills throws the new take away. Settings >
  Voice-over adds three switches, kept in this browser: crop the silence (on), reduce background noise (Chrome's
  own, on as today) and make every take equally loud (on); they apply to takes recorded from then on.
- [x] **AU-5** Mark the default mic (asked by the user): in Settings > Voice-over, drop the separate "Default" entry
  from the Microphone list and show "(default)" on the right of the row of the mic that is the computer's default.
  Agreed on board 33: our own small drop-down (the browser's can't right-align), "(default)" on the computer's default
  mic and moving with it; never picked or picking that row follows the default, any other row sticks to that mic;
  before Chrome may use the mic one row "Computer's microphone (default)"; an unplugged pick stays, "(unplugged)".
  Built so: the default is found from the browser's extra "default" entry (same device, or its name); with no such
  entry the first mic is the default. Arrow keys, Enter and Esc work as in the browser's drop-down; Esc closes the
  list, not Settings.

- [ ] **AU-6** Quiet the hum in the pauses of a take (a noise gate between words; suggested while fixing AU-4).
  Shelved by the user: "we can come back to that much later".
- [x] **AU-7** Start playback from any point (asked by the user): Play the script and the teleprompter start from a
  chosen row instead of the top. Agreed on board 34 ("Looks good"): a row's number turns into ▶ "Play from here" while
  the mouse is anywhere on the row (it could already be clicked, but nothing showed it), and the row playing shows ❚❚;
  the top bar's Play still starts from the top; Play still needs a take. The teleprompter opens at the row the cursor
  was last in (else the first row on screen, in practice the top: ⋯ is at the top of the page), with "⤒ From the
  top" in its bar; Follow my voice listens from there.
- [x] **AU-8** Dismiss "Outdated" on a take (asked by the user, who often says a line differently while recording
  and then edits the row to match): a small × in the label saves the line as it now reads as the take's text, so
  the label goes for everyone and comes back at the next edit. Agreed on board 35.
  Words a minute counts the new text only once Outdated is dismissed (the user's addition).
- [x] **AU-9** Play takes in Review (asked by the user): reviewers listen to the voice-over without the recording
  tools. Each row's take plays from the row (▶, length, who and when, Outdated shown, no mic and no ×), and Play the
  script works there as in Write (the top bar's Play, a row's number turns into ▶ "Play from here"). Agreed on
  board 36 ("Looks perfect"): a row with no take shows nothing until the script plays over it; a comment on a take is
  a comment on its row (no time stamp); recording and the joined WAV stay in Write. Built so: the take line is one
  component for both tabs (`Take.svelte`); Play keeps going when switching between Write and Review.

- [x] **RV-12** Use an attached file in the script (suggested while drawing RV-11; agreed on board 49 with the
  user's two changes: every attached file, not only images, and only in Write). In Write's Comments tab, each file on
  an open comment or reply has "Use in script": it is copied from .studio/files/ into assets/ (a name already there
  gets " 2"; nothing is overwritten) and added under that row's files, saved as any edit. The button then reads
  "In row N" for everyone (a line there with the copy's name and the same size); taking it off the row brings the
  button back. "From Sam's comment" shows under the new chip while the page is open. Review shows the files only.
- [x] **RV-13** Review comments in Write (asked by the user: writers had no way to work through comments while
  rewriting). The user picked idea A of three on board 37: the side panel gets two tabs, Planning and Comments; in
  Write the writer replies, resolves and accepts or rejects suggestions beside the text. Rows with something open get
  a blue speech bubble with a count under the row number, quotes are marked yellow; a card scrolls to its row. Review
  stays the reviewers' place (new comments start there). The six smaller choices on board 37 (one panel with two
  tabs; no new comments in Write; bubbles; opens by itself after Send back, with a note on Send back; no
  auto-resolve; "Review · 3" on the tab) were agreed by the user as suggested (2026-11-12). Built so: the card is one
  component for Review and Write (`CommentCard.svelte`); the panel is `Planning.svelte` with a Comments tab in Write
  only; resolving in Write stays in place with Undo until the panel or tab is left. Send back to writer opens a note
  box like Send for review's; the note (History `message`) tops the Comments tab while the script is a draft, and
  the tab opens by itself once per send back, only for a send back by someone else. Rows with something open grow a
  little so the row tools clear the bubble. Quotes are marked on the formatted text, so not while that very box is
  being typed in. A click on a quote's words in a field opens its card.
- [x] **RV-14** A "for me" filter on the script list (suggested, the user picked it first of four, 2026-11-12): show
  only the scripts waiting for your review or with replies to your comments, so nobody opens each one to check.
  Built as mock-up 43 (the user agreed, with every suggested choice): an All · For me switch above the list (the
  count in a blue badge; remembered in this browser, All at first) and blue labels on the rows in both views: "Your
  review" (In review and someone else sent it; no reviewers are assigned), "N replies" (open comments you wrote in
  whose newest word is someone else's) and "Sent back to you" (a send of yours sent back). Worked out from History
  and the comment files, nothing stored per person. Nothing for you: "Nothing waiting for you" and Show all.
- [x] **AP-32** Find and replace in a script (suggested, the user's second pick): search all three columns, step
  through the matches, replace one or all (for renaming a term or a person across an episode). Mock-up: board 44,
  agreed as drawn ("love it") with its six choices: Ctrl+F in Write (also ⋯) opens a bar under the top
  bar, Esc closes, Ctrl+F from inside the bar gives the browser's own; not in Review. It looks in section titles,
  Dialogue, On screen and the words of Files lines (notes, link names), never file names or links. Ignores capitals
  unless Match case, parts of words unless Whole words; matches the text as it reads, across bold in a word; a
  replacement takes the capitals it replaces. Enter / Shift+Enter step; Replace one moves on, Replace all has the Undo
  bar. An ordinary edit (saves on its own, no special History entry). Left out: every script at once, wildcards.
  Built: `lib/find.ts` and `Find.svelte`; equations are not searched (they show as maths).
- [x] **RV-15** What changed since you last looked (suggested, the user's third pick): on opening a script, rows
  others edited since your last visit get a small mark, with a line such as "3 changes since Tuesday" to step through
  them. Agreed on board 45 ("looks good") with its suggested choices: RV-4's look plus who; only other people's edits
  (never your own, even from another computer); the last visit is the last opening on this computer, kept in the
  browser; in Write, and in Review unless it has its own RV-4 round; ‹ › step and tint; Show the edits as in Review;
  marks last until you leave, Got it clears them; no dot on the script list for now. The user's additions: marked
  rows stay editable in Write, the old words on their own line above the box (5a); a ✓ Seen per row clears that one
  ("2 changes left", 5b). Built so: `lib/visit.ts` credits each row to the last version that changed it (compared
  with its parent, merges skipped); the bar is `VisitBar.svelte`, shared by Write and Review.
- [ ] **RV-16** Comments in line order (asked by the user): the comment lists (Review, and Write's Comments tab) show
  comments in the order of the rows they are on, by default, with a switch to sort them by time or by type instead.
  By type puts suggestions first, then comments on specific words, then comments on a whole row (the user's order).
  Placed by the user after the current queue. Mock-up first.
- [x] **RV-17** Clicking a row's comment bubble again scrolls back to its comment (a bug the user hit): when the
  comment is still selected but scrolled out of view, a second click on its bubble does nothing; it should bring the
  comment back into view. Bug fix, no mock-up needed. Built so: a click on a quote does the same.
- [x] **RV-18** A resolved comment moves into Resolved by itself (a bug the user hit): today it stays in the open list
  until the comment panel is closed and opened again. The user likes the Undo, so a resolved comment stays in place
  for about 5 seconds with Undo showing, then moves into the Resolved dropdown on its own. Bug fix, no mock-up needed.
  Built so: in Write's Comments tab, 5 seconds, accepted and rejected suggestions too; Review still moves it at once.
- [x] **RV-20** The selected comment stands out (asked by the user): when you jump to a comment, its light blue line
  is hard to see; the selected comment needs a clearly stronger highlight. A small look change done with RV-17 and
  RV-18: a before and after picture is shown to the user before it is merged. Built so (the user: "looks good"): a
  solid blue outline with a soft ring and tint on the card, a short flash when you jump to it, and a darker tint
  with a blue bar on its row in Write. Pictures: project files, comment-highlight/.
- [ ] **RV-21** Tab counts that say what's new for you (asked by the user): today the Review tab's number is the open
  comments. Instead, Review counts the rows changed between Send back to writer and the next Send for review (what
  the reviewer has to look at), and Write counts the comments and suggestions made between Send for review and Send
  back to writer (what the writer has to deal with). A count clears once you open its tab, then counts only what is
  new since (remembered per browser, like RV-15). Placed by the user after the current queue. Mock-up first.
- [ ] **RV-22** A Comment button on selected words (asked by the user): in Review, selecting words today opens the
  comment box straight away (so a double-click on a word opens it too). Instead, selecting words shows a small Comment
  button beside them, and the box opens only when it is clicked, so selecting to read or copy doesn't start a
  comment. The user: "Remove the whole double click thing": a double-click never opens a comment, it only selects
  the word like anywhere else. Placed by the user after the current queue. Mock-up first.
- [ ] **AP-38** The line as it was before you started (asked by the user): while editing a row in Write, a small
  dropdown on that row shows its words as they were when you started editing, so you can look back and forth and see
  how the line improved. Related to RV-15's "Show the edits" (old words above the box). Placed by the user after the
  current queue. Mock-up first.
- [x] **RV-19** Put a comment on hold (asked by the user): a comment that isn't resolved but is shelved for later can
  be put On hold, which moves it out of the open list without losing it. Agreed with the user: the list shows how many
  are on hold, and held comments come back into view when the script is sent for review or a version is made, so they
  don't become a dumping ground. Placed by the user after the current queue. Mock-up first. Agreed on board 58 ("I
  like it") with its suggested choices: anyone can put one on hold, in Review and Write's Comments tab alike; no
  reason box (a reply says why); nothing written when they come back. The user's addition: a card moving into a
  dropdown slides off to the right and the cards below slide up into its place. Built so: Put on hold beside Resolve
  (and on suggestions), 5 seconds with Undo, then into a folded "On hold · n" between the open list and Resolved;
  a held card says who and when, with Take off hold. Not counted in the bubbles, the tab counts or "For me"; Approve's
  check lists them as "on hold". A hold is a `hold` note (Take off hold and Undo are a `reopen`) and lasts until the
  next send for review or official version after it, then the card is open again with "Back from hold"; Send for
  review says so beforehand. The slide (`lib/slide.ts`) is on every card leaving the open, On hold or Resolved list.
- [x] **AP-33** Try it with an example (suggested, the user's fourth pick): the first-time screen offers the made-up
  example script (docs/example/), so a new teammate can click around before picking the real folder. The user's
  addition: it can be minimized, and stays minimized on later visits, so it is no clutter for those who don't want
  it. Mock-up first. Agreed on board 46 ("Looks amazing") with its six suggested choices: a card under the
  first-time screen (also after Change folder, not on Welcome back); the – folds it to one grey line, remembered by
  the browser; the example is a real copy in the browser's private storage, so every part of the app works and
  nothing is shared; a blue strip inside it with Start over (through the Undo bar) and Open your scripts folder; the
  example gets a few made-up drawings, two comments and one History entry; the name typed, or "Guest". The user
  chose to build this plain example first and the tutorial (AP-34) later on top of it.
  Built as agreed: the example (`lib/example.ts`) is copied into the browser's private storage as "Example" the first
  time and kept as left; drawings for leaf-closeup.jpg, icons-ingredients.svg, glucose-model.png and storyboard-p4.pdf
  were added to docs/example/ (made up). A reload stays in the example; leaving it goes back to the first-time screen.
- [x] **AP-34** A tutorial in the example (asked by the user): in the example from AP-33, a quick guided tour per tab
  (Write, Review, History, Assets …) that highlights each feature, goes through them fast, then hands over control
  to play; a Skip button shows throughout. A dedicated job that has to be kept up to date as features change. Kiva
  asked to be reminded about this when setting priorities after each round. Mock-up first. Moved by the user
  (2026-11-13) to the front of the new features, after the flaky tests, the screen split and History at scale.
  Agreed as drawn (board 53): only in the example; Write's tour plays by itself when the example opens, each other tab's
  the first time it opens; 3 to 7 steps, moved on with Next (→), Esc or Skip tour stops every tab's tour (remembered),
  Take the tour in the blue strip plays the open tab's again; the page is dimmed and can't be clicked during a step;
  each tab ends on "Your turn". Also asked by the user: the example has one file of each kind the app previews (video,
  sound, TIFF, Word, text, and a PowerPoint for a kind with no preview) and a voice-over take on every row.
  Built as agreed: the steps are `lib/tour.ts`, pointing at data-tour marks; `screens/Tour.svelte` shows them. The
  takes are a made-up voice (espeak-ng with an MBROLA voice), in docs/example/…/voice/. An example made before this
  keeps its old files until Start over.
- [ ] **AP-35** A "What's new" tour (asked by the user): every so often, after updates that add features (not
  fixes), the app shows a short tour of just those new features the next time it is opened, with a Skip button.
  Related to AP-34 (the tutorial per tab), and could reuse its tour. Mock-up first.
- [ ] **AP-36** Pop-up windows open where the viewer is looking (a bug the user hit): a window that opens over the
  page should be centred in the part of the page on screen, not on the whole length of the page. The two pop-up
  windows in the code, Settings and Shared files, are pinned to the screen with a gap at the top, so which one the
  user saw (or a menu or panel inside the page) is to be confirmed first. Bug fix, no mock-up needed.
- [ ] **AP-37** When each computer last synced (asked by the user): a web page can't ask OneDrive for its status, so
  each computer with the app open leaves a small "still here" mark in `.studio/` about once a minute, and the others
  show how old the newest mark they can see is ("Sam's computer last synced 2 min ago"), which says how far behind
  OneDrive is. To work out: keeping to the write-once rule for `.studio/` without piling up files, and where it shows
  (beside "… is editing"?). Mock-up first.
- [ ] **AP-39** No blank page when scrolling fast (a bug the user hit, not urgent): scrolling quickly through a script
  shows blank parts of the page before they draw. At the least, parts not yet drawn show grey stand-ins (like the
  empty cells); better, find what makes drawing slow (pictures and file previews, long rows) and make it faster.
  Measure on a long script first. Bug fix, at normal priority (not ahead of the current queue).
- [ ] **RV-23** Fold columns in Review too (asked by the user): the ‹ fold from AP-17 (Write only today) also works
  in Review, every column open by default. Whether Review remembers its own folds or shares Write's is for the
  mock-up. Mock-up first.
- [ ] **AP-41** Copy the details of any error (asked by the user): every error message gets a small, quiet "copy
  details" button that copies the full error (the browser's error name and message, what the app was doing, the
  app's version, the browser) for debugging, without cluttering the message. Messages name OneDrive or another
  system only when the app knows that's where the folder is (the save messages were changed in FX-1). Mock-up first.
- [ ] **AP-40** The script list reads only what it needs (asked by the user): today the list, after showing names,
  reads every script's script file, take notes, all comment files and History (not approved ones) one after another,
  and again whenever the window gets focus. Instead: (1) only the scripts on screen are read, the rest as you scroll
  to them; (2) the counts (length, missing, flagged, For me) are remembered per script in the browser, and a script
  is read again only when its files changed (a folder listing with file dates, no file opened); (3) coming back to
  the window checks dates only. Goes with AP-39 and HI-3. Explore and measure on a big folder first; the list looks
  the same, so no mock-up unless something visible changes.
- [ ] **EX-19** A DaVinci Resolve or Premiere Pro project from the timeline (asked by the user; Premiere added
  2026-11-13): the app builds a file that DaVinci Resolve or Adobe Premiere Pro opens, with the timeline from SB-1
  (images, takes and timings in order), so editors pick it up and keep working on it there. To explore: both open the
  same timeline XML (Final Cut Pro 7 XML), so one file may serve both. Needs SB-1 first. Mock-up first.
- [-] **EX-17** A shoot checklist (suggested; shelved by the user, to talk through later): the asset list (EX-6) with
  shared tick boxes for each row's on-screen shots and files, for the day of filming.
- [x] **AP-28** The live version in the bottom-left corner (asked by the user): the number of the last merged pull
  request, in the same small grey style as GitHub in the bottom-right, so a refresh shows when a new version is live
  and which features are in it. Agreed on board 32 ("looks perfect"): "PR #61" in the same grey, opens that PR on
  GitHub, hover shows its title and when it went live; set at build time (docs-only merges don't rebuild); "dev"
  when run locally. Built so: deploy.yml sets LIVE_BUILD and vite.config.ts reads the merge commit's number and title.

- [x] **HI-3** History that holds up when it gets huge (asked by the user, 2026-11-13; the user picked 1, 2 and
  Load more of four ideas): (1) the Editor reads History once when a script opens and then only new files, instead
  of about 10 times; (2) the browser remembers what it has read (History files never change), so a later visit reads
  only new files; (3) History shows the newest 50 with "Show 50 older" under them; after the first click, older ones load
  by themselves as you scroll near the end (the user's ask). A History of 50 or fewer has no button. No change to `.studio/`.
  Left for later, if a new computer is still slow on real OneDrive: one small index file per 100 versions
  ("chapters"). Not wanted: storing changes instead of whole copies. Measure on a made-up 2,000-version script
  before and after. Agreed on board 52 ("looks good", plus loading as you scroll). Built so: `lib/versioncache.ts` keeps each
  read version in memory and IndexedDB (keyed by name, size and time), so every `listVersions` call reads only new files.
- [x] **FX-1** "Couldn't save, trying again" over and over in the field test (the user's two computers on a Windows
  mapped network drive, one or both typing). Unconfirmed cause: a save replaces script.md by renaming Chrome's
  .crswap file onto it, which Windows refuses while another computer has script.md open (its 5 s check reads it).
  Fixed so: a read or write of script.md is tried again quietly (0.3, 0.7, 1.5, 3 s) before it counts as failed; a
  failed write is aborted so no half-written .crswap is left; one save at a time; the 5 s check reads script.md only
  when its time or size changed; and a failed save names the browser's error in the bar ("Couldn't save
  (NoModificationAllowedError), trying again", all of it on hover) so the user can report it.
- [x] **FX-2** Each person saves to their own change files (the user's design, #1 priority, 2026-11-13; no locking or
  blocking, the user's rule). Design doc, agreed with the recommended options: https://claude.ai/artifact/URiqbWaP94rJXDekD3rqrQ.
  Built so (docs/studio-folder.md, `changes/`): typing is saved within 30 s or on Ctrl+S as a new change file holding
  only the changed rows, before and after (`lib/changes.ts`); others fold them in every 5 s, with a spinner beside
  "… is editing" (the user's ask); only the keeper (first to open, among those editing now) writes script.md, its
  note of the change files in it, and History every 5 min; editing files are a new file every 30 s. Robust to a page
  closed at any step (the user's ask): unsaved typing kept in the browser; a change file never folded is folded by
  the next to open; a keeper closed between script.md and its note causes no false clash. Two newest History entries
  are no longer combined on opening. Messages say "the shared folder", not OneDrive (the user's ask). Not seen for
  real: two computers on the network drive.

## Last (the user's order: these wait until everything above is done)

- [x] **AS-1** A shared asset browser between scripts (asked by the user): browse and reuse the files of every
  script in the folder. Picked by the user for the round of 10 and agreed on board 29; built in two steps:
  - [x] **AS-1a** "From other scripts…" in a row's + Add: a window in the page lists the files in every other
    script's assets/ and the links its rows use, grouped by script (newest edited first), images as thumbnails, each
    with how many rows use it; Find narrows by name. A picked file is copied into this script's assets/ (a name
    already there gets " 2", as Choose a file does; nothing is overwritten); a link is added as the same link.
    "To find" notes are left out. "Copied from …" shows under the new chip.
  - [x] **AS-1b** A Files button on the script list: the same window, "Files in every script", browse only (a file
    or link opens in a new tab, a script's name opens that script).
- [ ] **EX-5** SRT subtitles from the dialogue (DaVinci Resolve imports them). Shelved by the user: it needs more
  depth and will be built together with other features they have in mind. Moved to the very end by the user ("subtitle syncing").
- [ ] **CC-1** Drop in the final video; Whisper (open source, in the browser) hears it; the script's own words are
  lined up with the audio; nudge timings; download SRT or VTT for YouTube. Takes the video file, not a YouTube link. Moved to the very end by the user, with EX-5.

## Decisions

- **Settled:** a web app on GitHub Pages; scripts in a shared OneDrive folder opened through the browser (no
  Microsoft sign-in: the user's work IT will not approve apps); Chrome and Edge on desktop only; roles (writer,
  reviewer, editor) on trust, protected by who has the folder; "… is editing" instead of live co-editing, with
  conflict resolution; the repo is public. Mock-ups of the five screens (open folder, list, Write, Review,
  History) were shown before planning. The script format is one section per row with labelled fields (SF-1).
- **Settled:** Svelte 5 + TypeScript (AP-1).
