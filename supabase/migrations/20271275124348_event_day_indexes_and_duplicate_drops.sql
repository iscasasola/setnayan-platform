-- ============================================================================
-- Event-day load · two missing indexes, two duplicate indexes dropped
-- ============================================================================
--
-- Measured on production 2026-10-18 (SELECT-only reads of pg_indexes,
-- pg_constraint, pg_depend, pg_stat_user_tables and the performance advisor).
--
-- ADDED
--   • event_moderators(user_id) — every "which events do I moderate?" lookup
--     (current_moderator_event_ids(), moderator_area_level(), the moderator arms
--     of the papic/editorial policies) filters on user_id alone. The table's only
--     index containing user_id is the (event_id, user_id) UNIQUE key, whose
--     leading column is event_id, so no index can serve a user_id-only lookup.
--     event_members already HAS both indexes the load audit asked for
--     (event_members_user_id_idx, event_members_event_id_user_id_key) — nothing
--     is added there.
--   • chat_messages(thread_id, created_at DESC) — a conversation is read in time
--     order and the unread count compares created_at inside one thread. The
--     existing chat_messages_thread_id_idx stays (an index nobody measured as
--     unused is not dropped on a guess).
--
--   ⚠ HONEST SCALE NOTE: today these tables hold a handful of rows, and at that
--   size the planner correctly prefers a sequential scan even where an index
--   exists (event_members has a user_id index and still shows mostly seq scans).
--   These indexes pay off as the tables grow, not on day one.
--
-- DROPPED (each pair is byte-identical; the survivor is the one a constraint
-- depends on, so nothing that references the pair changes)
--   • guests_event_guest_key  = guests_event_guest_uniq (event_id, guest_id).
--     All five composite foreign keys that point at guests(event_id, guest_id)
--     — guest_checkins, guest_souvenir_claims, event_service_deliveries,
--     march_walks, march_not_walking — depend on guests_event_guest_uniq; nothing
--     depends on guests_event_guest_key. Uniqueness of (event_id, guest_id) is
--     unchanged: the survivor is UNIQUE too.
--   • comp_grants_public_id_unique = comp_grants_public_id_key (public_id).
--     The UNIQUE CONSTRAINT comp_grants_public_id_key owns the survivor; the
--     dropped one is a stray plain unique index with no dependants (no migration
--     in this tree creates it, so the replay never had it — IF EXISTS).
--
-- A DROP that something still depended on would ERROR, not cascade: no CASCADE
-- is written, so a dependency this measurement missed fails the apply loudly.
--
-- Plain (non-CONCURRENT) CREATE INDEX on purpose: CONCURRENTLY cannot run inside
-- a transaction block, and these tables are tiny, so the build lock is brief.
-- ============================================================================

CREATE INDEX IF NOT EXISTS event_moderators_user_id_idx
  ON public.event_moderators (user_id);

CREATE INDEX IF NOT EXISTS chat_messages_thread_created_idx
  ON public.chat_messages (thread_id, created_at DESC);

DROP INDEX IF EXISTS public.guests_event_guest_key;

DROP INDEX IF EXISTS public.comp_grants_public_id_unique;
