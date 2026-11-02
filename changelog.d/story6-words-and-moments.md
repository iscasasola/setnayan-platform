## 2026-09-11 · feat(story): "Make it yours", part 2 — words, their toolbar, moments, named sets; the older editor folds under "More settings" (step 6)

Step 6 of `10_WHAT_IS_LEFT_SESSIONS_2026-09-10.md`, ported from the owner-passed
`prototypes/story_make_it_yours_2026-09-10.html`. No migration — everything saves through step 3's
one door (`save_story_arrangement`), whose shape already held words, looks, names, order and sets.

- **+ Words** — an empty box with a drawn "Type here" placeholder, placed below everything on the
  page; leaving it empty removes it quietly; clearing words that had text is a removal with Undo;
  plain-text paste only; Escape stops typing and lets go; the ⋮⋮ grip drags (mouse and finger),
  even when a phone hands the press to the text; arrow keys move focused words; Tab out of a
  still-empty box goes to the next control.
- **The words toolbar**, as the prototype draws it — one floating bar, square icon buttons, groups
  split by hairlines: `[ − size + ] | [ A colour ▾ ] [ A background ] | [ ↺ ↻ ] | [ remove ]`. The
  colour menu (Ink · Terracotta · Blue · Gold) opens away from the words; nothing on the bar takes
  the caret; the bar follows the words. On a computer, the round handle resizes and turns (straight
  within 5°), kept on the sheet by the TURNED box; on a phone the handle and the words' × give way
  to the toolbar, which is also the keyboard's route. ⛔ No stickers (owner, for now).
- **Moments** — + New and ✎ as an inline field in the page's header (empty or Escape cancels a
  new moment, and the press that ended the typing still lands); row × with Undo (its photos back
  in the tray, its words back with Undo); grip reorder with mouse and finger (pointer events,
  captured on the list); Alt+Arrow. A row is a list item holding its buttons side by side — never
  a button inside a button.
- **Named sets** — "Name these photos" (2+ photos), one chip per name, the chip says what is still
  free to place and places it, chip × forgets the name with Undo; tray photos carry their name.
- **"More settings"** — the older editor's sections (What goes in · The words · Your photos · As the
  day unfolded · Section order · Your own columns · What they said · What shows) now sit, in their
  order and unchanged, under one closed fold at the bottom of the step. Held by the new
  `more-settings-keeps-every-control.test.ts`, the existing loss-prevention checklist and the
  lost-controls lint (baseline untouched).

**Found by driving it in a real browser, fixed here:** typed letters were wiped on every
keystroke (React 19 re-applies inline HTML whenever its object is new); the toolbar above new words
sat on the photo row and took a ×'s press; clearing then undoing a caption kept the empty box's
size, so Automatic dealt photos under the words; the × was a tall oval (the app's 44px button
floor) instead of the prototype's circle — step 4 shipped that. **Found by the move tests:** + New
could exceed the save's 80-moment ceiling, and a busy moment (400+ photos) could never save once
the host tapped "I choose" — the per-page ceiling is now above the pool's own.

**Proof:** the step-4 Playwright drive, extended in the corpus
(`step4_make_it_yours_drive/mky-step6.cjs`), passes at 1280 mouse and 390 touch with zero dialogs
and zero console errors; 25 guard sabotages each caught; the layout freeze shown necessary (the
drive goes red without it).

SPEC IMPACT: `DECISION_LOG.md` 2026-09-11 row (step 6 — calls flagged for the owner: the older
editor's headline and story now sit behind "More settings"; the phone grip grows outward so words
wrap the same on every screen; the toolbar sits below new words when above would cover a control;
naming moments here is not behind PRO) · `Design_Editorial_By_The_Minute_2026-09-07/10_WHAT_IS_LEFT_SESSIONS_2026-09-10.md`
step 6 row · `step4_make_it_yours_drive/README.md`.
