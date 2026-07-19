-- 20270818135217_founder_seats.sql
--
-- Founder seats — up to 10 owner-granted platform-founder accounts
-- (owner-locked 2026-07-16 · corpus Founder_Account_Token_Free_Inquiry_2026-07-16.md).
--
-- The model
-- ---------
-- Exactly one small table, `founder_seats`, holds the owner-granted seats
-- (hard cap 10 via the seat_no CHECK — enforced by the schema, not convention;
-- Ice + Cale are the first two, remaining seats "filled later" from the admin
-- console). A seat confers three things:
--
--   1. TOKEN-FREE VENDOR INQUIRIES — when a founder-hosted event inquires,
--      the vendor's accept is comped: the unlock row is written with
--      tokens_burned = 0 + comp_reason = 'founder', no wallet debit, and (on
--      the hold path) NO lead_token_holds row — nothing to settle or release.
--      The FREE-tier gate is intentionally UNCHANGED (free vendors still can't
--      accept in-app inquiries, founder or not); the verified weekly limit is
--      waived for the founder unlock itself AND comped rows never consume the
--      weekly quota (the count filters comp_reason IS NULL).
--   2. ALL IN-APP FEATURES ALREADY PAID FOR — event_host_holds_founder_seat()
--      mirrors event_host_is_internal() (§10a, migration 20270806100000) and is
--      OR'd into eventSkuActive() app-side, so a founder-hosted event owns
--      every SKU with no order and no comp grant. Vendor money is untouched
--      (external, 0% commission) — founders pay vendors like any client.
--   3. AN EXPLICIT, SERVER-ASSERTED FOUNDER SIGNAL — the vendor thread badge +
--      inquiry notification read these definer helpers, never profile text, so
--      the "founder of the app" claim cannot be impersonated.
--
-- NAMING — "founder" collision guard: inside unlock_vendor_event /
-- unlock_vendor_event_hold, v_founder / v_is_founder already mean the VENDOR
-- TEAM's founder (store-wallet draw). The platform concept is therefore
-- consistently named *founder seat* (founder_seats / user_holds_founder_seat /
-- event_host_holds_founder_seat / v_seat_comp) everywhere in this file.
--
-- `founder seat` vs `is_internal`: deliberately a SEPARATE designation.
-- is_internal (§10a) is the team/ops flag and may later cover non-founder
-- staff; the vendor-facing "founder" claim must only ever be true for
-- owner-granted seats.
--
-- Idempotent (IF NOT EXISTS / OR REPLACE / ON CONFLICT DO NOTHING throughout).

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. founder_seats — RLS at CREATE TABLE time (canonical pattern).
--    Writes go ONLY through the service-role admin client (admin console
--    grant/revoke actions) — no INSERT/UPDATE/DELETE policies on purpose.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.founder_seats (
  seat_no    SMALLINT PRIMARY KEY CHECK (seat_no BETWEEN 1 AND 10),
  user_id    UUID NOT NULL UNIQUE REFERENCES public.users(user_id) ON DELETE CASCADE,
  label      TEXT,
  granted_by UUID REFERENCES public.users(user_id),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.founder_seats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS founder_seats_self_read ON public.founder_seats;
CREATE POLICY founder_seats_self_read ON public.founder_seats
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS founder_seats_admin_read ON public.founder_seats;
CREATE POLICY founder_seats_admin_read ON public.founder_seats
  FOR SELECT USING (public.is_admin());

-- ----------------------------------------------------------------------------
-- 2. Definer helpers — mirror event_host_is_internal (20270806100000) exactly:
--    same host definition (couple member OR accepted primary-host moderator),
--    same SECURITY DEFINER rationale (gates run under the service-role client
--    on public pages; scoping host→seat server-side never leaks status).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.user_holds_founder_seat(
  p_user_id UUID
) RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.founder_seats fs WHERE fs.user_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.event_host_holds_founder_seat(
  p_event_id UUID
) RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.founder_seats fs
     WHERE fs.user_id IN (
            -- Legacy couple host.
            SELECT em.user_id
              FROM public.event_members em
             WHERE em.event_id = p_event_id
               AND em.member_type = 'couple'
            UNION
            -- Iteration 0048 primary-host moderator (accepted, not removed).
            SELECT m.user_id
              FROM public.event_moderators m
             WHERE m.event_id = p_event_id
               AND m.removed_at IS NULL
               AND m.accepted_at IS NOT NULL
               AND m.role_subtype IN (
                 'bride','groom','partner1','partner2',
                 'parent_of_bride','parent_of_groom','wedding_planner_external'
               )
       )
  );
$$;

GRANT EXECUTE ON FUNCTION public.user_holds_founder_seat(UUID)
  TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.event_host_holds_founder_seat(UUID)
  TO authenticated, anon, service_role;

-- ----------------------------------------------------------------------------
-- 3. Audit column — why an unlock row carries no burn.
-- ----------------------------------------------------------------------------
ALTER TABLE public.vendor_event_unlocks
  ADD COLUMN IF NOT EXISTS comp_reason TEXT;

-- ----------------------------------------------------------------------------
-- 4. unlock_vendor_event — VERBATIM live body (20270401611377) with the
--    founder-seat comp branch:
--      (a) v_seat_comp := event_host_holds_founder_seat(p_event_id);
--      (b) verified weekly limit: comped rows excluded from the count AND the
--          limit waived for a comped unlock itself;
--      (c) comped unlock → v_tokens := 0, comp_reason = 'founder', no debit.
--    Tier gates, idempotency, member gate, region→band: unchanged.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.unlock_vendor_event(
  p_vendor_profile_id UUID,
  p_event_id          UUID
) RETURNS JSONB AS $$
DECLARE
  v_region     TEXT;
  v_tokens     INT;
  v_band       SMALLINT;
  v_tier       TEXT;
  v_already    BOOLEAN;
  v_week_count INT;
  v_rowcount   INT;
  v_paid       BOOLEAN;
  v_actor      UUID := auth.uid();
  v_founder    UUID;
  v_seat_comp  BOOLEAN;
BEGIN
  -- (a) Answering member gate: founder + co-admins + assigned agents may answer
  -- and burn; viewers / non-members are blocked.
  IF NOT EXISTS (
    SELECT 1 FROM public.vendor_team_members tm
    WHERE tm.vendor_profile_id = p_vendor_profile_id
      AND tm.user_id = v_actor
      AND tm.role IN ('owner', 'admin', 'agent')
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN: caller is not an answering member of this vendor';
  END IF;

  SELECT user_id INTO v_founder FROM public.vendor_profiles
    WHERE vendor_profile_id = p_vendor_profile_id;

  SELECT EXISTS (
    SELECT 1 FROM public.vendor_event_unlocks
    WHERE vendor_profile_id = p_vendor_profile_id AND event_id = p_event_id
  ) INTO v_already;
  IF v_already THEN
    RETURN jsonb_build_object('charged', false, 'already', true, 'tokens', 0);
  END IF;

  SELECT tier_state INTO v_tier FROM public.vendor_profiles
    WHERE vendor_profile_id = p_vendor_profile_id;

  IF v_tier IS NULL OR v_tier = 'free' THEN
    RAISE EXCEPTION 'TIER_FREE_NO_INAPP: free vendors cannot accept in-app inquiries';
  END IF;

  -- Founder-seat comp (platform founder ≠ v_founder, the vendor-team founder).
  v_seat_comp := public.event_host_holds_founder_seat(p_event_id);

  IF v_tier = 'verified' AND NOT v_seat_comp THEN
    SELECT COUNT(*) INTO v_week_count
      FROM public.vendor_event_unlocks
     WHERE vendor_profile_id = p_vendor_profile_id
       AND unlocked_at > NOW() - INTERVAL '7 days'
       AND comp_reason IS NULL;
    IF v_week_count >= 10 THEN
      RAISE EXCEPTION 'VERIFIED_WEEKLY_LIMIT: verified vendors can answer up to 10 in-app inquiries per week';
    END IF;
  END IF;

  v_paid := (v_tier IN ('verified', 'solo', 'pro', 'enterprise'));

  SELECT region INTO v_region FROM public.events WHERE event_id = p_event_id;
  IF v_paid THEN
    -- Region → burn_band single source (regions, alias-resolved). Unchanged.
    SELECT r.burn_band
      INTO v_band
      FROM public.regions r
     WHERE lower(COALESCE(NULLIF(v_region, ''), '')) = lower(r.slug)
        OR lower(COALESCE(NULLIF(v_region, ''), '')) = lower(r.psgc_code)
        OR r.aliases @> ARRAY[lower(COALESCE(NULLIF(v_region, ''), ''))]
     LIMIT 1;
    IF v_band IS NULL THEN
      v_band := 1;
    END IF;
    v_tokens := v_band;
  ELSE
    v_tokens := 0;
    v_band := NULL;
  END IF;

  IF v_seat_comp THEN
    v_tokens := 0;
  END IF;

  INSERT INTO public.vendor_event_unlocks
    (vendor_profile_id, event_id, tokens_burned, region_slug, band, comp_reason)
  VALUES
    (p_vendor_profile_id, p_event_id, v_tokens, v_region, v_band,
     CASE WHEN v_seat_comp THEN 'founder' END)
  ON CONFLICT (vendor_profile_id, event_id) DO NOTHING;

  GET DIAGNOSTICS v_rowcount = ROW_COUNT;
  IF v_rowcount = 0 THEN
    RETURN jsonb_build_object('charged', false, 'already', true, 'tokens', 0);
  END IF;

  IF v_paid AND v_tokens > 0 THEN
    -- (b) Debit the ANSWERING member's own balance. Founder draws from the
    -- store wallet (earned vouchers FIFO → purchased); any other member draws
    -- from their personal purchased balance. Founder-seat comps never reach
    -- here (v_tokens = 0).
    IF v_actor = v_founder THEN
      PERFORM public.consume_vendor_assets_per_voucher(
        p_vendor_profile_id, v_tokens, 'INQUIRY_UNLOCK', p_event_id,
        jsonb_build_object('region', v_region, 'band', v_band, 'tier', v_tier)
      );
    ELSE
      PERFORM public.consume_member_purchased_tokens(
        p_vendor_profile_id, v_actor, v_tokens, 'INQUIRY_UNLOCK', p_event_id,
        jsonb_build_object('region', v_region, 'band', v_band, 'tier', v_tier)
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'charged', (v_paid AND v_tokens > 0), 'already', false, 'tokens', v_tokens,
    'region', v_region, 'band', v_band, 'tier', v_tier,
    'founder_comp', v_seat_comp);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- ----------------------------------------------------------------------------
-- 5. unlock_vendor_event_hold — VERBATIM live body (20270727563372) with the
--    same founder-seat branch. A comped unlock takes NO hold at all (nothing to
--    settle on reply, nothing to release on ghost) — the unlock row alone, at
--    tokens_burned 0 + comp_reason 'founder', is the whole record. The
--    consume/release paths are fail-soft on a missing hold
--    (consume_lead_token_hold_for → {ok:true, no_hold:true}).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.unlock_vendor_event_hold(
  p_vendor_profile_id UUID,
  p_event_id          UUID,
  p_thread_id         UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_region     TEXT;
  v_tokens     INT;
  v_band       SMALLINT;
  v_tier       TEXT;
  v_already    BOOLEAN;
  v_week_count INT;
  v_rowcount   INT;
  v_paid       BOOLEAN;
  v_actor      UUID := auth.uid();
  v_founder    UUID;
  v_avail      INT;
  v_held       INT;
  v_is_founder BOOLEAN;
  v_seat_comp  BOOLEAN;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.vendor_team_members tm
    WHERE tm.vendor_profile_id = p_vendor_profile_id
      AND tm.user_id = v_actor
      AND tm.role IN ('owner', 'admin', 'agent')
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN: caller is not an answering member of this vendor';
  END IF;

  SELECT user_id INTO v_founder FROM public.vendor_profiles
    WHERE vendor_profile_id = p_vendor_profile_id;
  v_is_founder := (v_actor = v_founder);

  SELECT EXISTS (
    SELECT 1 FROM public.vendor_event_unlocks
    WHERE vendor_profile_id = p_vendor_profile_id AND event_id = p_event_id
  ) INTO v_already;
  IF v_already THEN
    RETURN jsonb_build_object('charged', false, 'held', false, 'already', true, 'tokens', 0);
  END IF;

  SELECT tier_state INTO v_tier FROM public.vendor_profiles
    WHERE vendor_profile_id = p_vendor_profile_id;
  IF v_tier IS NULL OR v_tier = 'free' THEN
    RAISE EXCEPTION 'TIER_FREE_NO_INAPP: free vendors cannot accept in-app inquiries';
  END IF;

  -- Founder-seat comp (platform founder ≠ v_is_founder, the vendor-team founder).
  v_seat_comp := public.event_host_holds_founder_seat(p_event_id);

  IF v_tier = 'verified' AND NOT v_seat_comp THEN
    SELECT COUNT(*) INTO v_week_count
      FROM public.vendor_event_unlocks
     WHERE vendor_profile_id = p_vendor_profile_id
       AND unlocked_at > NOW() - INTERVAL '7 days'
       AND comp_reason IS NULL;
    IF v_week_count >= 10 THEN
      RAISE EXCEPTION 'VERIFIED_WEEKLY_LIMIT: verified vendors can answer up to 10 in-app inquiries per week';
    END IF;
  END IF;

  v_paid := (v_tier IN ('verified', 'solo', 'pro', 'enterprise'));

  SELECT region INTO v_region FROM public.events WHERE event_id = p_event_id;
  IF v_paid THEN
    SELECT r.burn_band INTO v_band
      FROM public.regions r
     WHERE lower(COALESCE(NULLIF(v_region, ''), '')) = lower(r.slug)
        OR lower(COALESCE(NULLIF(v_region, ''), '')) = lower(r.psgc_code)
        OR r.aliases @> ARRAY[lower(COALESCE(NULLIF(v_region, ''), ''))]
     LIMIT 1;
    IF v_band IS NULL THEN v_band := 1; END IF;
    v_tokens := v_band;
  ELSE
    v_tokens := 0;
    v_band := NULL;
  END IF;

  IF v_seat_comp THEN
    v_tokens := 0;
  END IF;

  -- Reservation — FIX 1: lock the wallet row FOR UPDATE so a concurrent accept by
  -- the same holder serializes here (reads this actor's held sum only AFTER the
  -- lock, so it sees a committed concurrent hold) → no over-hold past the balance.
  -- A founder-seat comp reserves nothing (v_tokens = 0 short-circuits here).
  IF v_paid AND v_tokens > 0 THEN
    IF v_is_founder THEN
      PERFORM public.evaluate_earned_token_expiry(p_vendor_profile_id);
      SELECT COALESCE(earned_tokens, 0) + COALESCE(purchased_tokens, 0) INTO v_avail
        FROM public.vendor_wallets WHERE vendor_id = p_vendor_profile_id FOR UPDATE;
    ELSE
      SELECT COALESCE(purchased_tokens, 0) INTO v_avail
        FROM public.vendor_member_token_wallets
       WHERE vendor_id = p_vendor_profile_id AND user_id = v_actor FOR UPDATE;
    END IF;
    v_avail := COALESCE(v_avail, 0);

    SELECT COALESCE(SUM(tokens), 0) INTO v_held
      FROM public.lead_token_holds
     WHERE vendor_profile_id = p_vendor_profile_id
       AND holder_user_id = v_actor
       AND status = 'held';

    IF (v_avail - v_held) < v_tokens THEN
      RAISE EXCEPTION 'INSUFFICIENT_WALLET_BALANCES: need % tokens · available % · % already held',
        v_tokens, v_avail, v_held;
    END IF;
  END IF;

  INSERT INTO public.vendor_event_unlocks
    (vendor_profile_id, event_id, tokens_burned, region_slug, band, comp_reason)
  VALUES
    (p_vendor_profile_id, p_event_id, 0, v_region, v_band,
     CASE WHEN v_seat_comp THEN 'founder' END)
  ON CONFLICT (vendor_profile_id, event_id) DO NOTHING;

  GET DIAGNOSTICS v_rowcount = ROW_COUNT;
  IF v_rowcount = 0 THEN
    RETURN jsonb_build_object('charged', false, 'held', false, 'already', true, 'tokens', 0);
  END IF;

  IF v_seat_comp THEN
    RETURN jsonb_build_object(
      'charged', false, 'held', false, 'already', false, 'tokens', 0,
      'region', v_region, 'band', v_band, 'tier', v_tier,
      'founder_comp', true);
  END IF;

  INSERT INTO public.lead_token_holds
    (vendor_profile_id, event_id, thread_id, holder_user_id, is_founder_draw,
     tokens, band, region, tier, status)
  VALUES
    (p_vendor_profile_id, p_event_id, p_thread_id, v_actor, v_is_founder,
     v_tokens, v_band, v_region, v_tier, 'held')
  ON CONFLICT (vendor_profile_id, event_id) DO NOTHING;

  RETURN jsonb_build_object(
    'charged', false, 'held', true, 'already', false, 'tokens', v_tokens,
    'region', v_region, 'band', v_band, 'tier', v_tier);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- ----------------------------------------------------------------------------
-- 6. Seed — seat 1 = the owner (guarded: no-op in envs without the account).
--    Seat 2 (Cale) + seats 3–10 are granted later from the admin console.
-- ----------------------------------------------------------------------------
INSERT INTO public.founder_seats (seat_no, user_id, label)
SELECT 1, u.user_id, 'Ice'
  FROM public.users u
 WHERE u.email = 'iscasasolaii@gmail.com'
 LIMIT 1
ON CONFLICT DO NOTHING;

COMMIT;
