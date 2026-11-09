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
- **The list:** every script in the folder, its status and when it was last edited. New script starts one.
- **Writing:** each row is dialogue, what's on screen, and its images and files. Click to type; hover a row to move,
  add or delete it. Add a file (copied into the script's `assets` folder), a link, or a note of something to find.
  It saves on its own a moment after you stop typing.
- **Links:** Copy link gives a link straight to the script, for anyone with the same folder.
- **Two people:** someone else's saved changes appear on their own. If you both changed it, you're asked whose to
  keep. History, comments and review come next (see the roadmap).

Needs Chrome or Edge on a desktop computer.

## For developers

`npm ci`, then `npm run dev`. Checks: `npm run check`, `npm test`, `npm run e2e`.

License: GPL-3.0.
