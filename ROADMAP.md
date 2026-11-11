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
- [ ] **AP-9** Flags (asked by the user): a writer flags a row to come back to, with an optional note ("check this
  fact"); flagged rows are marked in the editor, counted in the list, and can be stepped through and cleared. Where
  a flag is stored (in `script.md` or `.studio/`) and the look are agreed before building. Refined (the user
  agreed): built together with AP-8, with a "needs a source" flag that clears itself when a citation is attached,
  so fact-checking is a list to step through.
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
- [ ] **AP-12** Read time (suggested, the user agreed): the word count as minutes, for each section and the whole
  script, at a speaking speed the person sets. Later feeds the teleprompter (EX-2), SRT (EX-5) and storyboard
  timings (SB-1). The look is agreed before building. Also asked by the user: the script list shows each script's
  length, the read time or, where every row has a take, the recorded voice-over's length.
- [ ] **AP-13** Paste a draft (suggested, the user agreed): pasting several paragraphs into Dialogue makes one row
  for each paragraph (drafts written in Word).
- [ ] **AP-14** Keyboard flow (suggested, the user agreed): Tab between cells, Ctrl+Enter for a new row below,
  Alt+Up / Alt+Down to move a row, so writing never needs the mouse.
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
  Built: README, roadmap and notes are titled P2P Script Studio and the package is p2p-script-studio. Renaming the
  repository and its description are buttons in GitHub's settings that the user presses; the app's GitHub link
  keeps the old address, which GitHub redirects after the rename.
- [ ] **AP-19** More files previewed in Images & files (asked by the user): .tif, .svg, .gif, .mp4 and other video,
  audio, .pdf, .docx, .txt, .md, and other useful kinds, shown as a picture, a player or the first lines of text,
  where the browser can draw them. Mock-up first.
- [x] **AP-20** First-time screen without OneDrive in its wording (asked by the user): "Pick the shared folder your
  team keeps scripts in", since a team may sync another way.
- [ ] **AP-21** Set-up help for other ways of syncing (asked by the user, later): the "Before you start"
  instructions for OneDrive, Google Drive, Dropbox, a network drive …, with screenshots so they are easy to follow.
  Mock-up first.
- [ ] **AP-22** Adding sections, smoother (asked by the user): a new section starts empty with "New section" as
  grey stand-in text, like the empty cells, not as real text; an emptied section is removed only once the cursor
  leaves its box, never while still typing in it; and the section button adds the section right after the box the
  cursor is in, or at the end when no box is in use.
- [ ] **AP-23** Named links with a preview (asked by the user): a pasted link can be given a name, shown instead of
  the address, and shows a preview of the page. Mock-up first; goes with AP-19.
- [x] **AP-25** Saving when the browser takes back access (a bug the user hit: "Couldn't save, trying again").
  Chrome and Edge take back the OK to edit the folder after the tab has been in the background a while, and only a
  click can ask again, so the retries never worked. Mock-up 18, option A: the status says "Not saved: the browser
  needs your OK to edit the folder" with an Allow editing button; once allowed, what was typed meanwhile is saved.
  Also shown by the 5 s check and on coming back to the tab. Other failed saves still retry.
- [ ] **AP-24** A planning panel (asked by the user): a fold-out panel at the side of Write, opened by a small arrow
  labelled "Planning", for notes, outlining and the script's learning goals. Kept with the script. Mock-up first.

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
  Built as mock-up 4: Send for review (when not in review), and in Review, Send back to writer and Approve. The
  status is the script's `status:` and each change is saved at once with a History entry ("Sent for review",
  "Approved", "Sent back to writer"). Anyone can press them (roles on trust).
- [ ] **RV-4** Changed since last review (suggested, the user agreed): Review marks the rows edited since the
  script was last sent for review or approved, so a reviewer rereads only those. The look is agreed before building.
- [ ] **RV-5** A check before Approve (suggested, the user agreed): Approve shows what is still open (comments,
  suggestions, and once built, flags and rows without a source) as a warning in the page, never a block.
- [ ] **RV-6** Comments in History (suggested, the user agreed; left out of RV-1): a version shows the comments
  made on it, so it is clear why a line changed.
- [ ] **RV-7** Edit your own comments and suggestions (asked by the user). `.studio/` files are written once, so
  an edit is a new note that replaces the old one. Mock-up first.
- [ ] **RV-8** A note with Send for review (asked by the user): a box to tell the reviewers what to look for; shown
  to them in Review and kept in History with the status change. Mock-up first.
- [ ] **RV-9** Send for review makes a version (asked by the user): sending for review publishes the script as the
  next official version (AP-10), or keeps the current version when nothing has changed since it. Mock-up first.
- [ ] **RV-10** A shared link opens in Review (asked by the user): a link sent to someone opens the script on the
  Review tab by default (Copy link, and the Teams embed of EX-10).
- [ ] **RV-11** Files on comments (asked by the user): a reviewer can attach files to a comment, kept in the script's
  folder. Mock-up first.

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
- [ ] **EX-12** Follow my voice feels slow (asked by the user; to talk through before building): is it Whisper itself,
  or how the sound is cut up and sent to it (the last 4 s, about once a second)? Measure where the delay comes from,
  then agree a fix. Goes with issue #24.
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
- [ ] **EX-9** Export preview and settings (asked by the user): an in-app screen for each export format (PDF/print,
  Fountain, Final Draft, and later ones) that previews the result and holds its settings before saving the file.
  Today the exports download straight from the Export menu. Mock-up first.
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
- [ ] **AU-3** Pick the microphone (asked by the user): choose which microphone to record with, in the app, and
  remember it in this browser.

## Last (the user's order: these wait until everything above is done)

- [ ] **AS-1** A shared asset browser between scripts (asked by the user): browse and reuse the files of every
  script in the folder. Mock-up first.
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
