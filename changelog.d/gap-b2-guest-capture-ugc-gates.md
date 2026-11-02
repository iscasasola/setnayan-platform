## 2026-07-24 · fix(papic): restore UGC block + terms gates to the guest-capture RPC

Gap audit 2026-07-23 · Batch B2. `papic_record_guest_capture()` was installed
(migration 20261108000000) as the AUTHORITATIVE server-side gate — returning
`blocked` for a guest in `event_blocked_users` and `terms_required` before a
first upload without `ugc_terms_accepted_at` (Apple 1.2 / Play UGC). Later
re-creations (…216612756 → …303900000 → …903248590 clip-currency) carried the
quota/pool logic forward but silently DROPPED both gates.

The route (`app/api/papic/guest-capture`) still enforces both at the app layer,
so this is **NOT a live bypass** — it restores defense-in-depth to the
`SECURITY DEFINER` function so a direct RPC caller can never deposit under a
block / without terms. Migration `20270920602517` CREATE-OR-REPLACEs the current
clip-currency body verbatim (10s cap, one-pool, PAPIC_UNLOCK, advisory lock, 150
credits) and re-inserts the block + terms gates right after the ownership check.

Verified: full `test:db` replay 102/102 (the RPC replaces cleanly) · timestamp-
guard clean · tsc/lint. (A DB regression test asserting both statuses from the
RPC directly is a noted follow-up — needs the PAPIC_GUEST-ownership fixture.)

SPEC IMPACT: None — restores an authoritative gate to match the app-layer route.
