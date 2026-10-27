-- the_portfolio_saves_and_spends_in_one_step
-- ============================================================================
-- THE PORTFOLIO: 50 FREE, IN CREDITS — THEN THE SHOP WALLET PAYS (owner 2026-10-23).
--
-- Owner, 23 Oct: every shop gets 50 portfolio credits free; after that 1 credit
-- a photo, 8 a 10-second clip, paid once and kept while the shop exists. The
-- free 50 COUNT CREDITS (*"yes they count credits"*) — a clip uses 8 of them.
-- 50-free replaces the plan ladder; a shop already past 50 keeps what it has.
-- A shop holding a personal invite's allowance (100) has that much free room
-- (PR #6823 / 20271286262047 — the allowance is kept after the gift ends).
--
-- `shop_portfolio_commit` is the ONE step a portfolio save takes. It writes the
-- new list AND charges the wallet in the same transaction, under the SAME
-- per-shop lock the wallet's spend door takes — so a save can never land
-- without its charge, a charge can never land without its photos, and two
-- devices saving at once are served one after the other.
--
-- ── THE ARITHMETIC (one formula, every case) ──────────────────────────────────
--   kept    = credits of the photos already on the page that stay on it
--   after   = credits of the whole new list
--   free    = max(50, the shop's personal-invite allowance) — read from the row
--   charge  = max(0, after − max(free, kept))
-- So: a re-save, a reorder or a removal charges nothing; a shop under 50 fills
-- its free room first; a shop already past 50 (grandfathered) pays for every
-- NEW photo; a photo taken off returns no credit ("paid once, kept") but frees
-- a free slot if it was one of the 50 (taking 5 off a 50 lets 5 in free;
-- taking 5 off a 60 and adding 5 charges 5).
--
-- A ref is a clip (8) when it names a video file; every other ref is a photo
-- (1). `shop_portfolio_ref_credits` is that rule, said once.
--
-- Answers (jsonb):
--   {status:'ok',           charged, balance (null when nothing was charged), free_used, photos, clips}
--   {status:'insufficient', charge, balance, free_used}   — nothing written
--   {status:'not_owner'}                                  — nothing written
--   {status:'duplicate',    balance}                      — this save already landed
-- Callable by an authenticated OWNER (the same owner-only rule as the
-- vendor_profiles write policy) or an admin; anon never.
--
-- KEEP IDEMPOTENT (may be re-applied): CREATE OR REPLACE.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.shop_portfolio_ref_credits(p_ref TEXT)
 RETURNS INTEGER
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT CASE WHEN p_ref ~* '\.(mp4|mov|m4v|webm)$' THEN 8 ELSE 1 END;
$function$;

COMMENT ON FUNCTION public.shop_portfolio_ref_credits(TEXT) IS
  'Owner 2026-10-23: a portfolio photo is 1 credit, a 10-second clip 8. The free 50 count credits.';

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
  v_owner   UUID;
  v_old     TEXT[];
  v_new     TEXT[] := ARRAY[]::TEXT[];
  v_ref     TEXT;
  v_kept    INTEGER := 0;
  v_after   INTEGER := 0;
  v_charge  INTEGER;
  v_room    INTEGER;
  v_w       INTEGER;
  v_photos  INTEGER := 0;
  v_clips   INTEGER := 0;
  v_balance INTEGER;
  -- The owner's free 50 (2026-10-23). NOT a parameter: an authenticated caller
  -- chooses every argument, and a free allowance it could pass would be a
  -- price it could set. Mirrored by PORTFOLIO_FREE_CREDITS in
  -- lib/shop-portfolio-credits.ts; a guard holds the two equal.
  v_base    CONSTANT INTEGER := 50;
  -- The shop's own free room: the base, or a personal invite's allowance
  -- (`vendor_profiles.portfolio_photo_allowance`, admin / service-role only —
  -- the shop cannot write it), whichever is more. Read under the row lock.
  v_free    INTEGER;
  v_allow   INTEGER;
BEGIN
  IF p_vendor_profile_id IS NULL OR p_spend_ref IS NULL OR length(btrim(p_spend_ref)) = 0 THEN
    RETURN jsonb_build_object('status', 'invalid');
  END IF;

  -- The wallet's own lock: a save and a spend for the same shop take turns.
  PERFORM pg_advisory_xact_lock(
    hashtextextended('shop_papic_wallet:' || p_vendor_profile_id::text, 0));

  SELECT vp.user_id, COALESCE(vp.portfolio_r2_keys, ARRAY[]::TEXT[]), vp.portfolio_photo_allowance
    INTO v_owner, v_old, v_allow
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
  v_free := GREATEST(v_base, COALESCE(v_allow, 0));

  -- A save that already landed (a double tap, a retried request) is answered.
  IF EXISTS (
    SELECT 1 FROM public.shop_papic_wallet_entries e
     WHERE e.vendor_profile_id = p_vendor_profile_id AND e.spend_ref = p_spend_ref
  ) THEN
    SELECT COALESCE(SUM(e.delta), 0)::INTEGER INTO v_balance
      FROM public.shop_papic_wallet_entries e WHERE e.vendor_profile_id = p_vendor_profile_id;
    RETURN jsonb_build_object('status', 'duplicate', 'balance', v_balance);
  END IF;

  -- The new list, de-duplicated in order; blanks dropped.
  FOREACH v_ref IN ARRAY COALESCE(p_refs, ARRAY[]::TEXT[]) LOOP
    IF v_ref IS NOT NULL AND length(btrim(v_ref)) > 0 AND NOT (v_ref = ANY (v_new)) THEN
      v_new := v_new || v_ref;
    END IF;
  END LOOP;

  FOREACH v_ref IN ARRAY v_new LOOP
    v_w := public.shop_portfolio_ref_credits(v_ref);
    v_after := v_after + v_w;
    IF v_ref = ANY (v_old) THEN
      v_kept := v_kept + v_w;
    END IF;
  END LOOP;

  v_charge := GREATEST(0, v_after - GREATEST(v_free, v_kept));

  IF v_charge > 0 THEN
    -- Which new items were paid for (any part past the free room) — the sheet
    -- says "72 photos past the free 50", never a guess from the credits.
    v_room := GREATEST(0, v_free - v_kept);
    FOREACH v_ref IN ARRAY v_new LOOP
      CONTINUE WHEN v_ref = ANY (v_old);
      v_w := public.shop_portfolio_ref_credits(v_ref);
      IF v_w > v_room THEN
        IF v_w = 8 THEN v_clips := v_clips + 1; ELSE v_photos := v_photos + 1; END IF;
      END IF;
      v_room := GREATEST(0, v_room - v_w);
    END LOOP;

    SELECT COALESCE(SUM(e.delta), 0)::INTEGER INTO v_balance
      FROM public.shop_papic_wallet_entries e WHERE e.vendor_profile_id = p_vendor_profile_id;
    IF v_balance < v_charge THEN
      RETURN jsonb_build_object('status', 'insufficient', 'charge', v_charge,
                                'balance', v_balance, 'free_used', LEAST(v_free, v_kept));
    END IF;

    INSERT INTO public.shop_papic_wallet_entries
      (vendor_profile_id, delta, kind, spend_ref, photos, clips, note, created_by)
    VALUES
      (p_vendor_profile_id, -v_charge, 'portfolio_spend', p_spend_ref, v_photos, v_clips,
       'Portfolio photos past the free ' || v_free, auth.uid());
    v_balance := v_balance - v_charge;
  END IF;

  UPDATE public.vendor_profiles
     SET portfolio_r2_keys = v_new,
         updated_at        = NOW()
   WHERE vendor_profile_id = p_vendor_profile_id;

  RETURN jsonb_build_object(
    'status', 'ok',
    'charged', v_charge,
    'balance', v_balance,
    'free_used', LEAST(v_free, v_after),
    'photos', v_photos,
    'clips', v_clips
  );
END;
$function$;

COMMENT ON FUNCTION public.shop_portfolio_commit(UUID, TEXT[], TEXT) IS
  'The ONE step a portfolio save takes (owner 2026-10-23): writes the new list and charges '
  'the shop wallet for what passes the free 50 credits, in one transaction under the wallet''s '
  'per-shop lock. charge = max(0, after − max(free, kept)). Owner-only (or admin).';

REVOKE ALL ON FUNCTION public.shop_portfolio_commit(UUID, TEXT[], TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.shop_portfolio_commit(UUID, TEXT[], TEXT) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.shop_portfolio_ref_credits(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.shop_portfolio_ref_credits(TEXT) TO authenticated, service_role;

COMMIT;
