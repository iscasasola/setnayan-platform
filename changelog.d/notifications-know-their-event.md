## 2026-09-22 · feat(notifications): a notice knows which wedding it is about

`public.notifications` gains an `event_id`.

The table has carried `user_id, type, title, body, related_url, read_at,
created_at` since iteration 0028 and nothing else, so there has never been a way
to ask *"what happened on THIS wedding"*. `sever_event_connections()` states the
gap in its own comment — "`notifications` has neither an event_id nor a
thread_id column, so nothing can cascade it" — and works around it by matching
the **thread** id inside `related_url`, explicitly refusing a match on the event
id because that "would sweep order and payment notifications too".

Measured on production 2026-09-22: **100 rows · 23 distinct types · only 21 rows
contain an event uuid in `related_url`** and 2 carry no `related_url` at all. A
per-event feed built on string matching would silently miss every notice whose
link is not event-shaped — the class of defect where an absence renders as
emptiness.

- **Migration** `20271238868040_notifications_know_their_event.sql` — nullable
  `event_id UUID REFERENCES events(event_id) **ON DELETE SET NULL**`, a partial
  `(event_id, created_at DESC)` index for the per-event read, and a backfill
  derived from `related_url`.
- **⚖ SET NULL, not CASCADE, deliberately.** CASCADE would change what deleting
  a wedding does — it would sweep that event's order and payment notices, the
  exact outcome `sever_event_connections()` avoided on purpose. SET NULL keeps
  today's behaviour byte-for-byte. Whether a deleted wedding *should* take its
  notices with it is left as an owner decision, not smuggled in here.
- **The writer derives the column; ~200 call sites are untouched.**
  `emitNotification` takes an optional `eventId` and otherwise reads it off
  `relatedUrl` via the new pure `lib/notification-event-id.ts`. One rule applied
  once, instead of 200 chances to forget.
- **🔑 A derived event id can never cost somebody their notification.**
  `event_id` is a foreign key and the id is only whatever the link said, so a
  notice about a since-deleted event would be rejected — and this function's
  fail-soft contract would turn that rejection into silence, with the user
  simply never told. The insert now retries once without the column and warns.
  The notice is the product; the column is bookkeeping.
- **No GRANT needed, and a column-level REVOKE here would be a silent no-op.**
  `anon`, `authenticated`, `postgres` and `service_role` each hold
  SELECT/INSERT/UPDATE at the **table** level, so a new column inherits them.
  RLS is unchanged and row-level: recipient-only SELECT/UPDATE, no INSERT
  policy, so only the service-role writer creates rows.

Proof, both directions:

- `lib/notification-event-id.test.ts` — 5 tests over the same 9 cases the
  migration's Postgres regex was verified against, so history and new writes
  agree by construction. The rule lives in a **pure** sibling because
  `notification-emit.ts` is `server-only` and a guard that could only grep the
  writer would prove the call exists and nothing about what it computes.
  Sabotage-checked: dropping the boundary after the uuid turns it red
  (`/dashboard/<uuid>EXTRA/guests` would otherwise return an id that is not in
  the URL — a well-formed uuid, so nothing downstream could tell).
- `tests/db/a-notice-knows-its-wedding.db.test.ts` — 4 tests. The backfill under
  test is **read out of the migration file**, not retyped, so the two cannot
  drift while the copy keeps passing. Asserts the FK is SET NULL *and* that a
  notice really survives its event's deletion (through whatever triggers fire on
  the way), that the `EXISTS` guard holds, and that an explicitly passed
  `event_id` is never overwritten. Sabotage-checked: removing the `EXISTS` guard
  makes the backfill raise a foreign-key violation — which would have aborted
  the whole migration and fail-closed the production deploy, since
  `deploy-prod` runs `db push` before it triggers Vercel.

SPEC IMPACT: None. No product surface reads the column yet — the couple-facing
"From your suppliers" feed it exists for is still a prototype awaiting owner
approval (`prototypes/your_team_redesign_v2_2026-09-22.html`). The two open
questions it raises (CASCADE vs SET NULL on event deletion; whether the feed
groups by supplier) go to the owner, not the corpus.
