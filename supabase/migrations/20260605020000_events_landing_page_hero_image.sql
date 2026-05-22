-- ============================================================================
-- 20260605020000_events_landing_page_hero_image.sql
--
-- Add hero photo upload to wedding landing page (apps/web/app/[slug]/page.tsx).
-- Owner directive 2026-05-22 (verbatim): "how can we edit the wedding's
-- landing page/website" — the investigation surfaced that the landing page
-- hero is monogram-only, with no way for hosts to upload a hi-res photo of
-- the couple. This migration ships the column the editor at
-- `/dashboard/[eventId]/website/hero-photo` writes to.
--
-- The R2 ref (`r2://setnayan-media/events/{event_id}/landing-page-hero/{uuid}-{filename}`)
-- is stored in TEXT — same `r2://`-tagged convention as `vendors.logo_url`,
-- `service_orders.payment_screenshot_url`, etc. The renderer reads via
-- `displayUrlForStoredAsset()` from `lib/uploads.ts` which resolves to a
-- presigned GET URL (24h TTL).
--
-- IDEMPOTENT. All three columns use ADD COLUMN IF NOT EXISTS so this can
-- be re-applied without erroring.
--
-- Cross-ref: CLAUDE.md decision-log row (Hero Photo PR sibling of #381
-- Privacy + #382 Dress Code + #383 Photo Moments).
-- ============================================================================

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS landing_page_hero_image_url TEXT,
  ADD COLUMN IF NOT EXISTS landing_page_hero_image_uploaded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS landing_page_hero_image_uploaded_by_user_id UUID
    REFERENCES public.users(user_id) ON DELETE SET NULL;

COMMENT ON COLUMN public.events.landing_page_hero_image_url IS
  'r2://-tagged ref to the hero photo on the public landing page. Null = render the monogram-only hero (legacy/default).';
COMMENT ON COLUMN public.events.landing_page_hero_image_uploaded_at IS
  'Timestamp of the most recent successful upload. Replaced on each re-upload.';
COMMENT ON COLUMN public.events.landing_page_hero_image_uploaded_by_user_id IS
  'Audit trail — which host/moderator uploaded the photo. SET NULL on user delete.';
