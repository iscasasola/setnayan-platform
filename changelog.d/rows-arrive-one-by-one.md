## 2026-09-28 · feat(hub): a scene's list rows arrive one by one as the guest scrolls

Owner, on the Schedule scene's run of show: *"how can the load as we scroll up one by one?"*
(DECISION_LOG 2026-09-28 "LIST ROWS ARRIVE ONE BY ONE AS THE GUEST SCROLLS"). A scene set to
"One part after another" staggered only its direct children, so the run of show's `<ol>` — one
part — arrived as a single block.

- **One marker, the shipped motion.** A widget marks the container whose children are its rows
  with `data-hub-rows` — the run of show, the dress code's roles, the photo moments. A new block in
  `globals.css` ("THE ROWS OF A LIST") makes each row a part with the SAME `--hub-part-*` values:
  the scene's own In (kind + direction), duration, ease, stagger and Plays once / Follows the
  scroll. The list's own part stands still so two opacities never multiply.
- **Plays once:** the page's one observer (`PahinaMotionObserver`) now also marks each row
  `.pahina-in` as it nears the screen, numbering rows that arrive together `--hub-row-at` 1…8
  (`HUB_SEQUENCE_DEPTH`), so they come in turn one stagger apart. **Follows the scroll:** each row
  rides its own `view()`, arriving as it enters and handing off as it leaves.
- **Fail-visible:** inside the scroll-timeline and no-reduced-motion gates and `@media screen`;
  no script → no mark → the row simply sits there. Still / All at once, free scenes (no
  `sequence` without Pro), the Maker tiles (frozen), and pinned Scrub / Auto runs are unchanged —
  inside a run the list still arrives as one part (a pinned row's `view()` never moves).
- Guard: `lib/list-rows-arrive-one-by-one.test.ts` (17 tests, 12 sabotages caught).

SPEC IMPACT: None — implements the 2026-09-28 DECISION_LOG row as written. Open for the owner:
inside a pinned Scrub or Auto run the list keeps arriving as one part (see PR body).
