## 2026-09-11 · feat(story): the A3 keepsake and A4 booklet print each hand-arranged moment as the host laid it out

Step 7 of `10_WHAT_IS_LEFT_SESSIONS_2026-09-10.md` — the last of the Story print
build, after step 2 (A4 one-minute-per-page) and step 5 (guests see the
arranged pages). Reuses both without a second renderer: `ArrangedSheet`
(step 5's) draws every hand-arranged page, `loadStoryPages` (step 3's one
gated door, S3 + S14) is the only way either format reads the arrangement.

- **THE A4 SEAM IS FILLED IN.** `keepsake-layout.ts`'s `A4PageSource.arranged`
  was a placeholder (`{ sheetId, chapters }`) nothing produced; it now carries
  a real `DrawnSheet` and `arrangedA4PageResolver` inserts one arranged page
  per hand-arranged moment, in time order, alongside the mechanical
  one-minute-per-page default — never merging or dropping a chapter. A story
  in Automatic paginates byte-identical to before this PR (`buildA4Pages`'s
  default is unchanged).
- **THE A3 KEEPSAKE HAD NO SEAM AT ALL — built fresh, and FLAGGED as a
  judgment call.** A composed sheet (up to 660 units wide, growing downward)
  does not fit the curated front/back compact chapter grid, so each
  hand-arranged moment gets its own dedicated broadsheet side instead,
  appended after the front/back in the story's own time order
  (`orderSheetsForPrint`) — the couple's locked close + QR colophon move to
  the last such page, same "always the last element on the last side" rule
  the curated sheet already followed. An alternative (squeezing a shrunk
  sheet into the compact grid) was rejected: it would either enlarge the
  host's composition past its own 660-unit sheet (softening a photo they
  sized for a page) or shrink it illegibly.
- **ONE PHOTOGRAPH, ONE PLACE, ON PAPER TOO.** Both formats now strip a
  chapter's media of any capture a sheet already shows
  (`withoutPlacedMedia`/`refsOnSheets`, the exact functions the public page
  uses) before laying out the curated grid or counting minutes — the same
  rule `story-spine.tsx` enforces on screen, so a photo the host moved onto a
  page never also prints, a page apart, inside its origin minute.
- **NEITHER FORMAT CLIPS AN ARRANGED PAGE.** The curated grid's fixed
  420mm/297mm page height + `overflow: hidden` is right for content this
  route already caps; a host's own composition isn't, so its page lifts the
  fixed height and the clip (`min-height` + `overflow: visible`) rather than
  silently cutting off the bottom of a tall sheet.
- A taken-back photo (S14) already never reaches `loadStoryPages`'s resolved
  sheets, and already never reaches a chapter's media via the editorial
  loader's own consent veto — this step adds no new read of either kind
  (`the-public-story-reads-the-arrangement-once.test.ts` extended to pin the
  print route's own call site, test 5).

**Tests:** `arranged-pages.test.ts` (new) — chapter preservation, sheet-before-
minute-at-a-tie ordering, an untimed host-added moment still placed, the
one-photo-one-place strip, and a sabotage proving a resolver that forgets to
strip a placed capture is caught. `a4-pagination.test.ts` updated for the new
`arranged` shape (same invariant: every chapter is still exactly one minute
page). `the-public-story-reads-the-arrangement-once.test.ts` gains a 5th test
pinning the print route's `loadStoryPages` call site. All pass (`# tests 17` /
`# tests 28` on the two suites); `TSC_EXIT=0`.

SPEC IMPACT: None — the design docs already named this step's shape
(`08_Build_Order.md` step 7); the A3 dedicated-page judgment call is flagged
above and in the PR body for owner sign-off, not silently decided.
