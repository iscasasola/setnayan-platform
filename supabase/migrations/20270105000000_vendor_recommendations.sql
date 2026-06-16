-- Event Lifecycle Menu · PR6 — Recommend your vendors (2026-06-16, spec §6.3).
--
-- After the wedding, alongside the per-vendor review, the couple can RECOMMEND
-- the vendors they loved → the couple's Recommended list. A recommendation is
-- SEPARATE from a review (a review can be a fair 3★; a recommendation is an
-- explicit, opt-in "I'd recommend them"), per-vendor opt-in (the couple picks
-- which), and reversible (withdraw = delete).
--
-- ANTI-FAKE — a recommendation publicly BOOSTS a vendor, so it carries a higher
-- bar than a review. This table enforces the two automatable layers in the RLS
-- INSERT gate:
--   1. A real inquiry existed + 2. it ran the full lifecycle to completion —
--   both collapse into the SAME completion gate as the review (the vendor must
--   be completion-confirmed for THIS event, correlated by marketplace_vendor_id,
--   with the dispute freeze + M=7d/N=30d/legacy paths). The photo-evidence layers
--   (3 = photos of the service · 4 = cross-service photo consistency) need
--   photo→vendor attribution that does NOT exist yet (same gap as per-vendor
--   galleries) → those stay an ADMIN-review backstop, not a hard DB gate (spec
--   §6.3 "V1 = automated signals + admin backstop").
--
-- Mirrors the vendor_reviews shape + RLS (20260514100000 + the 20270101000000
-- completion-gate rewrite) — couple writes a row about a vendor for an event,
-- public read for the marketplace "recommended by N couples" signal + the couple
-- Editorial "vendors we loved" block.

CREATE TABLE IF NOT EXISTS public.vendor_recommendations (
  recommendation_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_profile_id      UUID NOT NULL REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  event_id               UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  recommended_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  endorsement            TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- One recommendation per (vendor, event, recommender). Re-recommend after a
  -- withdraw (delete) is allowed; editing the endorsement is an UPDATE.
  UNIQUE (vendor_profile_id, event_id, recommended_by_user_id)
);

CREATE INDEX IF NOT EXISTS vendor_recommendations_vendor_profile_id_idx
  ON public.vendor_recommendations (vendor_profile_id);
CREATE INDEX IF NOT EXISTS vendor_recommendations_event_id_idx
  ON public.vendor_recommendations (event_id);

ALTER TABLE public.vendor_recommendations ENABLE ROW LEVEL SECURITY;

-- Public read — the "recommended by N couples" marketplace signal + the Editorial
-- "vendors we loved" block are public (guests + visitors → the referral loop).
-- Aggregate-only by convention; recommended_by_user_id is never surfaced to the
-- public (named endorsements require consent, handled in app, not column RLS).
CREATE POLICY vendor_recommendations_public_read
  ON public.vendor_recommendations FOR SELECT
  USING (TRUE);

-- Couple insert — gated by completion (anti-fake layers 1+2), correlated to the
-- vendor being recommended. Same OR-chain as vendor_reviews_couple_insert.
CREATE POLICY vendor_recommendations_couple_insert
  ON public.vendor_recommendations FOR INSERT
  TO authenticated
  WITH CHECK (
    recommended_by_user_id = auth.uid()
    AND event_id IN (SELECT public.current_couple_event_ids())
    AND EXISTS (
      SELECT 1 FROM public.event_vendors ev
      WHERE ev.event_id = vendor_recommendations.event_id
        AND ev.marketplace_vendor_id = vendor_recommendations.vendor_profile_id
        -- An open non-delivery dispute freezes the gate until it resolves.
        AND ev.completion_status <> 'disputed'
        AND (
          ev.customer_confirmed_received_at IS NOT NULL
          OR ev.completion_status IN ('confirmed', 'auto_confirmed')
          OR (ev.service_marked_complete_at IS NOT NULL
              AND now() >= ev.service_marked_complete_at + interval '7 days')
          OR now() >= (
              (SELECT e.event_date FROM public.events e WHERE e.event_id = ev.event_id)
              + interval '30 days'
            )::timestamptz
          OR ev.status IN ('delivered', 'complete')
        )
    )
  );

-- Couple update — edit the endorsement on their own recommendation.
CREATE POLICY vendor_recommendations_couple_update
  ON public.vendor_recommendations FOR UPDATE
  TO authenticated
  USING (recommended_by_user_id = auth.uid())
  WITH CHECK (recommended_by_user_id = auth.uid());

-- Couple delete — withdraw their recommendation (reversible).
CREATE POLICY vendor_recommendations_couple_delete
  ON public.vendor_recommendations FOR DELETE
  TO authenticated
  USING (recommended_by_user_id = auth.uid());

COMMENT ON TABLE public.vendor_recommendations IS
  'Couple Recommended list (Event Lifecycle Menu §6.3). Per-vendor opt-in, completion-gated (anti-fake layers 1-2 in RLS; photo layers 3-4 are an admin backstop). Public-read powers the marketplace "recommended by N couples" signal + Editorial "vendors we loved" block.';
