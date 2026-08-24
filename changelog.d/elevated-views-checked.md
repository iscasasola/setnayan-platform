## 2026-08-24 · security(db): the two elevated-rights views are checked, and the check is pinned

`events_host` and `vendor_completed_events` — flagged since 2026-08-23 as
"carrying elevated rights, never checked" — are now checked against production
by the object. Verdicts: `events_host` is safe-shaped (authenticated-only; its
WHERE clause is the whole gate, and it redacts exactly one column — the
encrypted photo-delivery OAuth token); `vendor_completed_events` is public on
purpose, with its status / fraud / self-dealing redactions doing the work.

New guard `apps/web/tests/db/elevated-views-checked.db.test.ts` (7 tests): an
inventory invariant (the definer views readable by an app principal must be
exactly the registered two — a new one arriving via default privileges goes
red), behavioural pins that a signed-in stranger reads zero rows through
`events_host` and that self-dealt or merely-shortlisted bookings never reach
the public track record, a neutralisation leg proving the WHERE carries the
safety, and the OAuth-token redaction pin. Two migration-level sabotages
(rogue definer view · unredacted rebuild), both measured present 1 → absent 0,
both red. No migration — nothing in prod needed changing.

SPEC IMPACT: None
