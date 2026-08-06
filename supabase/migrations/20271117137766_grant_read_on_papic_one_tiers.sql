-- `papic_one_tiers` is readable by NOBODY, and the couple's Papic page reads it
-- on every load.
--
-- Live evidence, 10 occurrences across 2 users, last seen 2026-08-06:
--   [supabase:anon] 403 /rest/v1/papic_one_tiers — 42501: permission denied
--   routes: /dashboard/[eventId]/studio/papic
--
-- The table shipped with RLS ENABLED, **ZERO policies and ZERO grants** — so
-- only `service_role` could ever read it. `studio/papic/page.tsx` reads it with
-- the SIGNED-IN client (`fetchPapicOneTiers(supabase)`), which is the right
-- client for a price catalogue; the grant simply never landed.
--
-- 🪤 WHY THIS WAS INVISIBLE. PostgREST returns 403 and `.data` comes back null,
-- so `?? []` downstream renders an EMPTY tier list rather than an error. The
-- page looked fine — the per-camera point buckets were just silently absent, on
-- the exact screen that quotes the couple a price.
--
-- FIXED BY MIRRORING ITS OWN SIBLING, not by inventing a rule. `papic_pass_tiers`
-- and `platform_retail_catalog_v2` are the same kind of thing — admin-editable
-- catalogues with no personal data — and both ship SELECT to anon+authenticated
-- behind a `USING (true)` read policy. This makes `papic_one_tiers` identical.
-- Writes stay service-role only: no INSERT/UPDATE/DELETE grant is added, and the
-- policy is SELECT-only, so the admin editor keeps its exclusive write path.

GRANT SELECT ON public.papic_one_tiers TO anon, authenticated;

DROP POLICY IF EXISTS papic_one_tiers_read ON public.papic_one_tiers;
CREATE POLICY papic_one_tiers_read
  ON public.papic_one_tiers
  FOR SELECT
  USING (true);

COMMENT ON TABLE public.papic_one_tiers IS
  'Admin-editable per-camera rung → lifetime point bucket. Public read (SELECT to '
  'anon+authenticated behind a USING(true) policy), mirroring papic_pass_tiers; '
  'writes are service-role only. Shipped 2026-07 with RLS on and NO policy or '
  'grant, so every read 403''d and the couple''s Papic page quoted from an empty '
  'tier list for weeks.';
