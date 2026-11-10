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
  It saves on its own a moment after you stop typing.
- **History:** Write · History at the top of a script. Every few minutes of editing is kept as a version: who, when
  and what changed, word for word. Restore any version. Changes made outside the app (say, in Notepad) are noted.
  Publish official version names the script as it is now (v1, v2 …); History then shows those, with the small
  saves between them folded away until you open them.
- **Export** at the top right of a script holds Print and Fountain; **the ⋯ menu** holds Teleprompter and Copy link.
- **Print:** Print makes the three-column version for paper or a PDF ("Save as PDF" in the print window). Add a
  blank Notes column on each row or lined space for notes at the end, and set the text size.
- **Fountain:** downloads the script as a `.fountain` file for Trelby, Highland and other screenplay programs.
  Sections become scene headings, the dialogue is spoken by NARRATOR, the On screen column is the action, and row
  numbers, notes and files are kept as Fountain notes. The title page carries the version and status.
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
- **Two people:** the top of a script says who else is editing it. Their saved changes appear on their own. If you
  both saved at the same time, the two are combined row by row; only a place you both changed is shown side by
  side for you to pick.

Needs Chrome or Edge on a desktop computer. The code is on GitHub (the link in the bottom corner).

## For developers

`npm ci`, then `npm run dev`. Checks: `npm run check`, `npm test`, `npm run e2e`.

License: GPL-3.0.
