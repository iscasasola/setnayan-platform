-- Papic FREE pool — ARM THE FENCE (owner-locked 2026-07-27: "free is 50 points").
--
-- THE BUG THIS CLOSES
-- ───────────────────
-- The owner locked "Free = a 50-point shared event pool" on 2026-07-22. The DB
-- was built for it — papic_event_pool_status() explicitly branches on "the event
-- holds ANY grant (Free / One / Pool)" — but NOTHING EVER WROTE THE FREE GRANT.
-- provisionFreeCamerasAdmin() materializes the 3 tier='free' seats and stops
-- there, and public.papic_event_point_grants was empty in prod (0 rows, every
-- source).
--
-- The consequence is the opposite of a broken free tier — it is an UNMETERED
-- one. With no pass and no grant, papic_event_pool_status() returns
-- applies = FALSE, and papic_reserve_event_points() then takes its
-- "fence absent -> RETURN TRUE, ledger untouched" branch. So every free event
-- has had UNLIMITED photo + video capture. That is fine while nobody is using
-- it; it is not fine now that Papic is being switched on for every new event
-- across all 16 event types, because it hands every signup unlimited free
-- storage on a product whose storage cost is already an open concern (10s clips
-- are ~2x the bytes, and neither compression nor purge is built).
--
-- WHAT THIS MIGRATION DOES
-- ────────────────────────
--   1. A PARTIAL UNIQUE INDEX so an event can hold at most ONE 'free_grant' row.
--      This is the idempotency backstop: the app-side ensureFreePapicPoolGrant()
--      is called from every event-creation path AND lazily from the Papic studio
--      as a self-heal, so it WILL run more than once per event. Without this
--      index those calls would stack 50s and silently inflate the pool. The
--      index is the hard guarantee; ON CONFLICT DO NOTHING is the soft one.
--
--   2. A BACKFILL granting the same 50 points to every event that exists today,
--      so legacy events are metered too rather than staying uncapped forever.
--
-- WHY 50 IS WRITTEN HERE AND NOT READ FROM CONFIG
-- ───────────────────────────────────────────────
-- papic_tier_config.free.points_per_day is NULL by design (the One-Pool model
-- moved Free off any per-day budget onto the shared pool), so there is no
-- config row to read. 50 is the owner-locked figure; the app mirrors it in ONE
-- exported constant (PAPIC_FREE_POOL_POINTS) and a unit test pins the two
-- together so this number can never drift between the migration and the code.
--
-- SAFETY: additive only. No table is created (so no default-ACL exposure to
-- REVOKE), no policy changes, no column drops. The backfill is a plain INSERT
-- guarded by the new index, so re-running it is a no-op.

-- 1. One free grant per event — the hard idempotency backstop.
CREATE UNIQUE INDEX IF NOT EXISTS papic_event_point_grants_one_free_per_event
  ON public.papic_event_point_grants (event_id)
  WHERE source = 'free_grant';

COMMENT ON INDEX public.papic_event_point_grants_one_free_per_event IS
  'At most one source=''free_grant'' row per event. The free 50-pt pool is armed '
  'from several call sites (every event-creation path + a lazy self-heal on the '
  'Papic studio), so this index is what stops those calls stacking duplicate '
  'grants and inflating the pool. Owner-locked 2026-07-27.';

-- 2. Backfill every existing event with the free 50-point pool.
--
-- Deliberately NOT restricted to events with zero grants: Free is the BASE of
-- the shared pool and paid rungs stack on top of it (a Papic One buyer holds
-- free 50 + camera_grant 250 = 300), so an event that already bought points
-- still gets its free base. The partial unique index makes this safe to re-run.
--
-- NOTE this ARMS THE FENCE on events that were previously uncapped. That is the
-- intent. Prior captures are NOT charged retroactively — the fence-absent branch
-- never wrote to papic_event_pool_usage, so those events start at 0 used and
-- get a full 50 from here on, which is the generous reading.
INSERT INTO public.papic_event_point_grants (event_id, points, source, note)
SELECT e.event_id,
       50,
       'free_grant',
       'Backfill 20271017100000 — free pool armed (owner-locked 2026-07-27).'
  FROM public.events e
ON CONFLICT DO NOTHING;
