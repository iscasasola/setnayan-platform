## 2026-10-31 · feat(suppliers): Build drawn to the approved frames — This build ▾ · ＋ New build · Compare builds · Book asks first

Owner, live iPhone: *"I also previously saw you design the Build with a better interpretation where they can create and load build and compare them safely all in one screen."* Drawn to the approved final Suppliers frames 12-build · 12b-build-with-pick · 13-build-compare · 14-build-book (`carry-2026-10-29/suppliers-final-proto/`).

- **One row** (`build-body.tsx`): `This build ▾` — the shared PickMenu of this build and every saved build, each with its total; picking a saved one loads it through the shipped `applyBuildToWorking` (booked categories never re-open; Undo) · `＋ New build` — a snapshot through the shipped `savePlanBuildNamed` (save-as-new into `budget_builds`; no new table, no migration) · one ⓘ holding Booked · If you book these · Budget · Buffer.
- **The budget line + meter**: `₱total of ₱budget budget · ₱buffer buffer` (or "₱N over", or "buffer not knowable" while a price is missing), a booked / if-you-book-these meter and legend, the fit line with Help me choose, then the category lines at once. Sai's watch line moved under the lines.
- **Compare builds**: on a phone a house bottom sheet, 2 side by side (a column's build is a ▾ when there are more), "Hide what's the same", green = lowest total (`lowestTotalIds`: only when every shown build misses the same number of prices), rows Total · Budget left · Free on · each category (full names, "· booked"), Use this build · Rename · Delete this build. From 1024 the same table is the "All builds" pane on the right, 3 side by side; the bar sits under the left pane.
- **Book this build asks first** (`book-this-build.tsx`, frame 14): one row per pick with its price, what booking means, Not yet · ✓ Yes, book them; only Yes runs the shipped booking loop. The button is the bar's main answer and is always shown (with nothing to book it says so); Save is the quiet one. "Save as new" is now ＋ New build.
- Every Build pop-up (Compare, Save, Rename, Book, the booking outcome) is the Schedule's one template (`ScheduleSheet` + `SheetFoot`); its aside now wraps to two lines instead of being cut.
- Dark: the compare's green and the fit line's ✓ no longer flip twice (`dark:text-success-200` / `dark:bg-success-900/40` dropped — the success ramp already flips).
- `lib/suppliers-build.ts`: a card row carries `full` (the whole name) and `booked`; `compareCap`, `compareShownAtFirst`, `lowestTotalIds`, `compareRowIndexes`. Guard `lib/the-build-is-the-approved-frame.test.ts` (5 properties, each sabotaged red once); `build-body.test.ts` moved to the approved words. Port baseline regenerated (`BuildCardColumn`, `Figure` → `CompareTable`, `CardActions`, `BuildFigures`, `Meter`).


Not drawn: the frame's per-head note under a pick ("₱480/head × 150") — no per-head price reaches the Build lines.

SPEC IMPACT: DECISION_LOG.md row 2026-10-31 "SUPPLIERS › BUILD IS DRAWN TO THE APPROVED FINAL FRAMES" (corpus 1aa45bc1).
