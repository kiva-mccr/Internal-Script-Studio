# Internal Script Studio roadmap

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
  timings (SB-1). The look is agreed before building.
- [ ] **AP-13** Paste a draft (suggested, the user agreed): pasting several paragraphs into Dialogue makes one row
  for each paragraph (drafts written in Word).
- [ ] **AP-14** Keyboard flow (suggested, the user agreed): Tab between cells, Ctrl+Enter for a new row below,
  Alt+Up / Alt+Down to move a row, so writing never needs the mouse.
- [ ] **AP-15** New script from a template (suggested, the user agreed): New script can start as a copy of a script
  the person picks (its sections and rows, not its history or comments). The look is agreed before building.

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

## Phase 4: exports

- [x] **EX-1** PDF: the three-column print version. Mock-up: board 9, built as drawn ("Yes, as drawn"): a Print
  button opens the browser's print window, where "Save as PDF" makes the PDF (no PDF library). Portrait, image
  previews beside file names, no comments; headings repeat on every page, rows never split, footer with page N of M.
  The version shows "v3" only while the script is still that official version, else "Draft". Asked while building:
  Print's choices, remembered: a blank Notes column on each row and a lined Notes space at the end (the user picked
  both, for notes during production), and a text size slider (60 to 140%).
- [ ] **EX-2** Teleprompter view. Refined (the user agreed): scrolls at the read time speed (AP-12), with a mirror
  switch.
- [ ] **EX-3** Fountain (Trelby and other screenplay programs).
- [ ] **EX-4** Final Draft (.fdx).
- [ ] **EX-5** SRT subtitles from the dialogue (DaVinci Resolve imports them).
- [ ] **EX-6** Asset list (suggested, the user agreed): every file, link and "still to find" note across the rows in
  one list, with missing files marked, and a count of what is missing in the script list. The look is agreed before
  building.
- [ ] **EX-7** Exports carry the version (suggested, the user agreed): every export is stamped with the official
  version and the status ("v2 · Approved", else "Draft"), as print (EX-1) already is, so nobody records from a draft.

## Phase 5: captions for YouTube

- [ ] **CC-1** Drop in the final video; Whisper (open source, in the browser) hears it; the script's own words are
  lined up with the audio; nudge timings; download SRT or VTT for YouTube. Takes the video file, not a YouTube link.

## Phase 6: later (asked by the user; mock-ups agreed before any of these is built)

- [ ] **HI-2** A graph view of the changes: versions as a timeline or tree, showing who changed what and where two
  saves were combined.
- [ ] **SB-1** Animatic / storyboard timeline: the rows' images laid out in order along a timeline, with timings.
- [ ] **YT-1** The published video: link the final YouTube video and keep its title, description and thumbnail with
  the script.
- [ ] **AU-1** Recording audio for each line: record the dialogue of a row in the browser, kept beside the script
  in its folder, played back from the row (a scratch read before the real voice-over).

## Decisions

- **Settled:** a web app on GitHub Pages; scripts in a shared OneDrive folder opened through the browser (no
  Microsoft sign-in: the user's work IT will not approve apps); Chrome and Edge on desktop only; roles (writer,
  reviewer, editor) on trust, protected by who has the folder; "… is editing" instead of live co-editing, with
  conflict resolution; the repo is public. Mock-ups of the five screens (open folder, list, Write, Review,
  History) were shown before planning. The script format is one section per row with labelled fields (SF-1).
- **Settled:** Svelte 5 + TypeScript (AP-1).
