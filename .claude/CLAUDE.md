# Internal Script Studio: project notes for Claude Code

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
- Next: Phase 4 is done but EX-5 SRT (shelved by the user) and EX-9 export preview (later); ask the user what next
  (CC-1 captions, or Phase 6); mock-ups first. Phase 6 steps need mock-ups too.
- Mock-ups (boards 1 to 13): https://claude.ai/artifact/2XDZmS7J5NEPZsz91RQMiL (private to the user).

## Rules learnt from earlier steps
- Test Chromium crashes reading a folder handle back from IndexedDB: e2e tests fake it (`tests/e2e/folder.ts`),
  with a real folder handle from the browser's private storage standing in for the picked folder.
- e2e tests run as "Sam": use other names for other people's versions and editing files.

## Known gaps (never seen for real; confirm when the user can)
- Nothing has been tried on a real OneDrive synced folder yet.
- The editor's saves and the 5 s check for others' saves with real OneDrive sync delays.
- Conflicts and "… is editing" with two real computers (only simulated by writing files in tests).
- Follow my voice (EX-8) with real Whisper and a real microphone: this container can't reach Hugging Face, so
  only the worker starting and asking for the model was seen; the following itself was tested with a fake.
  Works on the user's desktop; doesn't follow on a Pixel 8 in Chrome (issue #24, shelved).
- Fountain and Final Draft files opened in a real screenplay program: only the text and the XML were checked.
- Voice-over takes (AU-1) with a real microphone and real OneDrive: tests fake the recording.
- Remembering the folder across visits (IndexedDB) and the "Welcome back" permission prompt, in real Chrome/Edge.
