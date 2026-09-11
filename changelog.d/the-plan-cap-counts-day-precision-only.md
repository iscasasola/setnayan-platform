## 2026-09-11 · fix(vendor-caps): the plan's customers-per-date ceiling counts day-precise events only

FOLLOW-UPS A item 2 (found by LOCK-PATH 2). A month-only event stores the 1st of
its month in `event_date`. The per-plan ceiling
(`enforce_vendor_whitelist_per_date`, counted by `vendor_whitelist_used_for_date`)
ignored `event_date_precision`, so a Free shop (ceiling 1) chasing a month-only
March couple refused a real 1 March couple. It also capped the month-only
couple's own accept against that placeholder.

Migration `20271224170958_the_plan_cap_counts_day_precision_only.sql` changes
three functions. Each is re-signed from its LIVE production body (md5 equal to
`pg_get_functiondef` on prod) and changed only in these lines (line-hash diff in
the PR):
- `vendor_whitelist_used_for_date`: `+ AND e.event_date_precision = 'day'`.
- `enforce_vendor_whitelist_per_date`: a non-day event is not capped.
- `vendor_whitelist_pressure`: the same, so the screen never shows a cap the
  trigger wouldn't apply.

This now matches `service_card_bookings_on` (#5441) and `vendor_soft_holds_on`
(#5444). Production (read-only): caps are ON; 4 day-precise dated events (1 with
an accepted thread) and 1 year-precision event (none accepted), so nothing in
flight changes.

Guard: `tests/db/the-plan-cap-counts-day-precision-only.db.test.ts` has 6 cases,
including the replayed bug, a positive control, and a neutralisation run. It was
mutation-checked 3 ways. Three existing suites (`custom-buys-no-limit`,
`the-plan-says-its-number`, `vendor-tier-pipeline-caps`) inserted dated events at
the column's default `'year'` precision. Their fixtures now say `'day'`, which is
what "a couple with a date" means.

SPEC IMPACT: None.
