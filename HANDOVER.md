# HANDOVER — rd/papic-points-never-leak · started 2026-10-18 by the controller

Owner today on "Papic: points can stay used up if a shot's save fails partway": "build it".
From #6621 (LIVE): the guest-capture route reserves pool points (papic_reserve_event_points / papic_reserve_capture_split)
BEFORE papic_record_guest_capture runs, and releases them only within the same request. If the function dies between the
two (timeout, crash), the points stay spent with no capture. #6621 added client_capture_id idempotency — read its PR body.
FIX: make it impossible for points to stay reserved without a capture — preferably reserve + record in ONE transaction
(one RPC), touching the three balances (event pool, seat split, per-guest ceiling) exactly as today; if that is not
contained, a durable reservation row with a short expiry that a reconciliation releases (no scheduler in this repo by
design — piggy-back on the existing claim_periodic_job pattern). Money-adjacent: no guessed numbers; every amount from the
existing config; a db test proves (a) a capture that dies mid-way leaves the balances as before, (b) a normal capture
spends exactly once, (c) a retry with the same client id spends nothing. Migrations via pnpm migration:new.
Fragment changelog.d/rd-papic-points-never-leak.md.
