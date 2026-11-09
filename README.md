# Internal Script Studio

A free, minimalist web app for writing, reviewing and producing educational video scripts.

- **Three columns:** dialogue, what's on screen, and images and files, one row per shot.
- **Your files stay yours:** scripts live in your team's shared OneDrive folder, not on any server.
- **Every version kept:** see who changed what, and restore any earlier version.
- **Review:** comments and suggestions that writers accept or reject.
- **Production:** print, teleprompter, Fountain, Final Draft and subtitle exports, plus captions for YouTube.

Status: a first working version. What it does today:

- **First time:** type your name and choose your team's scripts folder (it explains how to add the shared OneDrive
  folder with "Add shortcut to My files"). The browser remembers both.
- **The list:** every script in the folder, its status, and who last edited it and when. New script starts one.
- **Writing:** each row is dialogue, what's on screen, and its images and files. Click to type; hover a row to move,
  add or delete it. Add a file (copied into the script's `assets` folder), a link, or a note of something to find.
  Images show a small preview; click it to see it full size.
  It saves on its own a moment after you stop typing.
- **History:** Write · History at the top of a script. Every few minutes of editing is kept as a version: who, when
  and what changed, word for word. Restore any version. Changes made outside the app (say, in Notepad) are noted.
  Publish official version names the script as it is now (v1, v2 …); History then shows those, with the small
  saves between them folded away until you open them.
- **Links:** Copy link gives a link straight to the script, for anyone with the same folder.
- **Two people:** the top of a script says who else is editing it. Their saved changes appear on their own. If you
  both saved at the same time, the two are combined row by row; only a place you both changed is shown side by
  side for you to pick. Comments and review come next (see the roadmap).

Needs Chrome or Edge on a desktop computer.

## For developers

`npm ci`, then `npm run dev`. Checks: `npm run check`, `npm test`, `npm run e2e`.

License: GPL-3.0.
