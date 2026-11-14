-- setnayan_gifts_to_a_shop
-- Created via `pnpm migration:new`. KEEP IDEMPOTENT. Only ADDS: one table, four functions, and two branches at the
-- top and bottom of the shipped `sweep_vendor_tier_expiry` (its body is copied from the OBJECT's newest definition,
-- 20271310256381, with nothing taken out).
--
-- 🎁 SETNAYAN GIFTS TO A SHOP (owner 14 Nov 2026, DECISION_LOG "SETNAYAN CAN GIFT A SUPPLIER TWO KINDS OF THING" ·
-- "A GIFTED SUPPLIER PLAN: THE SHOP CHOOSES" · "STRATEGIC TASTE OF THE HIGHER TIER" · "FINAL — … 28 DAYS" ·
-- "A SHOP ALREADY ON SUPPLIER ULTRA … ADDS 28 DAYS" · "PRESSING REDEEM IS THE CLAIM" · "GIFT DESIGN APPROVED").
--
--   · GIFT STOCK (Papic packs · Event Plus · Event Pro) lands in the shop's gift stock through the ONE door badge
--     rewards already use (`shop_badge_reward_grant`, badge 'setnayan_gift', key 'setnayan_gift:<gift_id>'), so it
--     sits OUTSIDE the 40% gift limit exactly as a badge reward does — no second stock mechanism.
--   · PLAN TIME (Supplier Plus · Pro · Ultra, one 28-day block) is written onto `vendor_profiles` the way every comp
--     is (`tier_source = 'admin_comp'` + `tier_expires_at`). A plan the shop was on is PAUSED, not lost: the gift row
--     keeps the plan and the days it had left, and the shipped login-driven lapse (`sweep_vendor_tier_expiry`) hands
--     them back the moment the gift ends — or `setnayan_plan_gift_go_back` does, early, when the shop asks.
--
-- 🔒 THE PRESS IS THE CLAIM, EXACTLY ONCE: `setnayan_shop_gift_claim` stamps `claimed_at` in ONE conditional UPDATE
-- (`… WHERE gift_id = $1 AND claimed_at IS NULL`). A double tap, a retry after a lost connection, two tabs or two
-- phones all land on that one row; only the call that flips it grants anything. The stock grant is keyed to the gift
-- as well (UNIQUE `shop_badge_rewards_once`), so even a grant re-run cannot pay twice.
-- Proven by tests/db/a-setnayan-gift-is-claimed-once.db.test.ts.

BEGIN;

CREATE TABLE IF NOT EXISTS public.setnayan_shop_gifts (
  gift_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_profile_id    UUID NOT NULL REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  gift_type            TEXT NOT NULL CONSTRAINT setnayan_shop_gifts_type_allowed CHECK (gift_type IN ('stock', 'plan')),
  -- gift stock
  stock_kind           TEXT CONSTRAINT setnayan_shop_gifts_stock_kind_allowed
                         CHECK (stock_kind IS NULL OR stock_kind IN ('papic', 'event_plus', 'event_pro')),
  stock_units          INTEGER CONSTRAINT setnayan_shop_gifts_stock_units_range
                         CHECK (stock_units IS NULL OR (stock_units >= 1 AND stock_units <= 10)),
  -- Papic only: the pack's credits, READ from the live catalogue when the admin sent it (never typed).
  stock_credits_each   INTEGER CONSTRAINT setnayan_shop_gifts_credits_positive
                         CHECK (stock_credits_each IS NULL OR stock_credits_each > 0),
  -- plan time
  plan_tier            public.vendor_tier_state,
  plan_days            INTEGER NOT NULL DEFAULT 28
                         CONSTRAINT setnayan_shop_gifts_plan_days_range CHECK (plan_days >= 1 AND plan_days <= 366),
  note                 TEXT CONSTRAINT setnayan_shop_gifts_note_length CHECK (note IS NULL OR length(note) <= 500),
  sent_by              UUID,
  sent_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- the claim (the press)
  claimed_at           TIMESTAMPTZ,
  claimed_by           UUID,
  claim_choice         TEXT CONSTRAINT setnayan_shop_gifts_choice_allowed
                         CHECK (claim_choice IS NULL OR claim_choice IN ('stock', 'start', 'now', 'after', 'extend')),
  -- a plan gift once it runs
  held_until           TIMESTAMPTZ,
  plan_starts_at       TIMESTAMPTZ,
  plan_ends_at         TIMESTAMPTZ,
  -- the plan it paused, handed back when it ends
  return_tier          public.vendor_tier_state,
  return_source        TEXT,
  return_billing_cycle TEXT,
  return_remaining     INTERVAL,
  return_open_ended    BOOLEAN NOT NULL DEFAULT FALSE,
  finished_at          TIMESTAMPTZ,
  finish_reason        TEXT CONSTRAINT setnayan_shop_gifts_finish_allowed
                         CHECK (finish_reason IS NULL OR finish_reason IN ('ended', 'went_back', 'stayed', 'superseded')),
  CONSTRAINT setnayan_shop_gifts_shape CHECK (
    (gift_type = 'stock' AND stock_kind IS NOT NULL AND stock_units IS NOT NULL AND plan_tier IS NULL
       AND (stock_kind <> 'papic' OR stock_credits_each IS NOT NULL))
    OR (gift_type = 'plan' AND plan_tier IN ('solo', 'pro', 'enterprise') AND stock_kind IS NULL
       AND stock_units IS NULL AND stock_credits_each IS NULL)
  ),
  CONSTRAINT setnayan_shop_gifts_claim_whole CHECK ((claimed_at IS NULL) = (claim_choice IS NULL)),
  CONSTRAINT setnayan_shop_gifts_choice_fits CHECK (
    claim_choice IS NULL
    OR (gift_type = 'stock' AND claim_choice = 'stock')
    OR (gift_type = 'plan' AND claim_choice IN ('start', 'now', 'after', 'extend'))
  )
);

ALTER TABLE public.setnayan_shop_gifts ENABLE ROW LEVEL SECURITY;

-- One plan gift at a time is RUNNING or HELD per shop (an 'extend' only adds days to the plan the shop is on).
CREATE UNIQUE INDEX IF NOT EXISTS setnayan_shop_gifts_one_live_plan_gift
  ON public.setnayan_shop_gifts (vendor_profile_id)
  WHERE gift_type = 'plan' AND claim_choice IN ('start', 'now', 'after') AND finished_at IS NULL;

CREATE INDEX IF NOT EXISTS setnayan_shop_gifts_waiting_idx
  ON public.setnayan_shop_gifts (vendor_profile_id, sent_at)
  WHERE claimed_at IS NULL;

COMMENT ON TABLE public.setnayan_shop_gifts IS
  'A gift Setnayan sent a shop (owner 2026-11-14): gift stock (Papic packs, Event Plus, Event Pro — lands through '
  'shop_badge_reward_grant, outside the 40% limit) or one 28-day block of Supplier Plus / Pro / Ultra. Written by the '
  'admin console (service_role); claimed ONCE by setnayan_shop_gift_claim (claimed_at set only while NULL). A plan '
  'the gift paused is handed back by sweep_vendor_tier_expiry when the gift ends, or early by setnayan_plan_gift_go_back.';

DROP POLICY IF EXISTS setnayan_shop_gifts_shop_read ON public.setnayan_shop_gifts;
CREATE POLICY setnayan_shop_gifts_shop_read
  ON public.setnayan_shop_gifts
  FOR SELECT TO authenticated
  USING (
    vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    OR (SELECT public.is_admin())
  );

REVOKE ALL ON TABLE public.setnayan_shop_gifts FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.setnayan_shop_gifts FROM authenticated;

-- ── the plan word ladder: Free / Verified < Supplier Plus < Pro < Ultra ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.setnayan_plan_gift_rank(p_tier TEXT)
 RETURNS INTEGER
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT CASE p_tier WHEN 'solo' THEN 1 WHEN 'pro' THEN 2 WHEN 'enterprise' THEN 3 ELSE 0 END;
$function$;

-- ── what a shop may press for a gift, given its plan RIGHT NOW (lib/setnayan-shop-gift.ts mirrors this) ─────────────
CREATE OR REPLACE FUNCTION public.setnayan_shop_gift_choices(p_gift_id UUID)
 RETURNS TEXT[]
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  g        public.setnayan_shop_gifts;
  v        public.vendor_profiles;
  v_on     BOOLEAN;
  v_cur    INTEGER;
  v_gift   INTEGER;
  v_busy   BOOLEAN;
BEGIN
  SELECT * INTO g FROM public.setnayan_shop_gifts WHERE gift_id = p_gift_id;
  IF NOT FOUND OR g.claimed_at IS NOT NULL THEN RETURN ARRAY[]::TEXT[]; END IF;
  IF g.gift_type = 'stock' THEN RETURN ARRAY['stock']; END IF;

  SELECT * INTO v FROM public.vendor_profiles WHERE vendor_profile_id = g.vendor_profile_id;
  IF NOT FOUND THEN RETURN ARRAY[]::TEXT[]; END IF;

  v_on   := v.tier_state IN ('solo', 'pro', 'enterprise') AND (v.tier_expires_at IS NULL OR v.tier_expires_at > now());
  v_cur  := CASE WHEN v_on THEN public.setnayan_plan_gift_rank(v.tier_state::TEXT) ELSE 0 END;
  v_gift := public.setnayan_plan_gift_rank(g.plan_tier::TEXT);
  v_busy := EXISTS (
    SELECT 1 FROM public.setnayan_shop_gifts o
     WHERE o.vendor_profile_id = g.vendor_profile_id AND o.gift_type = 'plan'
       AND o.claim_choice IN ('start', 'now', 'after') AND o.finished_at IS NULL
  );

  IF v_on AND v_cur = v_gift THEN
    -- Same plan (Ultra → Ultra): 28 more days on the block it is on (owner: "Yes, add 28 days").
    RETURN CASE WHEN v.tier_expires_at IS NULL THEN ARRAY[]::TEXT[] ELSE ARRAY['extend'] END;
  END IF;
  -- Another gift is running or held: this one waits until that one is over.
  IF v_busy THEN RETURN ARRAY[]::TEXT[]; END IF;
  IF NOT v_on THEN RETURN ARRAY['start']; END IF;
  IF v_gift > v_cur THEN
    RETURN CASE WHEN v.tier_expires_at IS NULL THEN ARRAY['now'] ELSE ARRAY['now', 'after'] END;
  END IF;
  -- A gift below the plan the shop is on can only wait for that plan to end.
  RETURN CASE WHEN v.tier_expires_at IS NULL THEN ARRAY[]::TEXT[] ELSE ARRAY['after'] END;
END;
$function$;

-- ── THE CLAIM ────────────────────────────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.setnayan_shop_gift_claim(
  p_gift_id           UUID,
  p_vendor_profile_id UUID,
  p_choice            TEXT,
  p_actor             UUID
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  g         public.setnayan_shop_gifts;
  v         public.vendor_profiles;
  v_allowed TEXT[];
  v_claimed UUID;
  v_on      BOOLEAN;
  v_end     TIMESTAMPTZ;
  v_grant   jsonb;
BEGIN
  SELECT * INTO g FROM public.setnayan_shop_gifts
   WHERE gift_id = p_gift_id AND vendor_profile_id = p_vendor_profile_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;
  IF g.claimed_at IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'already', 'choice', g.claim_choice, 'ends_at', g.plan_ends_at);
  END IF;

  -- One claim at a time per shop: the plan read below is the plan the write lands on.
  SELECT * INTO v FROM public.vendor_profiles WHERE vendor_profile_id = p_vendor_profile_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  v_allowed := public.setnayan_shop_gift_choices(p_gift_id);
  IF p_choice IS NULL OR NOT (p_choice = ANY (v_allowed)) THEN
    -- A row a racing call has just claimed reads as no choices: say 'already', never 'bad_choice'.
    IF EXISTS (SELECT 1 FROM public.setnayan_shop_gifts WHERE gift_id = p_gift_id AND claimed_at IS NOT NULL) THEN
      RETURN jsonb_build_object('status', 'already');
    END IF;
    RETURN jsonb_build_object('status', 'bad_choice', 'allowed', to_jsonb(v_allowed));
  END IF;

  -- 🔒 THE PRESS IS THE CLAIM — one statement, keyed to the gift, only while it is unclaimed.
  UPDATE public.setnayan_shop_gifts
     SET claimed_at = now(), claimed_by = p_actor, claim_choice = p_choice
   WHERE gift_id = p_gift_id AND claimed_at IS NULL
  RETURNING gift_id INTO v_claimed;
  IF v_claimed IS NULL THEN
    RETURN jsonb_build_object('status', 'already');
  END IF;

  IF p_choice = 'stock' THEN
    v_grant := public.shop_badge_reward_grant(
      p_vendor_profile_id, 'setnayan_gift:' || p_gift_id::TEXT, 'setnayan_gift',
      g.stock_kind, g.stock_units, g.stock_credits_each, 'A gift from Setnayan');
    IF COALESCE(v_grant ->> 'status', '') NOT IN ('granted', 'already') THEN
      RAISE EXCEPTION 'setnayan gift stock grant refused: %', v_grant;
    END IF;
    RETURN jsonb_build_object('status', 'claimed', 'choice', p_choice);
  END IF;

  v_on := v.tier_state IN ('solo', 'pro', 'enterprise') AND (v.tier_expires_at IS NULL OR v.tier_expires_at > now());

  IF p_choice = 'extend' THEN
    v_end := v.tier_expires_at + make_interval(days => g.plan_days);
    UPDATE public.vendor_profiles SET tier_expires_at = v_end WHERE vendor_profile_id = p_vendor_profile_id;
    -- A gift that is running on this same plan runs on with it (its end day is how the hand-back recognises it).
    UPDATE public.setnayan_shop_gifts
       SET plan_ends_at = v_end
     WHERE vendor_profile_id = p_vendor_profile_id AND gift_type = 'plan' AND gift_id <> p_gift_id
       AND claim_choice IN ('start', 'now', 'after') AND plan_starts_at IS NOT NULL AND finished_at IS NULL
       AND plan_ends_at IS NOT DISTINCT FROM v.tier_expires_at;
    UPDATE public.setnayan_shop_gifts
       SET plan_starts_at = v.tier_expires_at, plan_ends_at = v_end
     WHERE gift_id = p_gift_id;
    RETURN jsonb_build_object('status', 'claimed', 'choice', p_choice, 'ends_at', v_end);
  END IF;

  IF p_choice = 'after' THEN
    UPDATE public.setnayan_shop_gifts SET held_until = v.tier_expires_at WHERE gift_id = p_gift_id;
    RETURN jsonb_build_object('status', 'claimed', 'choice', p_choice, 'starts_at', v.tier_expires_at);
  END IF;

  -- 'start' (no plan) or 'now' (Upgrade now): the gifted plan starts today, the shop's own plan is paused.
  v_end := now() + make_interval(days => g.plan_days);
  UPDATE public.setnayan_shop_gifts
     SET plan_starts_at       = now(),
         plan_ends_at         = v_end,
         return_tier          = CASE WHEN v_on THEN v.tier_state END,
         return_source        = CASE WHEN v_on THEN v.tier_source END,
         return_billing_cycle = CASE WHEN v_on THEN v.tier_billing_cycle END,
         return_remaining     = CASE WHEN v_on AND v.tier_expires_at IS NOT NULL THEN v.tier_expires_at - now() END,
         return_open_ended    = (v_on AND v.tier_expires_at IS NULL)
   WHERE gift_id = p_gift_id;
  UPDATE public.vendor_profiles
     SET tier_state = g.plan_tier, tier_expires_at = v_end, tier_source = 'admin_comp', tier_billing_cycle = NULL
   WHERE vendor_profile_id = p_vendor_profile_id;
  RETURN jsonb_build_object('status', 'claimed', 'choice', p_choice, 'ends_at', v_end);
END;
$function$;

-- ── THE HAND-BACK: the shop returns to its own plan, with the days it had left ──────────────────────────────────────
-- p_reason 'ended' (from the lapse sweep — only once the gift's end day has passed) or 'went_back' (the shop's
-- "Go back to <plan>", any time while it runs). Returns 'none' · 'running' · 'superseded' · 'stayed' · 'returned'.
CREATE OR REPLACE FUNCTION public.setnayan_plan_gift_return(p_vendor_id UUID, p_reason TEXT)
 RETURNS TEXT
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  g public.setnayan_shop_gifts;
  v public.vendor_profiles;
BEGIN
  SELECT * INTO g FROM public.setnayan_shop_gifts
   WHERE vendor_profile_id = p_vendor_id AND gift_type = 'plan'
     AND claim_choice IN ('start', 'now', 'after') AND plan_starts_at IS NOT NULL AND finished_at IS NULL
   FOR UPDATE;
  IF NOT FOUND THEN RETURN 'none'; END IF;

  SELECT * INTO v FROM public.vendor_profiles WHERE vendor_profile_id = p_vendor_id FOR UPDATE;
  IF NOT FOUND THEN RETURN 'none'; END IF;

  -- The shop's plan is no longer the gift's write (it bought a plan, or an admin set one): the gift is over and the
  -- plan the shop is on now is left exactly as it is.
  IF NOT (v.tier_state = g.plan_tier AND v.tier_source = 'admin_comp'
          AND v.tier_expires_at IS NOT DISTINCT FROM g.plan_ends_at) THEN
    UPDATE public.setnayan_shop_gifts SET finished_at = now(), finish_reason = 'superseded' WHERE gift_id = g.gift_id;
    RETURN 'superseded';
  END IF;

  IF p_reason = 'ended' AND v.tier_expires_at > now() THEN
    RETURN 'running';
  END IF;

  -- "Stay on <plan>": a plan the shop PAID for while on the gift, queued to start when it ends. The lapse sweep's own
  -- scheduled-plan branch applies it; the gift is simply over. (A schedule made BEFORE the gift belongs to the paused
  -- plan and comes back with it.)
  IF p_reason = 'ended' AND v.pending_tier IS NOT NULL
     AND v.pending_tier_scheduled_at IS NOT NULL AND v.pending_tier_scheduled_at >= g.plan_starts_at
     AND EXISTS (
       SELECT 1 FROM public.vendor_subscriptions s
        WHERE s.purchase_id = v.pending_tier_purchase_id AND s.vendor_id = p_vendor_id
          AND s.tier = v.pending_tier AND s.status = 'paid'
     ) THEN
    UPDATE public.setnayan_shop_gifts SET finished_at = now(), finish_reason = 'stayed' WHERE gift_id = g.gift_id;
    RETURN 'stayed';
  END IF;

  -- A hand-back is a DELIBERATE return to a lower plan — the one the shop chose to pause, or Free — which the
  -- no-silent-downgrade guard (20271115090000) asks to be said out loud. Transaction-local.
  PERFORM set_config('setnayan.allow_tier_downgrade', 'on', true);

  IF g.return_tier IS NULL THEN
    -- The shop had no plan: back to Free (or Free · Verified). Its credit is not touched — nothing is lost.
    UPDATE public.vendor_profiles
       SET tier_state = (CASE WHEN verification_state = 'verified' THEN 'verified' ELSE 'free' END)::public.vendor_tier_state,
           tier_expires_at = NULL,
           tier_billing_cycle = NULL
     WHERE vendor_profile_id = p_vendor_id;
  ELSE
    -- The paused plan, with exactly the days it had left when the gift began.
    UPDATE public.vendor_profiles
       SET tier_state         = g.return_tier,
           tier_expires_at    = CASE WHEN g.return_open_ended THEN NULL ELSE now() + COALESCE(g.return_remaining, interval '0') END,
           tier_source        = COALESCE(g.return_source, 'admin_comp'),
           tier_billing_cycle = g.return_billing_cycle
     WHERE vendor_profile_id = p_vendor_id;
  END IF;

  UPDATE public.setnayan_shop_gifts
     SET finished_at = now(), finish_reason = CASE WHEN p_reason = 'went_back' THEN 'went_back' ELSE 'ended' END
   WHERE gift_id = g.gift_id;
  RETURN 'returned';
END;
$function$;

-- ── a held gift ("Start it when my plan ends") starts once the shop's own plan is over ─────────────────────────────
CREATE OR REPLACE FUNCTION public.setnayan_plan_gift_start_held(p_vendor_id UUID)
 RETURNS BOOLEAN
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  g     public.setnayan_shop_gifts;
  v     public.vendor_profiles;
  v_end TIMESTAMPTZ;
BEGIN
  SELECT * INTO g FROM public.setnayan_shop_gifts
   WHERE vendor_profile_id = p_vendor_id AND gift_type = 'plan' AND claim_choice = 'after'
     AND plan_starts_at IS NULL AND finished_at IS NULL
   FOR UPDATE;
  IF NOT FOUND THEN RETURN FALSE; END IF;

  SELECT * INTO v FROM public.vendor_profiles WHERE vendor_profile_id = p_vendor_id FOR UPDATE;
  IF NOT FOUND THEN RETURN FALSE; END IF;
  IF v.tier_state IN ('solo', 'pro', 'enterprise') AND (v.tier_expires_at IS NULL OR v.tier_expires_at > now()) THEN
    RETURN FALSE;   -- the shop's own plan is still running
  END IF;

  v_end := now() + make_interval(days => g.plan_days);
  UPDATE public.vendor_profiles
     SET tier_state = g.plan_tier, tier_expires_at = v_end, tier_source = 'admin_comp', tier_billing_cycle = NULL
   WHERE vendor_profile_id = p_vendor_id;
  UPDATE public.setnayan_shop_gifts SET plan_starts_at = now(), plan_ends_at = v_end WHERE gift_id = g.gift_id;
  RETURN TRUE;
END;
$function$;

-- ── "Go back to <plan>" — the shop ends its running gift early ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.setnayan_plan_gift_go_back(p_gift_id UUID, p_vendor_profile_id UUID)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_res TEXT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.setnayan_shop_gifts
     WHERE gift_id = p_gift_id AND vendor_profile_id = p_vendor_profile_id AND gift_type = 'plan'
       AND plan_starts_at IS NOT NULL AND finished_at IS NULL
  ) THEN
    RETURN jsonb_build_object('status', 'not_running');
  END IF;
  v_res := public.setnayan_plan_gift_return(p_vendor_profile_id, 'went_back');
  RETURN jsonb_build_object('status', v_res);
END;
$function$;

REVOKE ALL ON FUNCTION public.setnayan_plan_gift_rank(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.setnayan_shop_gift_choices(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.setnayan_shop_gift_claim(UUID, UUID, TEXT, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.setnayan_plan_gift_return(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.setnayan_plan_gift_start_held(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.setnayan_plan_gift_go_back(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.setnayan_shop_gift_choices(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.setnayan_shop_gift_claim(UUID, UUID, TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.setnayan_plan_gift_go_back(UUID, UUID) TO service_role;

COMMENT ON FUNCTION public.setnayan_shop_gift_claim(UUID, UUID, TEXT, UUID) IS
  'The press on a Setnayan gift to a shop IS the claim (owner 2026-11-14): claimed_at is set in one conditional UPDATE '
  'only while NULL, so any repeat — double tap, retry, second tab or phone — returns {status:already} and grants '
  'nothing. Choices: stock · start · now · after · extend (setnayan_shop_gift_choices). Service-role only; the app '
  'checks the caller runs the shop.';

-- ── the shipped lapse sweep, with the two gift branches ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sweep_vendor_tier_expiry(p_vendor_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_p          public.vendor_profiles;
BEGIN
  -- ── 🎁 A SETNAYAN PLAN GIFT THAT HAS RUN ITS DAYS (20271345573127) ───────
  -- Hands the shop back the plan it paused, with the days it had left, BEFORE
  -- anything below can read the gift's end day as the shop's own term ending.
  -- 'returned' = the shop is on its own plan again (nothing more to do here).
  -- Anything else ('none' · 'running' · 'superseded' · 'stayed') falls through:
  -- a plan the shop paid for while on the gift is applied by the branch below.
  IF public.setnayan_plan_gift_return(p_vendor_id, 'ended') = 'returned' THEN
    RETURN;
  END IF;

  -- ── A SCHEDULED PLAN THAT IS NOW DUE ─────────────────────────────────────
  SELECT * INTO v_p FROM public.vendor_profiles
   WHERE vendor_profile_id = p_vendor_id
     AND pending_tier IS NOT NULL
     AND tier_expires_at IS NOT NULL
     AND tier_expires_at <= now()
   FOR UPDATE;

  IF FOUND THEN
    -- A PENDING TIER IS NOT AN ENTITLEMENT UNTIL SOMEBODY PAID FOR IT.
    IF EXISTS (
      SELECT 1 FROM public.vendor_subscriptions s
       WHERE s.purchase_id = v_p.pending_tier_purchase_id
         AND s.vendor_id   = p_vendor_id
         AND s.tier        = v_p.pending_tier
         AND s.status      = 'paid'
    ) THEN
      -- 🚨 THIS SHOP IS CONTINUING, NOT LAPSING. `subscription_credit_php` is
      -- deliberately ABSENT from this UPDATE: they are moving onto a plan they
      -- paid for, and taking their balance here would be theft dressed as
      -- policy. The RETURN below is what stops the lapse also running.
      UPDATE public.vendor_profiles
         SET tier_state         = v_p.pending_tier,
             tier_expires_at    = now()
                                  + (COALESCE(v_p.pending_tier_period_days, 28)
                                     || ' days')::interval,
             tier_billing_cycle = v_p.pending_tier_billing_cycle,
             pending_tier               = NULL,
             pending_tier_billing_cycle = NULL,
             pending_tier_period_days   = NULL,
             pending_tier_sku_code      = NULL,
             pending_tier_purchase_id   = NULL,
             pending_tier_scheduled_at  = NULL
       WHERE vendor_profile_id = p_vendor_id;

      UPDATE public.vendor_subscriptions
         SET expires_at = (SELECT tier_expires_at FROM public.vendor_profiles
                            WHERE vendor_profile_id = p_vendor_id)
       WHERE purchase_id = v_p.pending_tier_purchase_id
         AND expires_at IS NULL;

      -- ⚖ THIS `RETURN` IS BELT-AND-BRACES, AND IS KEPT ANYWAY. Measured, not
      -- assumed: a mutation deleting it stayed GREEN, because the UPDATE above
      -- has already pushed `tier_expires_at` into the FUTURE and moved the tier
      -- off the lapse's ('solo','pro','enterprise') list — so the lapse below
      -- cannot match this row by either test. Two coincidences standing between a
      -- shop and its money is not a design; this line is what makes the boundary
      -- obviously correct, and it stays correct if either of those changes.
      -- 🔑 Written down so nobody later deletes it as unreachable.
      RETURN;
    END IF;

    -- Scheduled but never paid for. Clear the schedule and fall through to the
    -- ordinary lapse — which now takes the balance too, because this shop IS
    -- going away. Otherwise stamping an intention nobody paid for would be a way
    -- to keep money alive indefinitely.
    UPDATE public.vendor_profiles
       SET pending_tier               = NULL,
           pending_tier_billing_cycle = NULL,
           pending_tier_period_days   = NULL,
           pending_tier_sku_code      = NULL,
           pending_tier_purchase_id   = NULL,
           pending_tier_scheduled_at  = NULL
     WHERE vendor_profile_id = p_vendor_id;
  END IF;

  -- ── 🎁 A HELD SETNAYAN PLAN GIFT STARTS WHEN THE SHOP'S OWN PLAN ENDS ────
  -- ("Start it when my plan ends", 20271345573127.) Runs after a PAID
  -- scheduled plan had its chance above — a shop that is continuing is not
  -- ending — and INSTEAD of the lapse: the gift's days are the shop's plan now.
  IF public.setnayan_plan_gift_start_held(p_vendor_id) THEN
    RETURN;
  END IF;

  -- ── THE LAPSE ────────────────────────────────────────────────────────────
  PERFORM 1
    FROM public.vendor_profiles
   WHERE vendor_profile_id = p_vendor_id
     AND tier_state IN ('solo', 'pro', 'enterprise')
     AND tier_expires_at IS NOT NULL
     AND tier_expires_at < now()
   FOR UPDATE;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Name the reason before the money moves. `set_config(..., true)` is
  -- transaction-local, so it cannot leak into a caller doing more work after
  -- this function returns.
  PERFORM set_config('setnayan.credit_reason', 'lapse', true);

  UPDATE public.vendor_profiles
     SET tier_state = (
           CASE WHEN verification_state = 'verified'
                THEN 'verified' ELSE 'free' END
         )::public.vendor_tier_state,
         tier_expires_at    = NULL,
         tier_billing_cycle = NULL,
         -- ⚖ OWNER 2026-08-28: the credit goes with the plan. The trigger on
         -- this column writes the ledger row; nothing here has to remember to.
         subscription_credit_php = 0
   WHERE vendor_profile_id = p_vendor_id
     AND tier_state IN ('solo', 'pro', 'enterprise')
     AND tier_expires_at IS NOT NULL
     AND tier_expires_at < now();
END;
$function$;


COMMENT ON FUNCTION public.sweep_vendor_tier_expiry(UUID) IS
  'Login-driven, cron-free. First hands a shop whose Setnayan plan gift has run its days back to the plan the gift paused, with the days it had left (setnayan_plan_gift_return, 20271345573127). Applies a PAID scheduled plan change the moment the current term runs out and RETURNS; starts a held Setnayan plan gift instead of a lapse; otherwise reverts an expired solo/pro/enterprise tier to verified/free and EXPIRES any carried credit with it (owner 2026-08-28), leaving a vendor_credit_ledger row. A scheduled plan with no paid purchase behind it is dropped, never granted. Applying a scheduled change is NOT a lapse and never touches the balance.';

COMMIT;
