-- ============================================================================
-- 20260604120000_event_vendors_source_tracking.sql
--
-- Adds `source` + `source_category` columns to event_vendors so the home
-- planning-cards can show a small badge "added because you locked X for Y"
-- on auto-cascaded considering picks.
--
-- Owner directive 2026-05-22 (verbatim):
--   "when finalized, and the other services of that vendor is not yet
--    availed, it will be automatically added to the list of the event.
--    example. a vendor locked in catering but also has a photobooth.
--    their photobooth would automatically be on the list for photobooths.
--    so the host can consider them as well."
--
-- The cascade fires inside finalizeVendor() at /dashboard/[eventId]/vendors/actions.ts:
--   1. After flipping status → 'contracted' in source category X
--   2. Look up vendor_services WHERE vendor_profile_id = the finalized vendor
--   3. For each row, resolve canonical_service → PlanGroupId target category Y
--   4. Skip target == X (no self-cascade) and skip if host already has a
--      finalized vendor in Y or any row for this vendor in Y
--   5. INSERT new event_vendors row: { ..., status='considering',
--      source='auto_cascade_from_finalize', source_category=X }
--
-- Both columns are nullable + non-breaking:
--   - `source` is a free-form text discriminator. NULL on legacy rows
--     (pre-2026-05-22). New rows from createVendor / addCustomVendor stamp
--     'host_manual'. New rows from the cascade stamp
--     'auto_cascade_from_finalize'. Future code can introduce additional
--     values (e.g. 'considering_via_compare') without a migration.
--   - `source_category` is the canonical VendorCategory the cascade fired
--     from. NULL for any non-cascade row. Used by the UI to render
--     "added because you locked Sofitel for Catering" in the badge.
--
-- Idempotent. Safe to re-run. No existing row data is modified — legacy rows
-- stay NULL, which the UI treats as "no badge".
--
-- See CLAUDE.md decision-log row 2026-05-22 for the full architectural lock.
-- ============================================================================

BEGIN;

ALTER TABLE public.event_vendors
  ADD COLUMN IF NOT EXISTS source TEXT,
  ADD COLUMN IF NOT EXISTS source_category TEXT;

COMMENT ON COLUMN public.event_vendors.source IS
  'Free-form discriminator for how this row was created. NULL on legacy / pre-2026-05-22 rows. Known values: ''host_manual'' (createVendor / addCustomVendor), ''auto_cascade_from_finalize'' (finalizeVendor cascade — vendor''s other services auto-added as considering picks), ''invite_claim'' (vendor invite accepted), ''considering_via_compare'' (future). UI uses this to render contextual badges on the planning cards.';

COMMENT ON COLUMN public.event_vendors.source_category IS
  'Only set when source = ''auto_cascade_from_finalize''. Stores the source VendorCategory the cascade fired from so the UI can render "added because you locked X for {source_category}". NULL for any other source.';

-- Optional index supports future analytics queries (e.g., "how many
-- considering picks were auto-cascaded?"). Partial index keeps it small
-- because most rows are 'host_manual' or NULL.
CREATE INDEX IF NOT EXISTS event_vendors_source_cascade_idx
  ON public.event_vendors (event_id, source)
  WHERE source = 'auto_cascade_from_finalize';

COMMIT;
