-- anon_grant_batch5 — the five tables where the key opens nothing at all
--
-- ── WHY THESE FIVE, AND WHY THEY ARE THE SAFEST IN THE WHOLE SWEEP ─────────
-- Every table below has, measured in production 2026-08-18:
--   • row-level security ENABLED, and
--   • ZERO policies of any kind.
-- Postgres denies by default when RLS is on and no policy admits you, so the
-- anon grant on these tables ALREADY opens nothing. Revoking removes a key to a
-- door that is bricked up. There is no behaviour to change and nothing to break.
--
-- 🔑 THIS IS THE ENTIRE "NO POLICY AT ALL" CATEGORY — after this it is empty.
-- The remaining candidates all have policies that merely exclude anon, which is
-- a different and much more delicate question, because the app reaches many of
-- them through the service role and the grant's absence would be felt only at
-- runtime.
--
-- ── THE GATES, EACH RUN INDEPENDENTLY OF ANY OTHER SESSION'S REASONING ─────
--  1. RLS on + zero policies                     — read from pg_class / pg_policies
--  2. no policy admits anon                      — trivially true, there are none
--  3. no `security_invoker` view reads them      — pg_rewrite/pg_depend, and the
--     query was PROVED able to match by running it against the two tables batch 2
--     rescued, which it found. An empty result from a query that cannot match is
--     not a negative result.
--  4. not queried from any public or guest tree  — app/[slug], app/(shell), app/v,
--     app/papic. One apparent hit on `drive_copy_artifacts` in app/papic/actions.ts
--     is a COMMENT, not a query. ⚠ READ THE LINE, NOT THE COUNT — a grep count said
--     "1 public-tree file" and the truth was zero.
--  5. no DROP/CREATE anywhere here, so no grant is reset — see the note below.
--
-- ⚠ DROP + CREATE IS A RESET, NOT AN EDIT. This database's default privileges hand
-- anon and authenticated INSERT/UPDATE/DELETE on newly created objects. Nothing in
-- this file creates anything, so nothing is re-granted. A migration that rebuilds an
-- object must revoke on EVERY object it rebuilds — on 2026-08-17 one rebuilt three
-- views and revoked on one, leaving two publicly writable until a later guard caught it.

REVOKE ALL ON public.drive_copy_artifacts FROM anon;
REVOKE ALL ON public.event_software_activations_v2 FROM anon;
REVOKE ALL ON public.live_studio_roam_streams FROM anon;
REVOKE ALL ON public.panood_broadcasts FROM anon;
REVOKE ALL ON public.vendor_wallets FROM anon;
