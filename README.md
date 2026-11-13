# P2P Script Studio

A free, minimalist web app for writing, reviewing and producing educational video scripts.

- **Three columns:** dialogue, what's on screen, and images and files, one row per shot.
- **Your files stay yours:** scripts live in your team's shared OneDrive folder, not on any server.
- **Every version kept:** see who changed what, and restore any earlier version.
- **Review:** comments and suggestions that writers accept or reject.
- **Production:** print, teleprompter, Fountain, Final Draft and subtitle exports, plus captions for YouTube.

Open it at **https://p2p-script-studio.kivamccr.xyz/** (Chrome or Edge on a desktop computer).

Status: a first working version. What it does today:

- **First time:** type your name and choose your team's scripts folder (it explains how to add the shared OneDrive
  folder with "Add shortcut to My files"). The browser remembers both. New here? "Open the example" under it opens a
  made-up script (with pictures, two comments and History) to click around in first; your changes stay in this
  browser, Start over puts it back as new, and the – folds the offer to one line for good.
- **The list:** every script in the folder, its status, and who last edited it and when. New script starts one.
- **Writing:** each row is dialogue, what's on screen, and its images and files. Click to type; hover a row to move,
  add or delete it. Keys: Tab goes to the next box (Shift+Tab back), Ctrl+Enter adds a row below, Alt+Up and
  Alt+Down move the row. Add section puts a new section right after the box you are typing in (or at the end); a section
  left with no title is removed once you click out of it. A row's § (hover it) turns it into a section heading right
  where it is, and a section's ¶ turns it back into a row. Paste a draft (from Word, say) into a Dialogue box and
  each paragraph gets its own row; Undo at the bottom puts it back. Add a file (copied into the script's `assets` folder), a link, or a note of something to find.
  "From other scripts…" lists the files and links of every other script in the folder: pick one and it is copied in.
  The script list's Files button shows the files of every script, to browse.
  Files show a small preview: a picture (also .tif, and a PDF's first page with its page count), a video that plays
  in place, a slim player for sound, or the first lines of a Word, text, Markdown or CSV file. Other kinds
  (PowerPoint, zip…) show their kind and size. Click a preview or a name to open the file. Select text for bold, italic, underline,
  strikethrough, a link, an equation (LaTeX) or Clear; Ctrl+B, I, U and K work too.
  It saves on its own a moment after you stop typing. If the browser stops letting the app edit the folder (Chrome
  and Edge do this after a tab sits in the background a while), the status says so: click Allow editing and what
  you typed is saved. Choosing "Allow on every visit" in the browser's question keeps this from coming back. The ‹ beside a column heading folds that column away (say,
  to give the dialogue the whole width early on); › brings it back. The browser remembers which are folded.
- **Planning:** the Planning tab on the right edge of Write and Review opens a panel beside the script for learning
  goals, an outline and notes. Bullets, numbered lists and tick boxes (click ☐ again to tick it), plus the same
  formatting as the cells; Enter carries a list on, and numbered lists renumber themselves when
  lines are added, removed or moved (in Dialogue and On screen too, for a list typed as `1. `). It is kept in `plan.md` beside the script, saves on its own and
  shows others' saves, but is not part of the script: no History versions and not in any export. The browser
  remembers whether it is open.
- **Comments in Write:** in Write the same panel has a second tab, Comments, so the writer works through review
  comments while rewriting: reply, resolve (Undo while the panel is open), and accept or reject suggestions. Rows
  with something open show a small blue speech bubble with the count under the row number, and the quoted words are
  marked yellow; click either to open that card, and click a card to go to its row. New comments are still started
  in Review. After a send back, Write opens on Comments with the reviewer's note at the top. A file on a comment
  can go straight into the script: "Use in script" under it copies it into assets/ and adds it to that comment's row.
- **History:** Write · History at the top of a script. Every few minutes of editing is kept as a version: who, when
  and what changed, word for word. Restore any version. Changes made outside the app (say, in Notepad) are noted.
  Publish official version names the script as it is now (v1, v2 …); History then shows those, with the small
  saves between them folded away until you open them. Send for review also makes the next one, named "Sent for
  review", unless nothing has changed since the newest (then it stays, say, v2, and no copy is made). Comments
  show in History too: under the change they led to, so it is clear why a line changed, or at the bottom of the
  version they were made on if nothing has changed for them yet (with "Open in Review" while still open).
- **Saved:** beside the script's name at the top, it says Saved, Editing… or Saving…, and in red when a save failed.
- **Export / Share** at the top right of a script holds Copy link and Copy for Teams, then Print, Fountain, Final Draft and
  Voice-over; **the ⋯ menu** holds Find and replace (in Write), Teleprompter, Credits and Settings.
- **Credits and contacts:** ⋯ › Credits lists who worked on the script, each with a short blurb on what they did on
  it. Add someone from the folder's people (Find narrows by name or role) or someone new by name. Each person's email
  and LinkedIn are kept once for the whole folder: change them from any script (Contact details) and every script
  shows the change. A new person's first blurb becomes their usual role, which fills in the blurb in the next script.
  The script list's People button shows everyone, how to reach them and the scripts that credit them; someone no
  script credits can be removed there. Print, Fountain, Final Draft and Copy for Teams carry the names and blurbs,
  never the contact details; a Credits switch in the export settings leaves them out.
- **Export screen:** each export opens a screen in place of the script, with the formats on the left, a preview of
  the result in the middle (it follows the settings as you change them) and the settings on the right, with Print…
  or Save. Settings are remembered on this computer. Back to the script (or Esc) returns.
- **Print:** Print makes the three-column version for paper or a PDF ("Save as PDF" in the print window). Add a
  blank Notes column on each row or Notes lines at the foot of every page (2 to 8 lines), and set the text size. Untick any of the three
  columns (for example to print the dialogue only); the others widen to fill the page, Dialogue first, then Notes.
  Pick Portrait or Landscape for the page: landscape gives the columns more room, and the print window opens already
  turned.
- **Fountain:** saves the script as a `.fountain` file for Trelby, Highland and other screenplay programs.
  Sections become scene headings, the dialogue is spoken by NARRATOR, the On screen column is the action, and row
  numbers, notes and files are kept as Fountain notes. The title page carries the version and status. Settings: the
  speaker's name, sections as scene headings or Fountain sections, and row numbers and files as notes or left out.
- **Final Draft:** saves the script as an `.fdx` file for Final Draft, Fade In and WriterDuet, laid out the same
  way; the row number, its note and its files are a plain line above each row. Settings: the speaker's name,
  sections as scene headings or plain lines, and the row numbers and files line.
- **Read time:** each section shows how long its dialogue takes to read aloud, and the top bar the whole script
  beside the save status ("Saved · 2:05"; with takes, "Saved · 0:14/2:05": recorded so far / the whole script, where
  rows with a take count their take). The speaking speed is set in
  ⋯ > Settings (150 words a minute to start, kept in this browser); once you have takes it offers their average speed.
  The script list shows each script's length: the read time, or the recorded voice-over's length (with a mic) once
  every row has a take.
- **Teleprompter:** reads the dialogue full screen, scrolling at the speaking speed (words a minute, the same as read time). Space starts
  and pauses, ↑ and ↓ change the speed, Esc leaves. It opens at the row your cursor was last in (else the top); ⤒ From the top
  goes back to the start. Mirror flips it for a teleprompter glass; On-screen cues show
  the On screen column small. Follow my voice listens through the microphone and keeps up with you as you read
  (Moonshine speech recognition runs in the browser, on the graphics card when there is one; the first time it
  downloads about 100 MB, and no sound leaves the computer). It moves smoothly at your pace and doesn't skip ahead on look-alike
  sentences. Its scroll bar moves through the script. Words
  grey out once said.
- **Links:** Copy link gives a link straight to the script, for anyone with the same folder; it opens on Review. Copy for Teams copies a
  short message to paste into a Teams chat: the title as a link (which also opens on Review), status, version, rows, read-aloud time, who edited
  last, open comments and voice-over progress. It is a snapshot of when you copied it, and doesn't update.
- **Review:** Write · Review · History. Select any text to comment on it or suggest a change, or comment on a
  whole row; reply, resolve, reopen; accept or reject suggestions (accepting changes the script, Undo puts it
  back). Edit or Delete what you wrote yourself while it is still open ("edited" shows after the time; Delete
  has Undo). Comments and replies can carry files: Attach file, drop files on the box, or paste a screenshot (up to
  50 MB each; bigger things go in OneDrive as a link). They show the same previews as Images & files, with the name
  and size under them; other files a chip; clicking opens one. They are kept in the script's `.studio/files/` and never deleted. The Review tab shows how many are open. Send for review (in Write), with an optional note for the
  reviewers that they see at the top of Review, then Approve or Send back to writer (with an optional note for the
  writer, shown at the top of Comments in Write); each step (and the note)
  is noted in History, and the list shows the status. If comments, suggestions or missing files are still open,
  Approve first lists them (click one to go to it); "Approve anyway" still approves, and History notes how many were open.
  **For me:** the script list labels what waits for you: "Your review" (in review and someone else sent it), "2
  replies" (open comments you wrote in where someone else has the last word) and "Sent back to you". The All · For
  me switch above the list shows only those scripts (remembered on your computer).
  **What's changed:** once a script has been sent back or approved, Review marks the rows changed since then (a blue
  bar and "Changed" or "New"; a removed row stays as one struck-through grey line), so a reviewer rereads only those.
  The bar above the script says how many; "Show the edits" puts the old text struck through above the new, and "Only
  changed rows" folds the rest to one line. Untick "What's changed" to read without marks (remembered on your computer).
- **Changed since you last looked:** open a script and the rows other people changed since you last opened it on
  this computer are marked the same way, with who changed each one ("3 changes since Tuesday by Ana and Jo"). Your
  own edits are never marked. ‹ › step through them, "Show the edits" shows the old words above the box (you can still
  type in the row, to fix a typo on the spot), ✓ under a mark clears that row, and Got it clears them all. The marks
  go when you leave the script. It shows in Write, and in Review unless Review has its own "What's changed" round.
  Nothing is written to the shared folder: your last visit is kept in this browser.
- **Find and replace:** Ctrl+F in Write (or ⋯ › Find and replace) opens a bar above the script. It finds in section
  titles, Dialogue, On screen and the notes and link names in Images & files, never in file names or links, and marks
  every match (the one you're on darker). Enter and Shift+Enter step through; Match case and Whole words narrow it.
  Replace changes the match you're on and goes to the next; Replace all changes every one, with Undo at the bottom. A
  replacement takes the capitals of the word it replaces (Glucose becomes Sugar). Esc closes the bar; Ctrl+F from
  inside it gives the browser's own find.
- **Flags:** flag a row to come back to it (the flag under its number, shown when you point at the row), with an
  optional note such as "Needs a source". Step through flagged rows with ‹ › above the table and Clear each one.
  Review shows them, the list counts them ("2 flagged"), and they are listed before Approve. Flags never change the
  script, never make a History version and never show in exports.
- **Voice-over:** the mic beside each row's dialogue records a take of that line (grey: none yet; blue: there is
  one). Play it back, see its length and words a minute, record again or delete it. A take says Outdated once its
  line changes; its × hides it when the take already says the edited line (words a minute then counts the new words,
  and the next edit shows Outdated again). Takes are kept in the script's `voice/` folder, so OneDrive shares them.
  The top bar shows the takes' length and the whole script's length beside the save status ("0:14/2:05").
  Export > Voice-over (.wav) joins every row's take, in row order, into one file for the edit. Its preview plays the
  file and lists the rows (click one to hear it from there); settings add half a second between takes, or silence
  for rows with no take (as long as their read time).
  ⋯ > Settings picks the microphone takes are recorded with (remembered in this browser). The computer's own default
  is marked "(default)" and is used until you pick another. If the picked one is unplugged, the take is recorded with
  the default microphone and the page says so.
  Clicking the mic records at once: a red ring fills round it for a second, then it turns into ■, your cue to read
  (Esc while the ring fills throws the new take away). The silence before your first word and after your last, and
  the click of the mouse, are cropped off; hover a take's ▶ to see how much. Settings > Voice-over switches the
  clean-up: crop the silence, the browser's noise reduction, and making every take equally loud. The recording itself is
  kept whole, so turning crop or loudness off brings it back.
- **Play the script:** once a row has a take, ▶ Play in the top bar goes through the script line by line and plays
  each take in time; the line being spoken is tinted and the page follows it. A row with no take waits in silence
  for its read time. With the mouse on a row, its number becomes ▶: click it to play from there (the row playing shows ❚❚); pause with the same button or Space, stop with ■ or
  Esc. It works the same in Review, where each line also shows its take to listen to, without the mic or delete.
- **Assets:** the Assets tab lists every file, link and "still to find" note in the script once, with the rows that
  use it, with a thumbnail for pictures, PDFs and videos: what is missing from the folder first, then what is still to find or film, then the rest (or by row).
  The tab and the script list show how many files are missing. A row number goes to that row.
- **Two people:** the top of a script says who else is editing it. Their saved changes appear on their own. If you
  both saved at the same time, the two are combined row by row; only a place you both changed is shown side by
  side for you to pick.

Needs Chrome or Edge on a desktop computer. The code is on GitHub (the link in the bottom-right corner). The bottom-left corner shows the live version, "PR #62" for
example: after a refresh it tells you whether a new version is live, hovering shows what that version added and when,
and clicking opens it on GitHub.

## For developers

`npm ci`, then `npm run dev`. Checks: `npm run check`, `npm test`, `npm run e2e`.

License: GPL-3.0.
