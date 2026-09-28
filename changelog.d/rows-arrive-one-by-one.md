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
- **Runs too** (owner: *"yes, make pinned rows arrive one by one too"*). In a pinned Scrub run
  row i of n takes the i-th slice of the scene's hold on the spacer's timeline (the window the
  scene's parts already arrive in, ending before the hand-over); in an Auto run the rows arrive
  one stagger apart from the scene's own fade-in on the run's clock and pause with it (a run the
  guest STOPPED lets its rows finish). The observer tells every row its place, `--hub-row-i` of
  `--hub-row-n`.
- **Fail-visible:** inside the scroll-timeline and no-reduced-motion gates and `@media screen`;
  every row binds only once the page's observer marked it (scrolled or pinned) or inside an ARMED
  auto run — no script → the row simply sits there. Still / All at once, free scenes (no
  `sequence` without Pro) and the Maker tiles (frozen) are unchanged.
- Guard: `lib/list-rows-arrive-one-by-one.test.ts` (22 tests, 25 sabotages caught).

SPEC IMPACT: DECISION_LOG.md — one-line "As built" note appended to the 2026-09-28 row "LIST ROWS
ARRIVE ONE BY ONE AS THE GUEST SCROLLS" (what was marked, and the pinned/auto timelines).
