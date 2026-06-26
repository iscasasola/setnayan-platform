-- ============================================================================
-- Iteration 0012 Papic — events.papic_style (event-wide capture look)
-- ============================================================================
-- The couple chooses ONE camera "look" when they set up their Papic account
-- (Studio → Papic). It becomes the locked template for the whole event: every
-- camera — paid seats, the free sampler, and guest disposable cameras — bakes
-- this style into the photos it captures. The shooters cannot change it; it is
-- a couple-side setup decision, applied uniformly so the gallery has one
-- coherent aesthetic.
--
-- Five looks (see apps/web/lib/papic-photo-styles.ts for the pixel pipelines):
--   ORIG  — clean realism with subtle modern polish (DEFAULT)
--   RETRO — warm film, matte shadows, fine grain
--   MONO  — rich black & white, bright skin
--   CINE  — teal & orange cinematic grade + bloom
--   LOMO  — lo-fi toy camera (saturated, chromatic aberration, light leak)
--
-- Storage seam unchanged: styling happens on-device at capture time (no server
-- render — honours the no-video-render-pipeline constraint); R2/Drive still
-- receive the already-styled JPEG. The CLEAN frame is used for face auto-tag
-- before styling, so MONO/LOMO/CINE never degrade face matching.
--
-- Idempotent. No drops.
-- ============================================================================

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS papic_style TEXT
    NOT NULL DEFAULT 'ORIG'
    CHECK (papic_style IN ('ORIG', 'RETRO', 'MONO', 'CINE', 'LOMO'));

COMMENT ON COLUMN public.events.papic_style IS
  'Event-wide Papic capture look, chosen by the couple at Papic setup and applied to every camera (seats, sampler, guest). One of ORIG/RETRO/MONO/CINE/LOMO. Default ORIG. Styling is on-device at capture; faces embed from the clean frame first. See iteration 0012 + apps/web/lib/papic-photo-styles.ts.';
