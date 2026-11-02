## 2026-08-21 · feat(dashboard): My Events becomes five shelves

Owner 2026-08-21. The board a person lands on had two shelves; it now has five,
and two menus that duplicated it are retired.

**Now happening** (new) · **Planning** (was "Coming up") · **Worth planning**
(new — the Your Year menu's contents) · **Untold** (was "Unpublished") ·
**Told** (was "Published").

- **Put away finally means hidden.** `isFinishedEvent` counts `archived` as
  finished, so putting a celebration away MOVED IT ONTO THE FINISHED SHELF —
  still visible, the opposite of what the person pressed the button for. Rather
  than redefine a resolver the landing rule, the album href and the story split
  all read, `splitPlanningShelves` lifts put-away rows out of every shelf at the
  board and hands them back behind a switch that PRINTS THE COUNT — the answer
  to "is something missing", given before it is asked.
- **A clash is named.** Two celebrations on one day (or a ranged one swallowing
  another) now say so above the Planning shelf, from data already on the page —
  no extra read. Deliberately not styled as an error: two celebrations in a day
  is a thing people do. Finished events are excluded — a clash you can no longer
  act on is a reproach, not a warning.
- **The Your Year menu entry is retired**, its contents mounted as "Worth
  planning". `YearMomentsStrip` HAD NO CONSUMER AT ALL — built, commented as
  living inside Alaala, imported by nothing. This is its first mount. The
  `/dashboard/year` ROUTE is deliberately left alive (it holds the holidays the
  shelf omits, and the shelf links to it).
- **An (i) per shelf**, one full sentence each. ⚠ The page-header (i) was
  retired the same day — *"a lone circle explains nothing"*. This is a different
  position and, by construction, never a lone circle: `SectionLabel` renders it
  only where a sentence was passed.

Guards: `lib/event-board-shelves.test.ts`, 12 tests. **Six mutations, each
verified to LAND by occurrence count (1 → 0) and each turning it red.** M1
(stop lifting put-away out) first stayed GREEN through the composed path —
`splitEventBoard` never hands an archived row to `comingUp` today — so that
filter is tested at its own boundary instead, with the reason it is kept anyway
written down: the coupling that makes it redundant is exactly what this work
stops depending on.

SPEC IMPACT: DECISION_LOG.md row 2026-08-21 (board vocabulary: Now happening ·
Planning · Worth planning · Untold · Told; Your Year retired as a menu).
