## 2026-08-17 · fix(booking): the agree RPC stamps the link it was always said to stamp

`vendor_agree_to_lock` flipped a row to `contracted` without writing
`linked_vendor_profile_id` or `selection_match_rank` — while
`app/dashboard/[eventId]/vendors/actions.ts` asserted in a comment that it wrote
both "exactly as `acquire_service_time_slot` already does". Read out of
production with `pg_get_functiondef`: `acquire_service_time_slot` does; this one
did neither.

The instant `NEXT_PUBLIC_LOCK_HANDSHAKE_ENABLED` goes on, the supplier's yes
becomes the only thing that creates a booking — so every handshake booking would
have been a `contracted` row with a NULL link, i.e. invisible to the ~10 features
that key off it (the supplier doorway on `/{slug}`, editorial first-pick credit,
Real Stories credit, Papic attribution, stage-note recipients, showcase credits,
the verified median, fraud detection, the plausibility scanner, venue-room-size).

Done now because it is inert now: 0 rows carry a lock-request marker, 0 asks are
in flight, 0 rows carry a link, and the flag is off. Nothing to migrate, nothing
to strand.

- migration `20271144481150` — the flip now also sets `selection_match_rank = 1`
  and `linked_vendor_profile_id = COALESCE(marketplace_vendor_id, …)`, the shape
  copied from `acquire_service_time_slot` rather than retyped. Everything else in
  the 280-line body is reproduced verbatim from `20271144258091`.
- the false comment in `vendors/actions.ts` is corrected in place and now names
  the test that keeps it true.
- `tests/db/agree-stamps-the-link.db.test.ts` — 4 tests that CALL the function and
  read the row back. A source guard grepping the migration for the column name
  passes on a comment; this project has shipped that guard before.

Covered package lines are deliberately NOT stamped — nothing anywhere stamps
them, on any booking path. Matching the anchor-only behaviour keeps the two paths
identical; changing it is a separate question.

Writing the test disproved my own reasoning for the `COALESCE`: a CHECK
constraint already forbids a pending ask with a NULL marketplace vendor, so the
row it defends against cannot exist. Kept as defence in depth, relabelled as
such, and the constraint is now pinned by a test so whoever relaxes it is told.

SPEC IMPACT: None. Behaviour under the flag only; flag remains off.
