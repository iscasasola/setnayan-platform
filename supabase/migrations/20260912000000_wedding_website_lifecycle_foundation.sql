-- ============================================================================
-- 20260912000000_wedding_website_lifecycle_foundation.sql
-- (renamed from 20260910000000 — that version collided with vendor-tier Phase A)
--
-- Wedding Website Lifecycle — FOUNDATION (safe, additive subset).
-- Spec: Wedding_Website_Lifecycle_Spec_2026-06-07.md (corpus) · DECISION_LOG
-- 2026-06-07 row "Wedding website locked = ONE site with 3 date-driven phases".
--
-- WHAT THIS SHIPS (all purely additive — no behavioral change, nothing
-- consumes these yet; frontend ships ahead per the repo's migration model):
--   1. events.* columns — shared chrome (looping bg music + scrub-video hero)
--      + storyline inputs for the auto-editorial (love_story, special_message,
--      together_since, editorial tone/language).
--   2. event_vendors.selection_match_rank — captures whether a booked vendor
--      was Setnayan's #1 leaf-match AT SELECTION TIME, so the Editorial's
--      "By the Numbers" first-pick stat (M2) can be computed. Forward-only:
--      it can only be captured going forward, so the column lands first and
--      finalizeVendor wiring follows.
--   3. event_editorial — one snapshot row per event holding the generated
--      draft + the FROZEN impact metrics (M1-M3 + supporting) at publish, so
--      the numbers on a published recap never drift afterward.
--
-- DELIBERATELY NOT IN THIS MIGRATION (need a decision / atomic renderer ship —
-- see the spec §10 + the 2026-06-07 handoff notes):
--   • invitation_widgets per-phase (phase column + UNIQUE change + widget_type
--     expansion + matrix seeding) — RENDERER-COUPLED. Seeding event/editorial
--     rows before apps/web/app/[slug]/page.tsx is phase-aware would render
--     unknown widgets on the live page. Ships atomically with the renderer.
--   • event-level review/feedback table — RECONCILE with the existing
--     public.vendor_reviews (couple->vendor marketplace ratings, shipped
--     20260514100000_vendor_reviews.sql). The editorial Feedback Wall needs
--     guest->event + vendor->event(testimonial) + couple->event feedback,
--     which is a different subject than vendor-profile ratings. Owner decision
--     pending before the table lands.
--
-- RLS — couples + accepted moderators read+write their own event's editorial;
-- admin reads all (moderation/support). The public recap renders via
-- createAdminClient() (same as the [slug] landing page), so no anon policy is
-- needed. Mirrors the canonical shape from 20260607030000_invitation_widgets.
--
-- IDEMPOTENT via IF NOT EXISTS + ON CONFLICT — safe to re-run.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. events.* — shared chrome + auto-editorial storyline inputs
-- ----------------------------------------------------------------------------

ALTER TABLE public.events
  -- Looping background music (NET-NEW · distinct from music_playlist_seed /
  -- event_song_picks which are VENDOR MATCHING, and from render-catalogue
  -- music). Pakanta's 2nd surface = the page soundtrack. Played gapless via
  -- Web Audio with a visible mute toggle (a11y) + tap-to-start (autoplay
  -- blocked); streamed from R2, lazy-loaded so it doesn't block LCP.
  ADD COLUMN IF NOT EXISTS site_bg_music_source TEXT
    CHECK (site_bg_music_source IN ('upload','pakanta')),
  ADD COLUMN IF NOT EXISTS site_bg_music_r2_key TEXT,
  ADD COLUMN IF NOT EXISTS site_bg_music_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  -- Scrub-video hero background (distinct from landing_page_hero_image_url).
  ADD COLUMN IF NOT EXISTS landing_page_hero_video_r2_key TEXT,
  -- Storyline inputs for the auto-editorial write-up (free, LLM-composed).
  -- love_story = { how_we_met, proposal, milestones:[{year,title,note}] }.
  ADD COLUMN IF NOT EXISTS love_story JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS special_message TEXT,
  ADD COLUMN IF NOT EXISTS together_since DATE,
  ADD COLUMN IF NOT EXISTS editorial_tone TEXT
    CHECK (editorial_tone IN ('warm','playful','formal')),
  ADD COLUMN IF NOT EXISTS editorial_language TEXT;

COMMENT ON COLUMN public.events.site_bg_music_source IS
  'Looping page soundtrack source: upload (couple file) | pakanta (their custom song). NET-NEW; not the vendor-matching music (music_playlist_seed/event_song_picks).';
COMMENT ON COLUMN public.events.love_story IS
  'Auto-editorial storyline input: { how_we_met, proposal, milestones:[{year,title,note}] }.';

-- ----------------------------------------------------------------------------
-- 2. event_vendors.selection_match_rank — powers Editorial M2 (first-pick rate)
-- ----------------------------------------------------------------------------

ALTER TABLE public.event_vendors
  ADD COLUMN IF NOT EXISTS selection_match_rank INT;

COMMENT ON COLUMN public.event_vendors.selection_match_rank IS
  'Leaf-match (compat-score) rank of this vendor AT SELECTION TIME. 1 = was Setnayan''s #1 match. NULL = off-platform/manual or no ranking available. Written by finalizeVendor; powers the Editorial "By the Numbers" first-pick stat (M2). Forward-only.';

-- ----------------------------------------------------------------------------
-- 3. event_editorial — one snapshot per event (draft + frozen impact metrics)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.event_editorial (
  editorial_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id         UUID NOT NULL
                   REFERENCES public.events(event_id) ON DELETE CASCADE,
  status           TEXT NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft','published')),
  -- When the LLM last composed the draft.
  generated_at     TIMESTAMPTZ,
  -- Composed sections/copy (headline, deck, lead article, pull quote,
  -- captions, etc.). Free-text + structure; shape owned by the generator.
  draft_json       JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- FROZEN at publish so a published recap's numbers never drift:
  -- { services_setnayan, services_total, firstpick_num, firstpick_den,
  --   time_saved_hrs, guests, photos, rsvp_pct }.
  impact_metrics   JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Soft refs to photos (no FK — photos table shape is owned elsewhere and
  -- we don't want a hard coupling here).
  hero_photo_id    UUID,
  essay_photo_ids  UUID[] NOT NULL DEFAULT '{}',
  -- Snapshot of the tone the draft was generated in.
  editorial_tone   TEXT,
  edited_by_couple BOOLEAN NOT NULL DEFAULT FALSE,
  published_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- One editorial per event in V1.
  UNIQUE (event_id)
);

CREATE INDEX IF NOT EXISTS event_editorial_event_idx
  ON public.event_editorial(event_id);

ALTER TABLE public.event_editorial ENABLE ROW LEVEL SECURITY;

-- Couple read+write (their own event) — canonical helper from
-- 20260513040000_fix_rls_infinite_recursion.sql.
DROP POLICY IF EXISTS event_editorial_couple_rw ON public.event_editorial;
CREATE POLICY event_editorial_couple_rw
  ON public.event_editorial FOR ALL
  TO authenticated
  USING (event_id IN (SELECT public.current_couple_event_ids()))
  WITH CHECK (event_id IN (SELECT public.current_couple_event_ids()));

-- Accepted moderator read+write — multi-host path (mirrors invitation_widgets).
DROP POLICY IF EXISTS event_editorial_moderator_rw ON public.event_editorial;
CREATE POLICY event_editorial_moderator_rw
  ON public.event_editorial FOR ALL
  TO authenticated
  USING (
    event_id IN (
      SELECT em.event_id FROM public.event_moderators em
      WHERE em.user_id = auth.uid()
        AND em.accepted_at IS NOT NULL
        AND em.removed_at IS NULL
    )
  )
  WITH CHECK (
    event_id IN (
      SELECT em.event_id FROM public.event_moderators em
      WHERE em.user_id = auth.uid()
        AND em.accepted_at IS NOT NULL
        AND em.removed_at IS NULL
    )
  );

-- Admin read-all — moderation/support.
DROP POLICY IF EXISTS event_editorial_admin_read ON public.event_editorial;
CREATE POLICY event_editorial_admin_read
  ON public.event_editorial FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE user_id = auth.uid() AND account_type = 'admin'
    )
  );

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.event_editorial_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS event_editorial_updated_at ON public.event_editorial;
CREATE TRIGGER event_editorial_updated_at
  BEFORE UPDATE ON public.event_editorial
  FOR EACH ROW EXECUTE FUNCTION public.event_editorial_set_updated_at();

COMMENT ON TABLE public.event_editorial IS
  'Per-event post-wedding Editorial recap snapshot (Wedding_Website_Lifecycle_Spec_2026-06-07). Holds the auto-generated draft + the FROZEN impact metrics at publish. One row per event (V1).';

COMMIT;
