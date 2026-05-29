-- =============================================================================
-- 20260704030000_v2_phase_h_catalog_seed.sql
-- V2 Cutover · Phase H · platform_retail_catalog_v2 final patch + Pakulay.
-- =============================================================================
--
-- WHY this migration exists.
-- Phase H per CLAUDE.md tenth + eleventh 2026-05-28 rows + v2.1 brief § 5
-- (`/Users/icecasasola/Downloads/CLAUDE-CODE-BRIEF.md` · canonical "this file
-- wins" per project_setnayan_v2_1_canonical memory). The catalog was already
-- seeded by Phase A (migration 20260628000000) + multiple alignment passes
-- (20260631000000 + 20260701000000 + 20260701010000). Probe via NOTICE
-- against setnayan-prod 2026-05-29 confirmed 19 retail rows + 2 bundles
-- already live · only 2 surgical patches remain to reach the v2.1 surface:
--
--   1. PAKULAY (FREE Mood Board) is MISSING · add it as the 20th retail row.
--      Owner brief § 5 includes Pakulay as a free baseline service surfaced
--      in /pricing as "Included with every account · ₱0".
--
--   2. ANIMATED_MONOGRAM is currently is_token_able=TRUE on prod · task
--      brief explicitly puts it under "9 direct Setnayan-delivered SKUs
--      (is_token_able=FALSE)". The crew-delivered token-stacking rewards
--      framework (Phase E telemetry) targets media-capture services
--      (Papic / Panood / Patiktok / SDE / Pabati / Camera Bridge /
--      Live Wall · per migration 20260704010000 telemetry_events CHECK).
--      Animated Monogram is a pure-asset render with zero crew telemetry ·
--      flip to FALSE so token-stacking heuristics never accidentally count
--      it toward a vendor's 14-token award ladder.
--
-- INTENTIONAL NON-REVERSALS · the task brief lists PINOY_MAP_ROUTE as a
-- direct Setnayan-delivered SKU that should be kept, but the live state has
-- it DELETED per migration 20260701000000 ("owner directive · Delete the row
-- entirely"). Owner pricing-screenshot-v3 directive supersedes the older
-- task-brief reference per latest-spec-priority. NOT recreating it here.
--
-- Similarly PAPIC_GUEST_STORIES + PAPIC_MEDIA_PACK were renamed to
-- PAPIC_ADDON_STORIES + PAPIC_ADDON_THANK_YOU in 20260701000000 · live
-- state respected · not undoing.
--
-- THIS MIGRATION IS PROD-SAFE · idempotent (ON CONFLICT + WHERE clauses) ·
-- no destructive ops · pilot 2026-06-01 unchanged.
-- =============================================================================

BEGIN;

-- =============================================================================
-- PASS 1 · Add PAKULAY (free Mood Board)
-- =============================================================================
-- Mood Board is the host-side palette-and-vision tool · already shipped in
-- iteration 0010 · referenced in v2.1 brief § 5 as the free baseline visual
-- surface that compounds with paid Papic + Panood add-ons. SaaS overhead of
-- ₱0 reflects the no-marginal-cost reality (palette work is CSS + local
-- browser computation · no Higgsfield call · no Suno call · no Cloudflare
-- Stream Live SFU minutes).
--
-- is_token_able=FALSE because nothing crew-delivered exists for it ·
-- earned tokens (Phase E telemetry rewards) accrue only on actual media
-- capture/render services.

INSERT INTO public.platform_retail_catalog_v2
  (service_code, title, retail_price_php, saas_overhead_cost_php,
   is_token_able, description)
VALUES
  ('PAKULAY',
   'Pakulay',
   0.00,
   0.00,
   FALSE,
   'Free Mood Board · palette + visual identity for every account')
ON CONFLICT (service_code) DO UPDATE SET
  title                  = EXCLUDED.title,
  retail_price_php       = EXCLUDED.retail_price_php,
  saas_overhead_cost_php = EXCLUDED.saas_overhead_cost_php,
  is_token_able          = EXCLUDED.is_token_able,
  description            = EXCLUDED.description;


-- =============================================================================
-- PASS 2 · Flip ANIMATED_MONOGRAM to is_token_able=FALSE
-- =============================================================================
-- Task brief classification · ANIMATED_MONOGRAM is direct Setnayan-delivered
-- (no crew · no telemetry checkpoint · no vendor earning path). Aligns with
-- the Phase E telemetry_events CHECK constraint which only accepts service
-- codes that have crew delivery (papic / panood / patiktok / pabati / sde /
-- camera_bridge / live_wall). Pure render service stays out of the
-- token-stacking ladder.

UPDATE public.platform_retail_catalog_v2
   SET is_token_able = FALSE
 WHERE service_code = 'ANIMATED_MONOGRAM'
   AND is_token_able = TRUE;


COMMIT;

-- =============================================================================
-- VERIFICATION (run via supabase studio after push)
--
-- -- (1) Catalog row count · expect 20 retail rows
-- SELECT COUNT(*) FROM platform_retail_catalog_v2;
--
-- -- (2) Pakulay present + free
-- SELECT service_code, title, retail_price_php, is_token_able
--   FROM platform_retail_catalog_v2
--  WHERE service_code = 'PAKULAY';
-- -- Expected: PAKULAY · Pakulay · 0.00 · FALSE
--
-- -- (3) ANIMATED_MONOGRAM no longer token-able
-- SELECT service_code, is_token_able
--   FROM platform_retail_catalog_v2
--  WHERE service_code = 'ANIMATED_MONOGRAM';
-- -- Expected: ANIMATED_MONOGRAM · FALSE
--
-- -- (4) Token-worthy crew SKUs unchanged (8)
-- SELECT service_code FROM platform_retail_catalog_v2
--  WHERE is_token_able = TRUE
--  ORDER BY service_code;
-- -- Expected: LIVE_BACKGROUND · LIVE_WALL · PAKANTA · PANOOD_SYSTEM ·
-- --           PAPIC_ADDON_THANK_YOU · PAPIC_GUEST · PAPIC_SEATS ·
-- --           PATIKTOK_COMPILER · PRO_WEBSITE · SDE
-- =============================================================================
