## 2026-10-18 · perf(guest-page): the page reads a stamp — what every viewer sees alike is remembered until the event changes

Event-day load, lane L3 (owner 2026-10-18: "make sure app will not collapse when a lot of users are … connecting
to the event"). Settles PR #6454's open call — Option A, a per-event revision stamp.

- **Migration `20271275959355`**: `event_public_revs` (one never-reused rev per event, a global sequence),
  replaced at COMMIT by DEFERRED constraint triggers on every table the guest page shares between viewers
  (events, invitation_widgets, event_editorial, event_vendors, event_recaps, event_floor_plan,
  event_schedule_blocks, march_not_walking, march_walks, creator_chapters; `guests` only when a printed column
  changes — an RSVP or a face-tagging answer does not). `event_public_stamp(slug)` and
  `event_entitlement_facts(event)`. Service-role only.
- **`lib/event-shared-reads.ts`**: the admin client's fetch serves a GET from the data cache only inside a
  guest-page render that opened it (never the Maker canvas / any host param), only for a read provably of that
  event's stamped rows (table, `event_id=eq.`, every column and embed stamped, no per-viewer filter), keyed by
  the whole request + the rev. A refusal is never filed. The shell row rides the stamp in `loadEventShell`.
- **One entitlement-facts request per render** (service role) replaces orders + comp + internal + founder and
  one basket RPC per product; any failure → the old per-fact reads.
- **Session check**: a positive token check is remembered ≤ 30 s per instance, in renders only (actions keep the
  DB check).
- Requests per view (in-repo harness, prod-shaped): stranger 13 → 3 (14 → 4 on the day), invited guest
  17 → 6 (21 → 10), first view after a change 24 → 22; event with orders: stranger 19 → 7, guest 31 → 18.
  Real `next dev` against the counting stub: stranger 14 → 3, guest 22 → 7, with orders 17 → 3 / 25 → 7.

SPEC IMPACT: None — engineering. The owner's 2026-10-18 pick of Option A and the stated ≤ 30 s
session-revocation window are recorded in the PR body for sign-off.
