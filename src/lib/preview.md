# `src/lib/preview.ts`

What preview a file gets (AP-19, mock-up 41), and making it: a blob URL for pictures, video and sound; a PNG of a
TIFF (UTIF) or of a PDF's page 1 (pdf.js) with its page count; the first 3 lines of a text or Word file. Also
`kindName` for chips with no preview, and `clock` for lengths.

- **Used by:** `screens/Preview.svelte`, `FilesCell.svelte`, `Attached.svelte`, `Assets.svelte`.
  **Tests:** `tests/unit/preview.test.ts`, `tests/e2e/previews.spec.ts`.

## Rules and pitfalls

- pdf.js (about 1.7 MB with its worker) and UTIF (about 80 KB) are imported dynamically, so they are fetched only
  when a PDF or TIFF is shown, never on the app's first load.
- A .docx is unzipped with the browser's own `DecompressionStream('deflate-raw')`: no zip library. Only stored and
  deflated entries are read; the CRC is not checked.
- Text files: only the first 16 KB is read.
- Anything that fails (a damaged file, a .pdf that isn't one) gives null: no preview, never an error.
- The caller revokes each preview's URL (`revokePreview`) when done; a video's still too.
- AP-39: pictures and TIFFs bigger than 240 × 640 px become a small WebP copy (`shrink`); SVG and GIF stay as they
  are. A video becomes a still from 0.1 s plus its length (`videoStill`, 15 s at most); the file's URL is kept for ▶.
  One the browser can't decode gives null. Camera photos shown as themselves made scrolling crawl.
- At most two previews are made at a time (`turn`): many rows coming near at once held up the page for a second.
- `UTIF` has no types: the few used are declared in `src/globals.d.ts`.
