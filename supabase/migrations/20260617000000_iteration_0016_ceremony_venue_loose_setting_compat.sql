-- ============================================================================
-- 20260617000000_iteration_0016_ceremony_venue_loose_setting_compat.sql
--
-- WHY (2026-05-24)
-- ============================================================================
-- Card 03 (Ceremony Venue) on Iteration 0016's Concierge Active Wizard
-- empty-stated for couples whose RECEPTION venue type wasn't `heritage`.
-- The Card 03 server component was using `events.venue_setting` (the host's
-- reception type) as a hard filter on the ceremony venue's
-- `compatible_venue_settings` column. The admin-seeded religious venues
-- in 20260529000000_venue_directory_seed.sql were tagged
-- `compatible_venue_settings=['heritage']` on all 19 Catholic churches,
-- so couples with banquet_hall / garden / beach / destination /
-- outdoor_tent receptions matched ZERO churches in the wizard.
--
-- Direct query confirming the bug pre-fix:
--   SELECT COUNT(*) FROM vendor_market_stats
--    WHERE 'religious_venue' = ANY(services)
--      AND compatible_ceremony_types && ARRAY['catholic']
--      AND compatible_venue_settings && ARRAY['banquet_hall'];
--   → 0   (broken: catholic + banquet_hall sees nothing)
--   With heritage: → 18   (worked for the narrow case only)
--
-- The architectural fix is two-pronged:
--   1. Code-side (apps/web/.../wizard-cards/ceremony-venue-card.tsx +
--      officiant-card.tsx · same PR): pass venueSetting=null to
--      fetchWizardVendorRecommendations. A ceremony venue's compat is
--      about ceremony_type + faith, not about the couple's reception
--      style. The author's own comment ("Ceremony venues aren't
--      typically filtered by venue_setting") already said so · the
--      data made it strict by accident.
--   2. Data-side (this migration): NULL out `compatible_venue_settings`
--      on admin-seeded religious_venue vendor_profiles so any OTHER
--      consumer (admin /vendors page, future per-venue analytics,
--      Card 04 Officiant defensive code path) doesn't trip on the same
--      trap. NULL means "compatible with all" per the OR-clause shape
--      already used everywhere (`compat IS NULL OR compat && {value}`).
--
-- Scoped to admin-seeded rows (user_id IS NULL) so a real church
-- account that later claims its venue and SET its compat tags
-- intentionally is preserved. The historical
-- 20260529000000_venue_directory_seed.sql ON-CONFLICT clause is
-- idempotent · re-running that seed will NOT undo this fix because
-- its INSERTs are gated by `business_slug` uniqueness, not by
-- column values.
--
-- Cross-references:
--   • CLAUDE.md 2026-05-24 decision-log row "Card 03 empty-state fix"
--   • Iteration 0016 spec note (Concierge Active Wizard · vendor-pick
--     card rules: ceremony venues + officiants filter on ceremony_type
--     only, never venue_setting)
--   • apps/web/lib/wizard-recommendations.ts · NULL-safe OR clause
--     this migration leans on
--
-- Idempotent · safe to re-run · scoped to religious_venue + admin-seeded.
-- ============================================================================

BEGIN;

-- Implementation note (2026-05-24): vendor_profiles.compatible_venue_settings
-- has a NOT NULL constraint, so we can't use the NULL-means-everything
-- pattern that fetchWizardVendorRecommendations + the religion-default
-- filter support. Instead we explicitly tag religious venues + officiants
-- with the FULL set of reception venue settings. Both achieve the same
-- runtime behaviour (overlap is TRUE for any value the host sets on
-- events.venue_setting) without touching the schema. A follow-up PR can
-- drop the NOT NULL constraint + clean this up if we want NULL semantics
-- everywhere · for now the explicit-all-settings approach ships the fix
-- without coordinating with any other consumer of the column.
--
-- The 7 values mirror the canonical event.venue_setting enum (see
-- iteration 0043 + the CHECK constraint on events.venue_setting):
--   banquet_hall · garden · beach · destination · heritage ·
--   outdoor_tent · civil_registrar

-- 1. Religious venues — tag with all 7 reception settings.
UPDATE public.vendor_profiles
   SET compatible_venue_settings = ARRAY[
     'banquet_hall',
     'garden',
     'beach',
     'destination',
     'heritage',
     'outdoor_tent',
     'civil_registrar'
   ]::TEXT[]
 WHERE user_id IS NULL
   AND services && ARRAY['religious_venue']
   AND NOT (
     compatible_venue_settings @> ARRAY['banquet_hall']
     AND compatible_venue_settings @> ARRAY['garden']
     AND compatible_venue_settings @> ARRAY['beach']
     AND compatible_venue_settings @> ARRAY['destination']
     AND compatible_venue_settings @> ARRAY['heritage']
     AND compatible_venue_settings @> ARRAY['outdoor_tent']
     AND compatible_venue_settings @> ARRAY['civil_registrar']
   );

-- 2. Officiants — symmetric loosening · belt-and-suspenders.
--
-- Today every officiant in vendor_market_stats is tagged with every
-- venue_setting already (universal) so this clause changes nothing in
-- current prod. But if a future seed narrows the tags (as the
-- religious-venue seed did), this UPDATE guarantees Card 04 keeps
-- working even with the code-side defensive pass that the sibling PR
-- introduces.
UPDATE public.vendor_profiles
   SET compatible_venue_settings = ARRAY[
     'banquet_hall',
     'garden',
     'beach',
     'destination',
     'heritage',
     'outdoor_tent',
     'civil_registrar'
   ]::TEXT[]
 WHERE user_id IS NULL
   AND services && ARRAY['officiant']
   AND NOT (
     compatible_venue_settings @> ARRAY['banquet_hall']
     AND compatible_venue_settings @> ARRAY['garden']
     AND compatible_venue_settings @> ARRAY['beach']
     AND compatible_venue_settings @> ARRAY['destination']
     AND compatible_venue_settings @> ARRAY['heritage']
     AND compatible_venue_settings @> ARRAY['outdoor_tent']
     AND compatible_venue_settings @> ARRAY['civil_registrar']
   );

COMMIT;

-- ============================================================================
-- Post-migration verification (run after `supabase db push --linked`):
--
-- # Should return 0 (every admin-seeded religious venue now covers all 7
-- # reception settings · the seed's narrow `['heritage']` tagging is gone):
-- SELECT COUNT(*) FROM public.vendor_profiles
--  WHERE user_id IS NULL
--    AND services && ARRAY['religious_venue']
--    AND array_length(compatible_venue_settings, 1) < 7;
--
-- # Should return 18 (all Catholic churches now surface for any
-- # ceremony_type=catholic event, regardless of reception type):
-- SELECT COUNT(*) FROM public.vendor_market_stats
--  WHERE 'religious_venue' = ANY(services)
--    AND public_visibility IN ('verified', 'coming_soon')
--    AND compatible_ceremony_types && ARRAY['catholic']
--    AND compatible_venue_settings && ARRAY['banquet_hall'];
-- ============================================================================
