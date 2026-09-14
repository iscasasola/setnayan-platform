## 2026-09-14 · fix(security): only the coordinator may advance the run of show — enforced in the DATABASE

`public.advance_schedule_block(p_block_id uuid)` is SECURITY DEFINER with EXECUTE granted to
`authenticated`, and its third auth arm was `current_vendor_booked_event_ids()` — **every supplier
contracted on the wedding**, caterer and florist included. A booked caterer holding a session token
could advance somebody's ceremony straight over PostgREST, never loading a screen and never calling
a server action. The TypeScript narrowing in `lib/run-of-show-advance.ts` shipped earlier and said so
against itself: *"This is a NARROWING, so it is the enforcement — the DB gate stays wider until a
migration follows."*

Migration `20271227867922_only_the_coordinator_advances.sql` is that migration. One executable line
changes: the vendor arm becomes `current_coordinator_booked_event_ids()` — the SAME
SECURITY DEFINER helper (migration `20271013100000`) the TypeScript gate already uses, reused rather
than re-implemented because a marketplace vendor cannot read their own `event_vendors` row under RLS,
so a hand-rolled booked check would lock the real coordinator out while looking like it worked. The
other three arms (host/couple, delegate with `schedule:edit`, admin) and the entire single-winner /
idempotent body are unchanged. The refusal stays an explicit `42501 not_on_this_event` raised before
any row is touched, so it can never be confused with the RPC's benign `already` /
`noop_live_in_progress` no-ops.

Guard: `apps/web/tests/db/only-the-coordinator-advances-the-programme.db.test.ts` — 15 tests that
**call the RPC directly** against the PGlite replay, as each role, because a test driving the server
action would have passed before this migration existed. Every refusal asserts both the raise AND that
the run-state did not move.

Screen: the supplier client workspace (`app/vendor-dashboard/clients/[eventId]/page.tsx`) passed
`canAdvance` as a hardcoded literal, so every booked supplier saw an Advance button the database now
refuses. It is now computed from the coordinator tile, so the control is absent for the suppliers who
may not use it rather than present and refusing.

⚠ **SURFACED, NOT CLOSED — a second arm of the same gate is still wide.** Arm 1 is
`current_event_ids()`, which is ANY `event_members` row: that includes every accepted delegate at any
permission level (`sync_delegate_membership`, `20271161203067`, mints one on accept) and **every guest
who scanned the event QR** (`app/join/[eventId]/actions.ts` inserts `member_type='guest'`). Measured
in the replay, both can still advance the programme over the RPC. `decideMayAdvance` refuses both, so
nothing reaches it through the app. Owner call: narrowing arm 1 was explicitly out of scope for this
row. Section 4 of the guard records the measurement and is the greppable marker.

SPEC IMPACT: None — this enforces an owner ruling already recorded in code ("only the coordinator runs
the programme") in the layer that can actually hold it. No product behaviour the corpus describes
changes.
