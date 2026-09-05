## 2026-09-04 · fix(papic): free credits are per-ACCOUNT, not per-event

The Papic free pool (`papic_event_pool_config.free_grant_points`, 50 by
default) was armed unconditionally on every event via an AFTER INSERT trigger
on `public.events` — a couple who created 3 events (e.g. a wedding + a
birthday + a debut, all valid on one account) got 3x the free allowance,
with no cap across event_type. Owner-confirmed 2026-09-04: the free pool is a
"try Papic once" sample, not a per-event perk.

The seeding trigger (`papic_seed_free_grant_trg`, migration 20270902100836)
moved from `public.events` to `public.event_members` (`member_type='couple'`)
— `events` carries no owner column, so it can never answer "is this account's
first event"; `event_members` is the first point an event has a knowable
owner. An account's first event ever still gets the full admin-configured
allowance; every event after gets a 1-point minimum instead of 0 — a literal
0 would be indistinguishable from no grant at all to
`papic_event_pool_status()` (which fences on `SUM(points) > 0`, not row
existence) and would silently revert the event to unmetered capture.

`apps/web/lib/papic-free-grant.ts`'s `ensureFreePapicPoolGrantAdmin()` gained
the same account-scoped logic as a fast-path / self-heal backstop (it already
raced the DB trigger and always lost before this change — its own docblock's
claim that "nothing ever wrote the free grant" was stale as of migration
20270902100836; the trigger, not this module's insert, has been the live
mechanism). Threaded `user.id` through its 4 event-creation call sites
(`create-event/actions.ts` x2, `onboarding/simple/actions.ts`,
`onboarding/wedding/actions.ts`, `onboarding/_shared/commit-event.ts`); the
Papic-studio self-heal call site resolves the couple's user_id from
`event_members` instead, since the studio visitor need not be the couple.

Migration `20271204225094_papic_free_grant_first_event_only.sql`. Updated 3
pre-existing db-test fixtures (`papic-guest-spend-ceiling`,
`seat-capture-is-atomic`, `papic-dedicated-is-a-floor`) that relied on the old
unconditional "every event is born with 50" behavior — none had ever added an
`event_members` couple row, since real production code always does; the
fixtures now do too, restoring their original math unchanged. New db test
`papic-free-grant-first-event-only.db.test.ts` exercises the trigger directly
against the replayed schema (first event → 50, second event/different
event_type → 1, applies stays TRUE, a non-couple member never seeds a grant).

SPEC IMPACT: Papic free-tier eligibility changes from per-event to
per-account (first event only). Not yet reflected in the spec corpus at
`~/Documents/Claude/Projects/Setnayan/` — flagging for a corpus update
alongside the `DECISION_LOG.md` row.
