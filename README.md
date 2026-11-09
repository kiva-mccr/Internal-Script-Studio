# Internal Script Studio

A free, minimalist web app for writing, reviewing and producing educational video scripts.

- **Three columns:** dialogue, what's on screen, and images and files, one row per shot.
- **Your files stay yours:** scripts live in your team's shared OneDrive folder, not on any server.
- **Every version kept:** see who changed what, and restore any earlier version.
- **Review:** comments and suggestions that writers accept or reject.
- **Production:** print, teleprompter, Fountain, Final Draft and subtitle exports, plus captions for YouTube.

Status: being built. The first time you open it, type your name and choose your team's scripts folder (it explains
how to add the shared OneDrive folder with "Add shortcut to My files"); the browser remembers both. See [ROADMAP.md](ROADMAP.md). Scripts are plain Markdown files you can also open in any text
editor: see [the script format](docs/script-format.md).

Needs Chrome or Edge on a desktop computer.

## For developers

`npm ci`, then `npm run dev`. Checks: `npm run check`, `npm test`, `npm run e2e`.

License: GPL-3.0.
