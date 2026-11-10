-- service card opens
-- ============================================================================
-- 📈 "WHICH CARD SELLS" COUNTS ITS OPENS (Build 6 Lane I — owner 10 Nov: *"we want graphs that will help them"* →
-- *"All five"*; DECISION_LOG 2026-11-10 "ALL FIVE NEW ANALYTICS GRAPHS PICKED": b) Which card sells = opened → asked
-- → booked per service card → "Run an offer on [card]").
--
-- Until this migration NOTHING recorded which service card a couple OPENED: `vendor_profile_views` counts the SHOP,
-- `vendor_portfolio_photo_views` counts a PHOTO. So graph b drew asked and booked only, and the `offer_on_card` rule
-- in `buildGrowthRecs` could never fire (PR #7439's flag 1). This is that record — the SAME shape as the portfolio
-- photo views (20271331531509), reused rather than invented:
--
--   · a view = a couple or guest opening the card into the grown card (the public shop, `services-gallery.tsx`);
--   · the shop's own people (owner + team) and admins NEVER count;
--   · one count per viewer per card per Manila day — the day ledger IS the count (opens in a window = its rows);
--   · the viewer is HASHED (sha256(salt || id), `lib/vendor-funnel.ts` hashViewer) — never a raw id;
--   · written through ONE security-definer function, service role only;
--   · read through ONE security-definer function that returns COUNTS per card, never a row or a hash.
--
-- RLS AT CREATE TIME. Nobody reads or writes the ledger directly. NEVER APPLIED BY HAND — the pipeline pushes it.
-- KEEP IDEMPOTENT.
-- ============================================================================

BEGIN;

-- ── 1 · THE LEDGER (one row per shop, card, hashed viewer, Manila day) ───────
CREATE TABLE IF NOT EXISTS public.vendor_service_card_view_days (
  vendor_profile_id UUID NOT NULL
                      REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  vendor_service_id UUID NOT NULL
                      REFERENCES public.vendor_services(vendor_service_id) ON DELETE CASCADE,
  viewer_hash       TEXT NOT NULL CHECK (viewer_hash ~ '^[0-9a-f]{64}$'),
  viewed_on         DATE NOT NULL,
  PRIMARY KEY (vendor_profile_id, vendor_service_id, viewer_hash, viewed_on)
);

COMMENT ON TABLE public.vendor_service_card_view_days IS
  'Build 6 Lane I — one row per shop, service card, HASHED viewer and Manila day the card was opened into the grown card. The rows in a window ARE the opens (Shop › Analytics "Which card sells"). Written only by record_service_card_view(); read only as counts through service_card_opens(). The viewer is sha256(salt||id), never a raw id.';

-- "Opens per card since a day" reads one shop's rows by day.
CREATE INDEX IF NOT EXISTS vendor_service_card_view_days_shop_day_idx
  ON public.vendor_service_card_view_days (vendor_profile_id, viewed_on);
-- The card's FK cascade looks rows up by card.
CREATE INDEX IF NOT EXISTS vendor_service_card_view_days_service_idx
  ON public.vendor_service_card_view_days (vendor_service_id);

ALTER TABLE public.vendor_service_card_view_days ENABLE ROW LEVEL SECURITY;

-- No policy at all: nobody but the two functions (and the service role) touches the ledger. Closed at the grant too.
REVOKE ALL ON TABLE public.vendor_service_card_view_days FROM PUBLIC, anon, authenticated;

-- ── 2 · THE ONE WRITER ───────────────────────────────────────────────────────
-- TRUE when the open counted; FALSE when refused (own shop, admin, not a card of this shop) or already counted today.
CREATE OR REPLACE FUNCTION public.record_service_card_view(
  p_vendor_profile_id UUID,
  p_vendor_service_id UUID,
  p_viewer_hash       TEXT,
  p_viewer_user_id    UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today DATE := (now() AT TIME ZONE 'Asia/Manila')::date;
  v_new   INTEGER;
BEGIN
  IF p_vendor_profile_id IS NULL OR p_vendor_service_id IS NULL OR p_viewer_hash IS NULL
     OR p_viewer_hash !~ '^[0-9a-f]{64}$' THEN
    RETURN FALSE;
  END IF;

  -- The shop's own people (owner or any team member) and admins never count.
  IF p_viewer_user_id IS NOT NULL AND (
       EXISTS (SELECT 1 FROM public.users u WHERE u.user_id = p_viewer_user_id AND u.account_type = 'admin')
    OR EXISTS (SELECT 1 FROM public.vendor_profiles vp WHERE vp.vendor_profile_id = p_vendor_profile_id AND vp.user_id = p_viewer_user_id)
    OR EXISTS (SELECT 1 FROM public.vendor_team_members tm WHERE tm.vendor_profile_id = p_vendor_profile_id AND tm.user_id = p_viewer_user_id)
  ) THEN
    RETURN FALSE;
  END IF;

  -- Only a card of this shop.
  IF NOT EXISTS (
    SELECT 1 FROM public.vendor_services s
    WHERE s.vendor_service_id = p_vendor_service_id
      AND s.vendor_profile_id = p_vendor_profile_id
  ) THEN
    RETURN FALSE;
  END IF;

  -- One per viewer per card per day.
  INSERT INTO public.vendor_service_card_view_days (vendor_profile_id, vendor_service_id, viewer_hash, viewed_on)
  VALUES (p_vendor_profile_id, p_vendor_service_id, p_viewer_hash, v_today)
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_new = ROW_COUNT;
  RETURN v_new > 0;
END;
$$;

COMMENT ON FUNCTION public.record_service_card_view(UUID, UUID, TEXT, UUID) IS
  'Build 6 Lane I — the ONE writer of service card opens. Service role only (lib/record-service-card-view.ts hashes the viewer). Refuses the shop''s own people and admins and any card that is not this shop''s; one per viewer per card per Manila day.';

REVOKE ALL ON FUNCTION public.record_service_card_view(UUID, UUID, TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_service_card_view(UUID, UUID, TEXT, UUID) TO service_role;

-- ── 3 · THE ONE READER — counts per card, for the shop's own people ─────────
-- A shop reads its OWN opens (current_vendor_profile_ids spans the owner + team); an admin reads any. Anyone else gets
-- an error, never an empty set (an empty set would read as "nobody opened your cards").
CREATE OR REPLACE FUNCTION public.service_card_opens(
  p_vendor_profile_id UUID,
  p_since             DATE
)
RETURNS TABLE (vendor_service_id UUID, opens BIGINT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
       p_vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    OR (SELECT public.is_admin())
  ) THEN
    RAISE EXCEPTION 'not your shop' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
    SELECT d.vendor_service_id, count(*)::BIGINT
    FROM public.vendor_service_card_view_days d
    WHERE d.vendor_profile_id = p_vendor_profile_id
      AND d.viewed_on >= p_since
    GROUP BY d.vendor_service_id;
END;
$$;

COMMENT ON FUNCTION public.service_card_opens(UUID, DATE) IS
  'Build 6 Lane I — how many distinct viewer-days opened each of a shop''s service cards since a day. The shop''s own people and admins only; anyone else is refused (an error, never an empty answer).';

REVOKE ALL ON FUNCTION public.service_card_opens(UUID, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.service_card_opens(UUID, DATE) TO authenticated;

COMMIT;
