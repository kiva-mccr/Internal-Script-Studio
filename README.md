# Internal Script Studio

A free, minimalist web app for writing, reviewing and producing educational video scripts.

- **Three columns:** dialogue, what's on screen, and images and files, one row per shot.
- **Your files stay yours:** scripts live in your team's shared OneDrive folder, not on any server.
- **Every version kept:** see who changed what, and restore any earlier version.
- **Review:** comments and suggestions that writers accept or reject.
- **Production:** print, teleprompter, Fountain, Final Draft and subtitle exports, plus captions for YouTube.

Open it at **https://p2p-script-studio.kivamccr.xyz/** (Chrome or Edge on a desktop computer).

Status: a first working version. What it does today:

- **First time:** type your name and choose your team's scripts folder (it explains how to add the shared OneDrive
  folder with "Add shortcut to My files"). The browser remembers both.
- **The list:** every script in the folder, its status, and who last edited it and when. New script starts one.
- **Writing:** each row is dialogue, what's on screen, and its images and files. Click to type; hover a row to move,
  add or delete it. Add a file (copied into the script's `assets` folder), a link, or a note of something to find.
  Images show a small preview; click it to see it full size. Select text for bold, italic, underline,
  strikethrough, a link, an equation (LaTeX) or Clear; Ctrl+B, I, U and K work too.
  It saves on its own a moment after you stop typing. The ‹ beside a column heading folds that column away (say,
  to give the dialogue the whole width early on); › brings it back. The browser remembers which are folded.
- **History:** Write · History at the top of a script. Every few minutes of editing is kept as a version: who, when
  and what changed, word for word. Restore any version. Changes made outside the app (say, in Notepad) are noted.
  Publish official version names the script as it is now (v1, v2 …); History then shows those, with the small
  saves between them folded away until you open them.
- **Saved:** beside the script's name at the top, it says Saved, Editing… or Saving…, and in red when a save failed.
- **Export** at the top right of a script holds Print, Fountain, Final Draft and Voice-over; **the ⋯ menu** holds Teleprompter and Copy link.
- **Print:** Print makes the three-column version for paper or a PDF ("Save as PDF" in the print window). Add a
  blank Notes column on each row or lined space for notes at the end, and set the text size.
- **Fountain:** downloads the script as a `.fountain` file for Trelby, Highland and other screenplay programs.
  Sections become scene headings, the dialogue is spoken by NARRATOR, the On screen column is the action, and row
  numbers, notes and files are kept as Fountain notes. The title page carries the version and status.
- **Final Draft:** downloads the script as an `.fdx` file for Final Draft, Fade In and WriterDuet, laid out the same
  way; the row number, its note and its files are a plain line above each row.
- **Teleprompter:** reads the dialogue full screen, scrolling at the speed you set (words a minute). Space starts
  and pauses, ↑ and ↓ change the speed, Esc leaves. Mirror flips it for a teleprompter glass; On-screen cues show
  the On screen column small. Follow my voice listens through the microphone and keeps up with you as you read
  (Whisper runs in the browser; the first time it downloads about 75 MB, and no sound leaves the computer). Words
  grey out once said.
- **Links:** Copy link gives a link straight to the script, for anyone with the same folder.
- **Review:** Write · Review · History. Select any text to comment on it or suggest a change, or comment on a
  whole row; reply, resolve, reopen; accept or reject suggestions (accepting changes the script, Undo puts it
  back). The Review tab shows how many are open. Send for review, then Approve or Send back to writer; each step
  is noted in History, and the list shows the status.
- **Voice-over:** the mic beside each row's dialogue records a take of that line (grey: none yet; blue: there is
  one). Play it back, see its length and words a minute, record again or delete it. A take says Outdated once its
  line changes. Takes are kept in the script's `voice/` folder, so OneDrive shares them.
  The top bar shows how many rows have a take and their total length ("3 of 4 · 0:14").
  Export > Voice-over (.wav) joins every row's take, in row order, into one file for the edit.
- **Play the script:** once a row has a take, ▶ Play in the top bar goes through the script line by line and plays
  each take in time; the line being spoken is tinted and the page follows it. A row with no take waits in silence
  for its read time. Click a row's number to play from there; pause with the same button or Space, stop with ■ or
  Esc.
- **Assets:** the Assets tab lists every file, link and "still to find" note in the script once, with the rows that
  use it: what is missing from the folder first, then what is still to find or film, then the rest (or by row).
  The tab and the script list show how many files are missing. A row number goes to that row.
- **Two people:** the top of a script says who else is editing it. Their saved changes appear on their own. If you
  both saved at the same time, the two are combined row by row; only a place you both changed is shown side by
  side for you to pick.

Needs Chrome or Edge on a desktop computer. The code is on GitHub (the link in the bottom corner).

## For developers

`npm ci`, then `npm run dev`. Checks: `npm run check`, `npm test`, `npm run e2e`.

License: GPL-3.0.
