## 2026-11-27 · fix(seating): every table on the seat plan wears its own short name, never "·" and never a twin

Found in the Apple build 10 walkthrough of Maria & Jose's 2D seat plan: one round read "·" and two tables both read "9".

- **Cause (display, not data):** the plan drew `label.match(/\d+/)`, or "·" when there was no number. Every table a couple names in words read "·": Entourage (the "·" round), Sweetheart Table, the two Family head tables. Two tables whose names hold the same number read alike. A linked unit's members all wear the unit's name, so a linked pair under "Table 9" drew "9" twice.
- **Fix:** one function, `lib/plan-table-badges.ts` (`planTableBadges`), computed once for the whole room:
  - its number, else the initials of its first two words with the small words left out ("E", "S", "FG"), else "T";
  - two that would read alike take a part mark in plan order ("9A", "9B"; "FB1", "FB2"), never one another table already wears.
  - The seat editor's hub, its zoomed-out look and the serpentine ribbon all read it. The table's own name is untouched.
- **Guard:** `lib/plan-table-badges.test.ts`, executed on the sample event's own tables plus a linked pair, and holding the seat plan to the one function. Red without the fix.
- No data change, no server action, no migration.

SPEC IMPACT: None. A label bug on the approved seat plan (drawing § 5, "a table is its number and a ring").
