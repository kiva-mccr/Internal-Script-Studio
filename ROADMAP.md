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

- [ ] **AP-1** Set-up: stack, tests, GitHub Pages deploy, CI that skips docs-only pushes.
- [ ] **AP-2** First-time screen: OneDrive set-up instructions ("Add shortcut to My files"), pick the folder,
  remember it.
- [ ] **AP-3** Open a script from a link.
- [ ] **AP-4** The script list: name, status, last edited by and when.
- [ ] **AP-5** The three-column editor: edit, add, move and remove rows, link assets, autosave.
- [ ] **AP-6** History: every save, who and when, what changed, restore; outside changes logged.
- [ ] **AP-7** "… is editing" and conflict resolution: colliding saves shown side by side, pick per row.

## Phase 3: review

- [ ] **RV-1** Comments on a row or a selection, reply, resolve.
- [ ] **RV-2** Suggestions: accept or reject.
- [ ] **RV-3** Status: Draft, In review, Approved; Approve and Send back to writer.

## Phase 4: exports

- [ ] **EX-1** PDF: the three-column print version.
- [ ] **EX-2** Teleprompter view.
- [ ] **EX-3** Fountain (Trelby and other screenplay programs).
- [ ] **EX-4** Final Draft (.fdx).
- [ ] **EX-5** SRT subtitles from the dialogue (DaVinci Resolve imports them).

## Phase 5: captions for YouTube

- [ ] **CC-1** Drop in the final video; Whisper (open source, in the browser) hears it; the script's own words are
  lined up with the audio; nudge timings; download SRT or VTT for YouTube. Takes the video file, not a YouTube link.

## Decisions

- **Settled:** a web app on GitHub Pages; scripts in a shared OneDrive folder opened through the browser (no
  Microsoft sign-in: the user's work IT will not approve apps); Chrome and Edge on desktop only; roles (writer,
  reviewer, editor) on trust, protected by who has the folder; "… is editing" instead of live co-editing, with
  conflict resolution; the repo is public. Mock-ups of the five screens (open folder, list, Write, Review,
  History) were shown before planning. The script format is one section per row with labelled fields (SF-1).
- **Open:** the stack (AP-1).
