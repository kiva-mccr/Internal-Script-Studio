# `src/screens/Preview.svelte`

One file's preview (AP-19, mock-up 41), made by `lib/preview.ts`: a picture (also a TIFF), a PDF's page 1 with
"Page 1 of N", a video with ▶ and its length that plays in place with the browser's controls, a slim sound player
(play/pause, a bar to click, the time), or the first lines of a text or Word file under its kind.

- **Used by:** `screens/FilesCell.svelte`, `Attached.svelte`. **Tests:** `tests/e2e/previews.spec.ts`, `attach.spec.ts`.

## Rules and pitfalls

- At most 120 px tall, like the image thumbnails before it.
- A video shows its still (an `<img>`, AP-39) until ▶; only then is the `<video>` made, playing, with controls. A
  `<video>` per row kept a decoder each and made long scripts slow.
- Video from MediaRecorder (webm) often has no length (Infinity): the length badge is then left out.
- onFail is only for video and sound that won't play; a picture that won't draw just hides itself.
