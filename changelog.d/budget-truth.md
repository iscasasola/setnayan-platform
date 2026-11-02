## 2026-07-29 · fix(budget): the couple's budget lists only lines actually in the booking — plus the charges they actually picked

`budget.ts` built package budget lines from EVERY `vendor_package_items` row
minus `removed_item_ids` — the bug class the booking receipt already fixed and
the budget missed: an optional ADD-ON (never inside the price) showed at its
replacement value as a cost nobody paid, and every FOLLOW-UP (DB-forced to
`is_default_included = FALSE`) landed as a cost even when never revealed.

The select is now the canonical `VENDOR_PACKAGE_ITEM_SELECT`; base lines come
from `keptItemRows` (extracted from `keptItems` — one shared definition of
"lines that survived customization", never forked); and the charged picks and
extra hours the couple explicitly chose appear at their FROZEN lock-time deltas
via `snapshotChargeLines` — the same itemisation the receipt and vendor
workspace render, so all three surfaces tell one story. Legacy bookings with no
snapshot show base lines only. ₱0 picks are delivery detail, not money — the
budget lists charges only. Pure helper `packageBudgetLineItems` + 6 tests
(add-on absent · unrevealed follow-up absent · removed out/required survives ·
frozen deltas in · legacy safe · junk-json total). dup-rule baseline SHRANK by
the 14 budget.ts omission lines.

SPEC IMPACT: None
