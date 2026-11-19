-- today_wrap_up_story_photo_shares
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
--
-- ✓ TODAY v3 PART 3 — AN EVENT FINISHED: CHECK, CONFIRM, SHARE (owner 19 Nov 2026 on the drawing `Today, tap opens a
-- card` v3.5, V3 · 1: *"we check all the photos to be added to that event and inspiration. and see all the reviews you
-- received. then when supplier confirms, send the photos to share with the clients event story. if the client do not
-- respond, it means they accepted the photos. nothing will be removed."* · *"All shares but only Ultra shows."* · on a
-- hidden photo: *"only on couple's"* · *"Yes, all your picks"*; DECISION_LOG 2026-11-19 "TODAY v3 RULED AS A WHOLE").
--
-- The drawing's "New data the build needs", three of them, here:
--
--   1 · PHOTOS INTO THE STORY, PHOTO BY PHOTO — `event_supplier_story_shares`. Until now only a whole Supplier Ultra
--       album was shared, on or off (`vendor_event_album_shares`). One row per filed photo the supplier sent at
--       wrap-up. KEPT ON EVERY PLAN; the story shows them only while the shop is on Supplier Ultra (read at render).
--       The couple's answer is their own column: Approve all → 'approved', Hide → 'hidden' (it leaves THEIR story
--       only — the supplier's shop and files are untouched; their shipped Show · Hide still decides the shop).
--   2 · SILENCE = ACCEPTED — no job flips anything: a 'waiting' share counts as accepted once `shared_at` is older
--       than `platform_settings.story_photo_silence_days`, worked out at read time (the repo has no scheduler for
--       this, and a read-time rule cannot drift from the setting). NULL = not set = nothing is accepted by silence.
--   3 · "WRAPPED UP" FOR ONE EVENT — `supplier_event_wrap_ups`: the supplier finished this check. Nothing recorded
--       it before; the row simply went when the service was marked delivered.
--
-- ADD-ONLY. RLS on at CREATE TABLE time. The couple's decision changes ONLY through
-- `couple_decide_story_photos` (SECURITY DEFINER), exactly as `couple_decide_supplier_file` owns the shop decision.

-- ── 1 · photo-by-photo shares ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_supplier_story_shares (
  file_id           UUID PRIMARY KEY REFERENCES public.event_supplier_files(file_id) ON DELETE CASCADE,
  event_id          UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  vendor_profile_id UUID NOT NULL REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  shared_by         UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  shared_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  couple_decision   TEXT NOT NULL DEFAULT 'waiting' CHECK (couple_decision IN ('waiting', 'approved', 'hidden')),
  decided_at        TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS event_supplier_story_shares_event_idx
  ON public.event_supplier_story_shares (event_id, vendor_profile_id);

ALTER TABLE public.event_supplier_story_shares ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.event_supplier_story_shares FROM PUBLIC;
REVOKE ALL ON public.event_supplier_story_shares FROM anon;
REVOKE ALL ON public.event_supplier_story_shares FROM authenticated;
GRANT SELECT ON public.event_supplier_story_shares TO authenticated;
-- The shop inserts its own rows; it never writes the couple's decision (not in the column grant).
GRANT INSERT (file_id, event_id, vendor_profile_id, shared_by) ON public.event_supplier_story_shares TO authenticated;

DROP POLICY IF EXISTS event_supplier_story_shares_shop_read ON public.event_supplier_story_shares;
CREATE POLICY event_supplier_story_shares_shop_read
  ON public.event_supplier_story_shares FOR SELECT TO authenticated
  USING (
    vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    OR vendor_profile_id IN (SELECT public.current_vendor_ids())
    OR event_id IN (SELECT public.current_event_ids())
    OR (SELECT public.is_admin())
  );

DROP POLICY IF EXISTS event_supplier_story_shares_shop_insert ON public.event_supplier_story_shares;
CREATE POLICY event_supplier_story_shares_shop_insert
  ON public.event_supplier_story_shares FOR INSERT TO authenticated
  WITH CHECK (
    (vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
      OR vendor_profile_id IN (SELECT public.current_vendor_ids()))
    AND shared_by = (SELECT auth.uid())
    -- the photo is THIS shop's, filed for THIS event
    AND EXISTS (
      SELECT 1 FROM public.event_supplier_files f
       WHERE f.file_id = event_supplier_story_shares.file_id
         AND f.event_id = event_supplier_story_shares.event_id
         AND f.vendor_profile_id = event_supplier_story_shares.vendor_profile_id
         AND f.kind = 'photo'
    )
  );

-- ── 2 · the couple decides — their only write ─────────────────────────────
CREATE OR REPLACE FUNCTION public.couple_decide_story_photos(p_event_id UUID, p_vendor_profile_id UUID, p_decision TEXT, p_file_ids UUID[])
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n INTEGER;
BEGIN
  -- 'approved' is Approve all and also "show it again" after a Hide; 'hidden' takes it off THEIR story only.
  IF p_decision NOT IN ('approved', 'hidden') THEN
    RAISE EXCEPTION 'approve or hide' USING ERRCODE = '22023';
  END IF;
  IF p_event_id NOT IN (SELECT public.current_couple_event_ids()) THEN
    RAISE EXCEPTION 'only the couple of this event decides' USING ERRCODE = '42501';
  END IF;
  -- NULL file list = every photo this shop shared to this event ("Approve all").
  UPDATE public.event_supplier_story_shares
     SET couple_decision = p_decision,
         decided_at = NOW()
   WHERE event_id = p_event_id
     AND vendor_profile_id = p_vendor_profile_id
     AND (p_file_ids IS NULL OR file_id = ANY (p_file_ids));
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

REVOKE ALL ON FUNCTION public.couple_decide_story_photos(UUID, UUID, TEXT, UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.couple_decide_story_photos(UUID, UUID, TEXT, UUID[]) TO authenticated;

-- ── 3 · "wrapped up" for one event ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.supplier_event_wrap_ups (
  event_id          UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  vendor_profile_id UUID NOT NULL REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  wrapped_by        UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  wrapped_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  photos_shared     INTEGER NOT NULL DEFAULT 0 CHECK (photos_shared >= 0),
  PRIMARY KEY (event_id, vendor_profile_id)
);

ALTER TABLE public.supplier_event_wrap_ups ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.supplier_event_wrap_ups FROM PUBLIC;
REVOKE ALL ON public.supplier_event_wrap_ups FROM anon;
REVOKE ALL ON public.supplier_event_wrap_ups FROM authenticated;
GRANT SELECT, INSERT ON public.supplier_event_wrap_ups TO authenticated;

DROP POLICY IF EXISTS supplier_event_wrap_ups_shop_read ON public.supplier_event_wrap_ups;
CREATE POLICY supplier_event_wrap_ups_shop_read
  ON public.supplier_event_wrap_ups FOR SELECT TO authenticated
  USING (
    vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    OR vendor_profile_id IN (SELECT public.current_vendor_ids())
    OR (SELECT public.is_admin())
  );

DROP POLICY IF EXISTS supplier_event_wrap_ups_shop_insert ON public.supplier_event_wrap_ups;
CREATE POLICY supplier_event_wrap_ups_shop_insert
  ON public.supplier_event_wrap_ups FOR INSERT TO authenticated
  WITH CHECK (
    (vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
      OR vendor_profile_id IN (SELECT public.current_vendor_ids()))
    AND wrapped_by = (SELECT auth.uid())
    AND event_id IN (SELECT public.current_vendor_booked_event_ids())
  );

-- ── 4 · the silence setting (its admin field is Today v3 part 5) ──────────
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS story_photo_silence_days INTEGER;
ALTER TABLE public.platform_settings
  DROP CONSTRAINT IF EXISTS platform_settings_story_photo_silence_days_range;
ALTER TABLE public.platform_settings
  ADD CONSTRAINT platform_settings_story_photo_silence_days_range
  CHECK (story_photo_silence_days IS NULL OR (story_photo_silence_days > 0 AND story_photo_silence_days <= 90));

COMMENT ON TABLE public.event_supplier_story_shares IS
  'Today v3 part 3 — a photo a supplier sent to the event''s story at wrap-up. Kept on every plan; shown only while the shop is on Supplier Ultra. couple_decision: waiting · approved · hidden (hidden = their story only). Owner 2026-11-19.';
COMMENT ON TABLE public.supplier_event_wrap_ups IS
  'Today v3 part 3 — the supplier finished the event''s wrap-up (photos · reviews · confirm). Owner 2026-11-19.';
COMMENT ON COLUMN public.platform_settings.story_photo_silence_days IS
  'Today v3 — days of silence after which a photo shared to a couple''s story counts as accepted. NULL = not set: nothing is accepted by silence. Owner-set on Admin › Settings (ruled 7, 2026-11-19).';
