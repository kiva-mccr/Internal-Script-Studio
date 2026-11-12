# P2P Script Studio: project notes for Claude Code

A free, minimalist web app for writing, reviewing and producing educational video scripts. Scripts are
three-column Markdown (dialogue, on screen, images and files) kept in a shared OneDrive folder that is synced to
each person's computer. The app runs from GitHub Pages and opens that folder through the browser (Chrome and Edge,
desktop only). No server, no database, no sign-in. The roadmap (steps, status, decisions) is ROADMAP.md: tick `[x]`
there as steps land and keep the IDs stable.

## Run and test
- Svelte 5 + TypeScript, built with Vite. Install: `npm ci`. Run: `npm run dev`.
- Checks: `npm run check` (types), `npm test` (Vitest, `tests/unit/`), `npm run e2e` (Playwright, `tests/e2e/`,
  builds and serves the app itself). Playwright is pinned to 1.63.0 to match this container's Chromium.
- svelte-check needs TypeScript 6 (TypeScript 7 is not supported by it yet).
- The app is at https://p2p-script-studio.kivamccr.xyz/ (custom domain set in repo Settings > Pages; DNS is a
  CNAME to kiva-mccr.github.io at Hostinger). GitHub redirects the old kiva-mccr.github.io/Internal-Script-Studio/
  there. vite.config.ts `base` is `./`, so a build works at either address. `deploy.yml` publishes every push to main
  that changes code; Pages' source must be "GitHub Actions" (no CNAME file needed with Actions).
- Pushes to main that change only `.md` files or docs skip the workflows; pull requests always run Tests, because
  the main ruleset requires the `test` check (merge only through a PR, no force-push or deletion).
- For a text-only change, run only the tests that cover it.

## Conventions worth keeping
- Minimalist above all (the user's words: "minimalist as hell"). See the guardrails in ROADMAP.md.
- Scripts and their assets never go in this repo: it is public, and the content lives in OneDrive. The one
  exception is the made-up example in docs/example/.
- The script format is docs/script-format.md, and `.studio/` (history, comments, editing) is docs/studio-folder.md:
  read the one you touch first. Files in `.studio/` are written once and never edited (OneDrive sync).
- Every code file gets a short note beside it (`name.md`): purpose, then "Rules and pitfalls". Read it before
  editing the file; add the rule or the bug there when you fix one.
- Every new behaviour gets a test.

## Before handing a round over
Run through `.claude/CHECKLIST.md`. Keep README.md current in the same commit as the change.

## How the user likes to work
- Go step by step through the roadmap; do not build unapproved steps.
- One thread per feature (the user's way of working): mock-ups for a round of features are done up front, then the
  features are built one after another, each finished and merged before the next, so nothing is left half built
  when tokens run out.
- Show mock-ups of a design and agree the look and the open choices before building it.
- Finish a step with: tests passing, roadmap ticked, README updated, a short summary that says plainly what was
  verified and what was only simulated.
- Every prompt, before finishing: tidy what was touched (dead code, stale comments, debug lines, scratch files).
- Last thing on every prompt: update this file if anything important changed (Next, a rule learnt, Known gaps,
  commands, conventions or preferences), then commit and push with the rest. A finished step goes in the roadmap,
  not here. Keep this file short to save tokens.
- Save tokens: search ROADMAP.md by step ID instead of reading it whole; read a file's note before the file.
- Ask before changing a decision already settled (Decisions in ROADMAP.md).
- No browser dialogs (confirm, alert, validation bubbles): messages and checks are shown in the page.
- Merging: the user lets Claude merge its own PRs once checks pass, then check the live site after the deploy.

## Status
- Next: a round of 10 picked by the user, mock-ups on boards 21 to 29, built one at a time in this order: AP-12 (done),
  AP-9 (done), AP-24 (done), RV-7 (done), EX-12 (done), RV-11 (done), RV-8 (done), EX-9 (done), RV-4 (done), AS-1 (in two steps: AS-1a done, AS-1b next).
- Mock-ups (one board per design, numbered): https://claude.ai/artifact/2XDZmS7J5NEPZsz91RQMiL (private to the user).

## Rules learnt from earlier steps
- Test Chromium crashes reading a folder handle back from IndexedDB: e2e tests fake it (`tests/e2e/folder.ts`),
  with a real folder handle from the browser's private storage standing in for the picked folder.
- e2e tests run as "Sam": use other names for other people's versions and editing files.

## Known gaps (never seen for real; confirm when the user can)
- Nothing has been tried on a real OneDrive synced folder yet.
- The editor's saves and the 5 s check for others' saves with real OneDrive sync delays.
- Conflicts and "… is editing" with two real computers (only simulated by writing files in tests).
- Follow my voice (EX-8, EX-12) with real Moonshine, WebGPU and a real microphone: this container can't reach
  Hugging Face, so only the worker asking for the model was seen; the following was tested with a fake. Whisper
  worked on the user's desktop; the user is to check Moonshine's speed and accuracy (fallback: Whisper on WebGPU).
  Didn't follow on a Pixel 8 in Chrome (issue #24, shelved).
- Fountain and Final Draft files opened in a real screenplay program: only the text and the XML were checked.
- Voice-over takes (AU-1) and the joined WAV (EX-11) with a real microphone and real OneDrive: tests fake the
  recording (a WAV); decoding Chrome's real webm takes was never seen here.
- Play the script (AU-2) with real takes: tests play the fake WAV takes, and nothing was heard here. Whether the
  shown time keeps up with real webm takes is unseen.
- Copy for Teams (EX-10) pasted into real Microsoft Teams: only the clipboard's HTML and text were checked here.
- Paste a draft (AP-13) from real Word: tests paste plain text with Windows line ends through the clipboard.
- Remembering the folder across visits (IndexedDB) and the "Welcome back" permission prompt, in real Chrome/Edge.
- Pick the microphone (AU-3) with real microphones: tests fake the list and the recording; an unplugged mic is unseen.
- The planning panel (AP-24) with two real computers: saves at once are only simulated by writing plan.md in tests.
- Files on comments (RV-11) dropped from real Explorer or pasted from a real screenshot tool, and big files over
  real OneDrive: tests pass files through the file input and a made-up paste.
- Allow editing (AP-25) after Chrome really takes back access: tests fake the lost OK; how long Chrome waits is unseen.
