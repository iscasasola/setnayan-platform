## 2026-10-18 · perf(db): event-day load — the hot tables' policies read the caller once; two indexes; two duplicate indexes dropped; the unread badge asks once per burst

Owner, 2026-10-18: make sure the app does not collapse when a lot of people
connect to one event. Lane L4 (database) of the event-day load audit.

- **`20271274849201_event_day_policies_read_the_caller_once.sql`** — in 37
  row-level-security policies on the fifteen tables an event day hits hardest
  (events, event_members, event_moderators, guests, orders, payments,
  notifications, the papic_* tables, vendor_profiles), every bare `auth.uid()`,
  `auth.jwt()`, `auth.role()` and `is_admin()` is wrapped as `(select …)`, so
  Postgres reads the caller once per query instead of once per row (Supabase
  advisor `auth_rls_initplan`). Nothing else in any policy changes. The text is
  production's live `pg_policy` text — measured byte-identical to the replay's
  before writing it. The migration refuses to commit unless every new predicate
  is its old text plus exactly that wrapping. `count_unread_message_threads()`
  gets the same wrapping inside its body.
- **`20271275124348_event_day_indexes_and_duplicate_drops.sql`** —
  `event_moderators(user_id)` and `chat_messages(thread_id, created_at DESC)`
  added; `guests_event_guest_key` (duplicate of `guests_event_guest_uniq`, which
  the five composite FKs depend on) and `comp_grants_public_id_unique`
  (duplicate of the `comp_grants_public_id_key` constraint) dropped.
- **Unread Messages badge** — a burst of chat messages fired one count RPC per
  message; it now asks once after the burst settles (`lib/settle-burst.ts`).
  Same final number.
- Proof: `apps/web/tests/db/event-day-policies-admit-the-same-rows.db.test.ts`
  (text proof + six callers × fourteen tables × read/update/delete/insert,
  before vs after; sabotage-checked three ways) and
  `apps/web/lib/the-unread-badge-asks-once-per-burst.test.ts`.
- Not changed, on purpose: `claim_periodic_job` callers are already throttled
  per instance before the RPC (`CHECK_THROTTLE_MS` in `lib/periodic-jobs.ts`)
  and fire from the home page / explore / admin, not guest event pages;
  `app_telemetry_logs` stays in the realtime publication because
  `/admin/connection-logs` listens to it live.

SPEC IMPACT: None.
