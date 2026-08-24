-- anon_grant_batch7 — the dashboards' fifteen tables give up their public key
--
-- ── WHAT THIS IS ────────────────────────────────────────────────────────────
-- Batch 7 of the anon-grant sweep (batch 6: 20271161191013; batches 1–5 listed
-- there — 87 tables closed before this file). Fifteen tables reached only from
-- the login-gated trees (app/dashboard/**, app/vendor-dashboard/**, app/admin/**)
-- or through the ADMIN client. Every policy on them admits only authenticated
-- principals; a signed-in caller queries as `authenticated`, which this revoke
-- does not touch.
--
-- ── THE GATES, EACH RE-RUN IN PROD ON 2026-08-24 ───────────────────────────
--  1. anon held table-level privileges on all 15 (has_table_privilege TRUE)
--  2. no policy admits anon or PUBLIC (pg_policy.polroles scan)
--  3. none is a base of the three security_invoker views (recursive pg_depend
--     walk: their base set is vendor_ad_subscriptions · vendor_tool_bundles ·
--     vendor_reviews · vendor_profiles · vendor_review_stats)
--  4. no SECURITY INVOKER function executable by anon names any of them — and
--     the pg_proc scan was PROVED able to match before its empty result was
--     believed (a trivially-true pattern returned all 90 anon-executable
--     invoker functions)
--  5. every query site read by file, INCLUDING the constant-indirection shape a
--     `from('name')` grep cannot see: event_vendor_3d_plan_unlocks is reached
--     only through the exported VENDOR_3D_PLAN_UNLOCK_TABLE constant, and every
--     caller passes the ADMIN client (the injected-client helpers soft-degrade
--     on error besides). The public/guest surfaces that mention wall_feed,
--     wall_display_sessions, event_blocked_users, invitation_widgets,
--     guest_columns and photo_messages all query on the ADMIN client —
--     app/api/wall/claim/route.ts even states the invariant this file enforces:
--     "P0 security invariant: no anon read path to wall_feed."
--  6. nothing here creates or replaces an object, so no default privilege is
--     re-applied.
--
-- ── DRY-RUN ─────────────────────────────────────────────────────────────────
-- Executed against production inside an explicitly ROLLED-BACK transaction on
-- 2026-08-24: all 15 moved SELECT true → false. The revoke moves the measured
-- surface — this is not a column-level no-op against a table-level grant.
--
-- ⚠ REVOKE IS A POINT-IN-TIME ACT. The paired test
-- apps/web/tests/db/anon-table-grants-closed.db.test.ts (CLOSED_IN_BATCH_7)
-- re-asserts it forever.

REVOKE ALL ON public.event_blocked_users FROM anon;
REVOKE ALL ON public.event_meaningful_dates FROM anon;
REVOKE ALL ON public.event_recaps FROM anon;
REVOKE ALL ON public.event_vendor_3d_plan_unlocks FROM anon;
REVOKE ALL ON public.guest_columns FROM anon;
REVOKE ALL ON public.invitation_widgets FROM anon;
REVOKE ALL ON public.photo_messages FROM anon;
REVOKE ALL ON public.reel_music_tracks FROM anon;
REVOKE ALL ON public.vendor_calendar_day_states FROM anon;
REVOKE ALL ON public.vendor_creator_offers FROM anon;
REVOKE ALL ON public.vendor_disputes FROM anon;
REVOKE ALL ON public.vendor_schedule_pool_categories FROM anon;
REVOKE ALL ON public.vendor_schedule_pools FROM anon;
REVOKE ALL ON public.wall_display_sessions FROM anon;
REVOKE ALL ON public.wall_feed FROM anon;
