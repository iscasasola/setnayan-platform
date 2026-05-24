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

-- 1. Loose compat on admin-seeded religious venues.
--
-- NULL semantics: per fetchWizardVendorRecommendations + the
-- religion-default filter shape, NULL on compatible_venue_settings is
-- read as "compatible with any reception venue type". Empty array
-- (`{}`) reads as "compatible with none" because @> {value} is FALSE
-- against an empty array, so we explicitly choose NULL not {}.
UPDATE public.vendor_profiles
   SET compatible_venue_settings = NULL
 WHERE user_id IS NULL
   AND services && ARRAY['religious_venue']
   AND compatible_venue_settings IS NOT NULL
   AND compatible_venue_settings <> '{}';

-- 2. Optional symmetric loosening on ALL admin-seeded officiants.
--
-- Today every officiant in vendor_market_stats is tagged with every
-- venue_setting (universal) so this clause changes nothing in current
-- prod. But if a future seed narrows the tags (as the religious-venue
-- seed did), this NULL guarantees Card 04 keeps working even with the
-- code-side defensive pass that the sibling PR introduces. Same
-- belt-and-suspenders rationale as the religious_venue rows above.
UPDATE public.vendor_profiles
   SET compatible_venue_settings = NULL
 WHERE user_id IS NULL
   AND services && ARRAY['officiant']
   AND compatible_venue_settings IS NOT NULL
   AND compatible_venue_settings <> '{}';

COMMIT;

-- ============================================================================
-- Post-migration verification (run after `supabase db push --linked`):
--
-- # Should return 0 (no admin-seeded religious venues should have
-- # narrow venue_setting tags after this migration):
-- SELECT COUNT(*) FROM public.vendor_profiles
--  WHERE user_id IS NULL
--    AND services && ARRAY['religious_venue']
--    AND compatible_venue_settings IS NOT NULL
--    AND array_length(compatible_venue_settings, 1) > 0;
--
-- # Should return 18 (all Catholic churches now surface for any
-- # ceremony_type=catholic event, regardless of reception type):
-- SELECT COUNT(*) FROM public.vendor_market_stats
--  WHERE 'religious_venue' = ANY(services)
--    AND public_visibility IN ('verified', 'coming_soon')
--    AND (compatible_ceremony_types IS NULL
--         OR compatible_ceremony_types && ARRAY['catholic']);
-- ============================================================================
