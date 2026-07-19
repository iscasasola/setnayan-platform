-- Vendor "recommend to your couples" engine — Phase 3b (couple-facing share).
--
-- The vendor-side mirror of coordinator_feature_recommendations (owner 2026-06-22):
-- a vendor who is CONNECTED to a couple (an ACCEPTED chat_thread for that event)
-- can suggest a buyable Studio add-on; the couple sees a "Suggested by <vendor>"
-- entry in the Studio hub and buys or dismisses it. Same shape + same couple
-- buy/dismiss flow as the coordinator table — only the recommender gating differs
-- (accepted chat_thread vs event delegate).
--
-- Money stays walled off: the vendor can create + read their own suggestions but
-- has NO write path to status; buy/dismiss is couple-only; this table holds no
-- payment data and entitlement is ALWAYS sourced from orders, never this
-- decorative status.

CREATE TABLE IF NOT EXISTS public.vendor_feature_recommendations (
  id                     BIGSERIAL PRIMARY KEY,
  recommendation_id      UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  event_id               UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  vendor_profile_id      UUID NOT NULL REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  recommended_by_user_id UUID NOT NULL,
  addon_key              TEXT NOT NULL,
  note                   TEXT,
  status                 TEXT NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending', 'dismissed', 'purchased')),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at            TIMESTAMPTZ,
  -- One suggestion per (event, vendor, add-on); a dismissed row is never deleted,
  -- so the same vendor can't re-nag the same add-on.
  UNIQUE (event_id, vendor_profile_id, addon_key)
);

CREATE INDEX IF NOT EXISTS vendor_feature_recommendations_event_idx
  ON public.vendor_feature_recommendations (event_id);
CREATE INDEX IF NOT EXISTS vendor_feature_recommendations_vendor_idx
  ON public.vendor_feature_recommendations (vendor_profile_id);

ALTER TABLE public.vendor_feature_recommendations ENABLE ROW LEVEL SECURITY;

-- ── Vendor (connected via an ACCEPTED chat_thread) ────────────────────────
-- May create a suggestion only for an event they have an accepted thread with,
-- under a vendor_profile they own, stamped with their own uid; and read their
-- own suggestions back.
DROP POLICY IF EXISTS vfr_vendor_insert ON public.vendor_feature_recommendations;
CREATE POLICY vfr_vendor_insert ON public.vendor_feature_recommendations
  FOR INSERT TO authenticated
  WITH CHECK (
    recommended_by_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.vendor_profiles vp
      WHERE vp.vendor_profile_id = vendor_feature_recommendations.vendor_profile_id
        AND vp.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.chat_threads ct
      WHERE ct.event_id = vendor_feature_recommendations.event_id
        AND ct.vendor_profile_id = vendor_feature_recommendations.vendor_profile_id
        AND ct.inquiry_status = 'accepted'
    )
  );

DROP POLICY IF EXISTS vfr_vendor_select ON public.vendor_feature_recommendations;
CREATE POLICY vfr_vendor_select ON public.vendor_feature_recommendations
  FOR SELECT TO authenticated
  USING (
    vendor_profile_id IN (
      SELECT vp.vendor_profile_id FROM public.vendor_profiles vp WHERE vp.user_id = auth.uid()
    )
  );

-- ── Couple (event owner) ──────────────────────────────────────────────────
-- Reads suggestions on their event and resolves them (dismiss / mark purchased).
-- Mirrors coordinator_feature_recommendations: the couple owns every status
-- transition after creation; the vendor has NO update path. The UPDATE has no
-- column guard, but that's inert — entitlement is sourced from orders, never this
-- decorative status, and no code reads 'purchased' here.
DROP POLICY IF EXISTS vfr_couple_select ON public.vendor_feature_recommendations;
CREATE POLICY vfr_couple_select ON public.vendor_feature_recommendations
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT public.current_couple_event_ids()));

DROP POLICY IF EXISTS vfr_couple_update ON public.vendor_feature_recommendations;
CREATE POLICY vfr_couple_update ON public.vendor_feature_recommendations
  FOR UPDATE TO authenticated
  USING (event_id IN (SELECT public.current_couple_event_ids()))
  WITH CHECK (event_id IN (SELECT public.current_couple_event_ids()));

-- ── Admin observability ───────────────────────────────────────────────────
DROP POLICY IF EXISTS vfr_admin_select ON public.vendor_feature_recommendations;
CREATE POLICY vfr_admin_select ON public.vendor_feature_recommendations
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- No DELETE policy: rows are resolved by status, never deleted; CASCADE handles
-- event/vendor teardown.
