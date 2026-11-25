-- ============================================================================
-- 20271360535722_supplier_event_photo_limits.sql
--
-- SUPPLIER PHOTO LIMITS ARE THE PLAN'S; THE PORTFOLIO HAS NO CAP (owner 2026-11-23, specs DECISION_LOG
-- a4348ec8 → 6215f5f4, the last row winning):
--   · event captures, per (shop, event): Free 10 photos · Verified 10 photos, no videos · Plus · Pro · Ultra no
--     limit — storage is the only ceiling. The numbers live ONLY in `TIER_CAPS` (apps/web/lib/vendor-tier-caps.ts,
--     `eventPhotosPerEvent` / `eventVideos`), enforced by /api/vendor/papic-capture. A supplier's captures never
--     spend the couple's Papic credits.
--   · the portfolio: *"Yes, drop it"* — the every-plan free 50, the personal invite's 100 and "then 1 Papic credit a
--     photo from the shop wallet" are gone. Storage is the only limit.
--
-- 1 · `vendor_papic_capture_grants` is DROPPED. It was the per-(vendor, event) Lite/Ltd/Unli TIER row
--     (20270811377742: free 10 photos + 3 clips, +30/+100 paid in retired vendor tokens). Nothing in the app writes
--     it (tests/db/ugat-both-ends.baseline.txt: "table-no-writer"); its one reader (`hasPaidUnliUpgrade`) is deleted in
--     the same PR. Only its own RLS policy depends on it — no view, function or foreign key names it.
-- 2 · `shop_portfolio_commit` keeps its signature and its one-step write (owner-only, under the shop row's lock) and
--     charges NOTHING: no free room, no wallet row. `p_spend_ref` is kept so a caller mid-deploy still matches.
-- 3 · `file_supplier_page_notice` files the notice and charges NOTHING (the same rule, the album → page door).
--
-- `vendor_profiles.portfolio_photo_allowance` is RETIRED, NOT DELETED (owner: "retire, never delete"): nothing reads it
-- any more; the personal invite's switch that wrote it is gone from the admin form.
--
-- Idempotent: DROP … IF EXISTS, CREATE OR REPLACE. Applied only by the pipeline (`supabase db push --include-all`).
-- ============================================================================

BEGIN;

-- ── 1 · the retired tier row ────────────────────────────────────────────────
DROP TABLE IF EXISTS public.vendor_papic_capture_grants;

-- ── 2 · a portfolio save writes the list and charges nothing ─────────────────
CREATE OR REPLACE FUNCTION public.shop_portfolio_commit(
  p_vendor_profile_id UUID,
  p_refs              TEXT[],
  p_spend_ref         TEXT
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_owner  UUID;
  v_new    TEXT[] := ARRAY[]::TEXT[];
  v_ref    TEXT;
  v_photos INTEGER := 0;
  v_clips  INTEGER := 0;
BEGIN
  IF p_vendor_profile_id IS NULL OR p_spend_ref IS NULL OR length(btrim(p_spend_ref)) = 0 THEN
    RETURN jsonb_build_object('status', 'invalid');
  END IF;

  SELECT vp.user_id
    INTO v_owner
    FROM public.vendor_profiles vp
   WHERE vp.vendor_profile_id = p_vendor_profile_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'invalid');
  END IF;
  -- Owner-only, exactly as the vendor_profiles write policy (vendor_profiles_owner).
  IF v_owner IS DISTINCT FROM auth.uid() AND NOT COALESCE(public.is_admin(), FALSE) THEN
    RETURN jsonb_build_object('status', 'not_owner');
  END IF;

  -- The new list, de-duplicated in order; blanks dropped.
  FOREACH v_ref IN ARRAY COALESCE(p_refs, ARRAY[]::TEXT[]) LOOP
    IF v_ref IS NOT NULL AND length(btrim(v_ref)) > 0 AND NOT (v_ref = ANY (v_new)) THEN
      v_new := v_new || v_ref;
      IF public.shop_portfolio_ref_credits(v_ref) = 1 THEN
        v_photos := v_photos + 1;
      ELSE
        v_clips := v_clips + 1;
      END IF;
    END IF;
  END LOOP;

  UPDATE public.vendor_profiles
     SET portfolio_r2_keys = v_new,
         updated_at        = NOW()
   WHERE vendor_profile_id = p_vendor_profile_id;

  RETURN jsonb_build_object(
    'status', 'ok',
    'charged', 0,
    'balance', NULL,
    'photos', v_photos,
    'clips', v_clips
  );
END;
$function$;

COMMENT ON FUNCTION public.shop_portfolio_commit(UUID, TEXT[], TEXT) IS
  'The ONE step a portfolio save takes: writes the new list (owner-only, under the shop row''s lock). Charges nothing '
  'since 2026-11-23 (owner: the 50-photo portfolio cap is dropped — storage is the only limit). p_spend_ref is kept '
  'for the signature and not used.';

REVOKE ALL ON FUNCTION public.shop_portfolio_commit(UUID, TEXT[], TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.shop_portfolio_commit(UUID, TEXT[], TEXT) TO authenticated, service_role;

-- ── 3 · an album photo filed for the page charges nothing ────────────────────
CREATE OR REPLACE FUNCTION public.file_supplier_page_notice(p_photo_id UUID, p_page_ref TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  a       RECORD;
  v_owner UUID;
  v_list  TEXT[];
  n       RECORD;
BEGIN
  IF p_photo_id IS NULL OR p_page_ref IS NULL OR length(btrim(p_page_ref)) = 0 THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;
  SELECT p.vendor_profile_id, p.event_id, p.hidden_at, p.nsfw_checked
    INTO a
    FROM public.vendor_papic_portfolio_photos p
   WHERE p.photo_id = p_photo_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  SELECT vp.user_id, COALESCE(vp.portfolio_r2_keys, ARRAY[]::TEXT[])
    INTO v_owner, v_list
    FROM public.vendor_profiles vp
   WHERE vp.vendor_profile_id = a.vendor_profile_id
   FOR UPDATE;
  -- Owner-only, exactly as `shop_portfolio_commit`.
  IF v_owner IS DISTINCT FROM auth.uid() AND NOT COALESCE(public.is_admin(), FALSE) THEN
    RETURN jsonb_build_object('status', 'not_owner');
  END IF;
  IF a.hidden_at IS NOT NULL OR a.nsfw_checked IS NOT TRUE THEN
    RETURN jsonb_build_object('status', 'refused');
  END IF;

  SELECT sn.notice_id, sn.public_from, sn.published_at, sn.removed_at, sn.removed_by
    INTO n
    FROM public.supplier_page_photo_notices sn
   WHERE sn.photo_id = p_photo_id;
  IF FOUND THEN
    RETURN jsonb_build_object('status', 'exists', 'notice_id', n.notice_id, 'public_from', n.public_from,
      'published_at', n.published_at, 'removed_at', n.removed_at, 'removed_by', n.removed_by, 'charged', 0);
  END IF;
  IF p_page_ref = ANY (v_list) THEN
    RETURN jsonb_build_object('status', 'already');
  END IF;

  INSERT INTO public.supplier_page_photo_notices (photo_id, vendor_profile_id, event_id, page_ref)
  VALUES (p_photo_id, a.vendor_profile_id, a.event_id, p_page_ref)
  RETURNING notice_id, public_from, published_at, removed_at, removed_by INTO n;

  RETURN jsonb_build_object('status', 'ok', 'notice_id', n.notice_id, 'public_from', n.public_from,
    'published_at', n.published_at, 'removed_at', n.removed_at, 'removed_by', n.removed_by, 'charged', 0);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.file_supplier_page_notice(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.file_supplier_page_notice(UUID, TEXT) TO authenticated, service_role;

COMMENT ON COLUMN public.vendor_profiles.portfolio_photo_allowance IS
  'RETIRED 2026-11-23 (owner: the portfolio cap is dropped — storage is the only limit). Read by nothing; kept, never '
  'deleted. Was the personal invite''s 100 portfolio photos.';

COMMIT;
