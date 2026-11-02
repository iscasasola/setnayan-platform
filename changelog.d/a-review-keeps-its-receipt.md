## 2026-08-24 · fix(reviews): a preserved review keeps its receipt

Slice 1 (`20271153093180`) made a review outlive its event. Measured in
production 2026-08-24 in a rolled-back transaction, it also **stripped the
review's receipt in the same statement**: `booked_through_setnayan` went
`TRUE → FALSE` at the delete.

The FK's own `ON DELETE SET NULL` is an **UPDATE**, and
`vendor_reviews_stamp_provenance` is `BEFORE INSERT OR UPDATE` — so nulling
`event_id` re-derived provenance from an event that no longer exists, and
`review_is_booked_through_setnayan(NULL, …)` answers FALSE for every genuine
booking. The supplier kept a row that `vendor_trusted_review_stats` no longer
counts and the public card no longer marks "Verified booking".

`stamp_review_provenance()` now returns early and unchanged when `event_id IS
NULL`. A live review is stamped exactly as before; an orphan's receipt is
frozen at what it was proven to be. Migration `20271164778235`.

4 db tests, the guard mutation-checked by occurrence count (1 → 0, two tests
red). Prod holds 0 reviews, so nothing is migrated or backfilled.

SPEC IMPACT: None — implements the fix already prescribed in
`VENDOR_DATA_SURVIVES_DELETION_2026-08-21.md`.
