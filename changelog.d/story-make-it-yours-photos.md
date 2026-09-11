## 2026-09-11 · feat(story): "Make it yours" — the photo half of the Story Maker's story step

Step 4 of `Design_Editorial_By_The_Minute_2026-09-07/10_WHAT_IS_LEFT_SESSIONS_2026-09-10.md`. The
Story Maker's **The story** step now opens on *Make it yours*, ported from the owner-passed
`prototypes/story_make_it_yours_2026-09-10.html`: the moments beside the page; the fixed 660-unit
sheet scaled to fit; the tray of Papic photos AND snippets that are on no page; a tap is the add
(first free slot, never over words); the × on every photo, always showing, counter-scaled, no
invisible halo; a drag that starts past 4px (10px for a finger), brings the photo to the front and
grows the sheet downward; Automatic (read-only, every refusal says why, on a tap not a swipe) vs
I choose (starts from what Automatic made); Put all back; Undo for every removal, owned by the
action; every change autosaved through step 3's `saveArrangement`; the keyboard (Tab, Enter,
arrows move, Delete, Cmd/Ctrl+Z). No pop-ups; aria-disabled, never `disabled`. The shipped
editor's sections stay below it, untouched. Not here (step 6): words, looks, the phone toolbar,
naming, sets, moment reorder. No stickers (owner, for now).

- `lib/make-it-yours.ts` — every move is a pure function that ends in the server's own
  `resolveArrangement`, so Automatic re-derives exactly as a reload would and the tray is
  recomputed, never patched. `lib/make-it-yours.test.ts` (12, incl. a 2,000-move random run).
- `app/dashboard/[eventId]/story/_lib/load-make-it-yours.ts` — shapes step 3's one read for the
  browser; storage keys never leave the server (signed display addresses only).
- `lib/story-arrangement-store.ts` — `LoadedArrangement` now also returns the run of show it
  sorted by (empty for a reader the guests' layer refuses), so the editor re-derives Automatic
  from the same blocks instead of reading them twice.
- Found by driving it in a real browser, fixed: an earlier save coming back said **"Saved"** while
  the newest change (a drag) still waited its 400ms turn — a host who reloaded on "Saved" lost it.
  "Saved" now appears only when nothing newer is waiting; a tab put away saves at once.
- Guards: `make-it-yours-keeps-what-the-browser-found.test.ts` (10 rules, each sabotaged red);
  the new load joins `an-optional-load-cannot-take-the-page-down.test.ts`.

⚠ Driven with Playwright at 1280 mouse and 390 touch against the real component, the real step-3
read and the real step-3 save function, over an in-memory stand-in for the database (this machine
cannot hold the production service role). The browser half of the live database path was not
driven end to end; that is step 8.

SPEC IMPACT: `Design_Editorial_By_The_Minute_2026-09-07/10_WHAT_IS_LEFT_SESSIONS_2026-09-10.md`
(step 4 row) and a `DECISION_LOG.md` row — the step's two flagged calls (the old sections stay
below "Make it yours"; a snippet's badge reads "Snippet", not a length, because `papic_photos`
stores no clip duration).
