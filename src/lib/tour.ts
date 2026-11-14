// The guided tour in the example (AP-34, board 53; brought up to date by AP-47, board 66): a few steps per tab, each pointing at a part of the page marked
// with data-tour="…". Only the example shows it. Each tab's tour plays once by itself; Skip tour stops them all.

import { keep, recall } from './remember';

export type Tab = 'write' | 'review' | 'history' | 'assets';
export type Step = { target: string; title: string; text: string };

export const TABS: Record<Tab, string> = { write: 'Write', review: 'Review', history: 'History', assets: 'Assets' };

// Keep these in step with the app: when a feature named here moves or changes, change its step (tests/e2e/tour.spec.ts
// plays every tour and fails if a step's part is gone).
export const TOURS: Record<Tab, Step[]> = {
  write: [
    { target: 'row', title: 'A row is one moment', text: 'What is said, what is on screen, and its pictures and files, side by side. Click any cell to type; hover for its tools: move, flag, add, delete, or § to make a section.' },
    { target: 'take', title: 'Record the voice-over', text: 'The microphone records a take of this line. This example has takes already: Play in the top bar plays the whole script with them.' },
    { target: 'files', title: 'Pictures and files', text: 'Drop a file here, paste a link, note something still to find, or pick a file from another script. Click one to preview it.' },
    { target: 'timeline-bar', title: 'Holds and placeholders', text: 'A bar between rows: hold the last picture 2 s, or keep 3 s for a shot still to come. Click it to change the seconds or the words.' },
    { target: 'side', title: 'Planning and comments', text: 'Planning holds the goals and an outline. Comments lists what reviewers asked for, sorted by line, time or type; put one On hold to shelve it for later.' },
    { target: 'timeline', title: 'The storyboard timeline', text: 'The video in rough: every row\'s pictures in order, timed by its take. Click a block to pick its pictures or cut on a word. While the script plays it sticks to the bottom, with a small preview.' },
    { target: 'presence', title: 'Saved, and who was here', text: 'Every change saves as you type, beside how long the script runs. "Ana was here": click it to see everyone who opened the script.' },
    { target: 'actions', title: 'Play, share and export', text: 'Play the script, copy a link, print, or export. ⋯ has Find and replace, Teleprompter, Credits and Settings, where you can change the keyboard shortcuts or hide help text like this.' },
  ],
  review: [
    { target: 'review-note', title: 'The note from the writer', text: 'What Sam asked when sending it for review again. The number on the Review tab was the rows changed since it was sent back.' },
    { target: 'review-changed', title: 'What\'s changed', text: 'Rows changed since the last review are marked in blue, with what they said before.' },
    { target: 'review-row', title: 'Select text to comment', text: 'Select any words, then press Comment to comment on them or suggest new ones. Comment on a row works too.' },
    { target: 'review-folds', title: 'Fold a column', text: '‹ folds a column you don\'t need right now; a grey dot shows a row has something in it.' },
    { target: 'review-cards', title: 'Comments and suggestions', text: 'Reply, resolve, accept a suggestion, or put a comment On hold. Sort them by line, time or type.' },
    { target: 'review-timeline', title: 'The timeline, to look at', text: 'The same timeline as Write, read only. Comment on a block and it lands on its row, "on the timeline".' },
    { target: 'actions', title: 'Approve or send back', text: 'When you are done, approve the script, or send it back to the writer with a note.' },
  ],
  history: [
    { target: 'versions', title: 'Every version', text: 'Each save is a version, newest first, with who made it, when, and the note sent with it.' },
    { target: 'changes', title: 'What changed', text: 'Old words struck through, new ones in green. Restore this version brings back any older one.' },
    { target: 'publish', title: 'Official versions', text: 'Publish a named version, v1, v2 …, when a draft is signed off. The small saves between them fold away.' },
  ],
  assets: [
    { target: 'assets-list', title: 'Everything the video needs', text: 'Every file, link and "still to find" note in the script, grouped by what needs doing.' },
    { target: 'assets-jump', title: 'Go to the row', text: 'A row number takes you to that row in Write. A name opens the file or link.' },
    { target: 'assets-order', title: 'Two ways to list', text: 'By what needs doing, or row by row under the section names.' },
  ],
};

// The last card of each tab: hands the page over.
export const YOUR_TURN: Record<Tab, string> = {
  write: 'Press Play to watch the timeline play along, or try anything: nothing leaves this browser, and Start over puts the example back. Review, History and Assets each have a short tour too.',
  review: 'Try a comment or a suggestion, then see it from the writer\'s side in Write.',
  history: 'Change a word in Write, then come back here to see it as a new version.',
  assets: 'That is the tour. Take the tour, in the blue strip, plays a tab\'s tour again.',
};

const SKIPPED = 'tour-skipped';
const SEEN = 'tour-seen';

// Whether a tab's tour should play by itself: not skipped, and not seen yet in this browser.
export function tourDue(tab: Tab): boolean {
  return recall(SKIPPED) !== 'yes' && !seenTabs().includes(tab);
}

export function tourSeen(tab: Tab): void {
  if (!seenTabs().includes(tab)) keep(SEEN, [...seenTabs(), tab].join(' '));
}

// Skip tour: no tab plays its tour by itself again (Take the tour still does).
export function skipTours(): void {
  keep(SKIPPED, 'yes');
}

function seenTabs(): string[] {
  return recall(SEEN).split(' ').filter(Boolean);
}
