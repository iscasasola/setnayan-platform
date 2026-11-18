## 2026-11-18 · fix(admin): the owner's confirmed request is frozen during its 24-hour wait

Opus review of the admin team slice. Once the owner typed the word, the row was
still writable by any admin's browser session (admin RLS UPDATE policy), so a
staff admin could change what the runner executes (target, payload, action) or
reopen a request the owner had cancelled, and the runner would run it with the
service role. `guard_owner_self_approval` now refuses any browser-session
update to a confirmed row, freezes what was confirmed for every role (the
owner's id may still go to NULL on erasure), and keeps a closed request closed.
Test: `tests/db/admin-areas-and-owner-self-approval.db.test.ts` (fails before).

SPEC IMPACT: None
