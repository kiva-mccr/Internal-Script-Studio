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
- Keep screen files small: saving and History are `lib/saving.svelte.ts`, one row of Write is `WriteRow.svelte`;
  a new screen, panel or chunk of logic gets its own file rather than growing `Editor.svelte` or `Write.svelte`.

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
  Turn on auto-merge (merge method) right after opening a PR, so GitHub merges it the moment `test` passes; nothing
  wakes a thread when CI ends, and waiting on a reminder left green PRs unmerged. Then check the deploy and live site.

## Status
- Next: a round of 10 picked by the user, mock-ups on boards 21 to 29, built one at a time in this order: AP-12 (done),
  AP-9 (done), AP-24 (done), RV-7 (done), EX-12 (done), RV-11 (done), RV-8 (done), EX-9 (done), RV-4 (done), AS-1 (done). Since then, asked by the user: AP-28 (done), AU-5 (done), AU-7 (done), AU-8 (done), AU-9 (done), AP-30 (done), AP-29 (done), EX-16 (done), AP-19 (done), EX-15 (done), RV-13 (done). Then, the user's ranked picks (2026-11-12), mock-ups first: RV-14 (done), AP-32 (done), RV-15 (done), AP-33 (done). Then, added by the user (2026-11-13), in this order: RV-9 (done), RV-6 (done), RV-12 (done), EX-18 (done), AP-31 (done).
- Done 2026-11-13: flaky tests, the screen split, HI-3, AP-34, RV-17, RV-18, RV-20 (AP-36 shelved by the user).
- FX-1, then FX-2 (saving with each person's own change files, the user's design) went ahead of the round.
- Now (the user's ranking, 2026-11-13), mock-ups first, built in this order: RV-19 (done), RV-22 (done), RV-16 (done), AP-38 (done), RV-21 (done),
  AP-39, then AP-40, AP-41, RV-23 (added by the user 2026-11-14, any order; mock-ups prepared before the queue
  restarts), then AP-37 last (on the network drive it may read "Sam last seen …"). The user is
  running the real-world checks with the field test checklist:
  https://claude.ai/artifact/FT4p8XLBVTSrEQMow71NDb. Once this round is finished, if usage remains, start the
  SB-1 (storyboard timeline) mock-up: mock-up only, no building (the user, 2026-11-14).
  The rest (AP-15, AP-8, AP-35, SB-1's build then EX-19 …) waits
  for the user's next ranking; "Last" in ROADMAP.md (EX-5, CC-1) waits until everything else is done.
- Mock-ups (one board per design, numbered): https://claude.ai/artifact/2XDZmS7J5NEPZsz91RQMiL (private to the user).

## Rules learnt from earlier steps
- Test Chromium crashes reading a folder handle back from IndexedDB: e2e tests fake it (`tests/e2e/folder.ts`),
  with a real folder handle from the browser's private storage standing in for the picked folder.
- e2e tests run as "Sam": use other names for other people's versions and editing files. Someone else's save is a
  change file (`changeFile` / `writeChange` in `tests/e2e/folder.ts`), not a write to script.md (that's now an
  outside edit). Typing saves after 1.5 s in tests (`save-every`), 30 s for real; script.md comes after, so poll it.
- e2e tests start with the example's tour skipped (playwright.config.ts); a feature named in the tour keeps its
  `data-tour` mark, and its step in `lib/tour.ts` changes with it.
- A file being written shows in a folder listing as "name.crswap" until it closes, and its real name is there, empty
  (or briefly gone), from the start. Tests read a folder's JSON files with `readJsonFiles` (waits for whole files)
  and count them with `expect.poll`, never `listFiles` + `readFile` + `JSON.parse`.
- Flaky tests show up under load: `npx playwright test --repeat-each=6 --workers=8 --trace off` (about 5 minutes)
  before handing over anything that touches saving, History or the folder. Fix the race, never add retries.

## Known gaps (never seen for real; confirm when the user can)
- The team now uses a Windows mapped network drive (SMB), not OneDrive. FX-2's change files, keeper and spinner with
  two real computers there are unseen (no SMB share here; others are simulated by writing change files in tests).
- The editor's saves and the 5 s check for others' saves with real OneDrive sync delays.
- Conflicts and "… is editing" with two real computers (only simulated by writing files in tests).
- Follow my voice (EX-8, EX-12) with real Moonshine, WebGPU and a real microphone: this container can't reach
  Hugging Face, so only the worker asking for the model was seen; the following was tested with a fake. Whisper
  worked on the user's desktop; the user is to check Moonshine's speed and accuracy (fallback: Whisper on WebGPU).
  Didn't follow on a Pixel 8 in Chrome (issue #24, shelved).
- Fountain and Final Draft files opened in a real screenplay program: only the text and the XML were checked.
- Voice-over takes (AU-1) and the joined WAV (EX-11) with a real microphone and real OneDrive: tests fake the
  recording (a WAV); decoding Chrome's real webm takes was never seen here.
- Play the script (AU-2, AU-7, AU-9) with real takes: tests play the fake WAV takes, and nothing was heard here. Whether the
  shown time keeps up with real webm takes is unseen.
- Notes lines on every printed page (EX-15) in real Chrome/Edge printing to paper: only Chromium's PDF was seen here.
- Landscape print (EX-18) in real Chrome/Edge print windows and on paper: only Chromium's PDF (11 × 8.5 in) was seen here.
- Copy for Teams (EX-10) pasted into real Microsoft Teams: only the clipboard's HTML and text were checked here.
- Paste a draft (AP-13) from real Word: tests paste plain text with Windows line ends through the clipboard.
- Remembering the folder across visits (IndexedDB) and the "Welcome back" permission prompt, in real Chrome/Edge.
- Pick the microphone (AU-3, AU-5) with real microphones: tests fake the list and the recording; an unplugged mic and
  which mic real Chrome/Edge mark as default are unseen.
- The planning panel (AP-24) with two real computers: saves at once are only simulated by writing plan.md in tests.
- Files on comments (RV-11) dropped from real Explorer or pasted from a real screenshot tool, and big files over
  real OneDrive: tests pass files through the file input and a made-up paste.
- Files from other scripts (AS-1) over real OneDrive: a file that is only a placeholder ("online only") is unseen.
- The start cue and clean-up (AU-4) with a real voice and mic: the crop and loudness were only tuned on made-up tones,
  and Chrome's noise reduction switch was only seen being asked for.
- File previews (AP-19) of real camera .mp4/.mov, real Word, PDF and TIFF files: tests use made-up small ones.
- Comments in Write (RV-13) with real OneDrive: a send back by someone else is only simulated by writing its History
  entry in tests.
- Changed since you last looked (RV-15) with real OneDrive and two computers: others' versions are only simulated by
  writing History files in tests; computers whose clocks disagree are unseen.
- Try it with an example (AP-33) in real Chrome/Edge: private storage was only seen in test Chromium.
- Credits and contacts (AP-31) with two real computers and real OneDrive: combining credits saved at once is only
  unit-tested; whether screenplay apps show Fountain's "Credits:" title-page key is unseen.
- Comments in History (RV-6) with real OneDrive: versions and comments from others are only simulated by writing
  their files in tests.
- History at scale (HI-3) on real OneDrive with "online only" files: only a made-up 2,000-version script in test
  Chromium was timed; a first visit on a new computer still reads every file.
- The example's tour (AP-34) in real Chrome/Edge at other window sizes: only 1280 × 800 and 1920 × 1080 test Chromium
  were seen. Its takes are a made-up voice (espeak-ng); nothing was heard here.
- Tab counts (RV-21) with two real computers: others' versions and comments are only simulated by writing their
  files in tests.
- Allow editing (AP-25) after Chrome really takes back access: tests fake the lost OK; how long Chrome waits is unseen.
