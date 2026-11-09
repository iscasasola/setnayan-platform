-- specialized_tools_unlock_and_trial
-- ============================================================================
-- 🧰 BUILD 4 — SPECIALIZED TOOLS: A FREE TIER + ONE PAID UNLOCK + A FIRST-BOOKING TRIAL.
--
-- ⚖ DECISION_LOG rows dated 2026-11-09 (🧰), newest wins:
--   · "SPECIALIZED TOOLS = SOME FREE + ONE ₱499 / 4 WEEKS (₱4,990 / YEAR) UNLOCK
--     FOR ALL THE REST, CUSTOM TOOLS INCLUDED" — owner, verbatim: *"499 4 week and
--     4990 annual"*.
--   · "TOOL TRIAL = THE FIRST BOOKED EVENT, VERIFIED SUPPLIERS AND UP; THEN IT
--     LOCKS" — *"The do a booking. It locks. They need to purchase to use it for
--     their next booking."* Guards: one trial per verified BUSINESS (not per
--     account); a real client's event (host not the supplier or its team, a
--     future date, not a sample event).
--   · "BUILD 4 ANSWERS" — the unlock is Verified and up only; `vendor_photo_challenge`,
--     `vendor_3d_booth`, `vendor_3d_booth_event` RETIRE when it goes on sale, paid
--     time honoured to its end.
--   · "PRO AND ULTRA INCLUDE THE SPECIALIZED TOOLS UNLOCK" — no purchase on Pro or
--     Ultra; Verified and Solo buy it.
--
-- ── WHAT THIS FILE DOES ────────────────────────────────────────────────────
--   1 · Two catalogue rows: `vendor_specialized_tools` ₱499.00 / 4 weeks and
--       `vendor_specialized_tools_annual` ₱4,990.00 / 1 year (10× — held by
--       tests/db/a-year-is-ten-four-week-cycles.db.test.ts). Prices are typed HERE
--       ONLY; after this they are admin-managed at /admin/pricing.
--   2 · The three old add-ons retire (`is_active = FALSE`, `retired_at`,
--       `retirement_reason`, `replaced_by_sku_code`). NOTHING IS DELETED, and their
--       entitlement columns (`booth_addon_expires_at`, `papic_challenge_expires_at`)
--       and paid per-event orders keep being read by the same gates below, so a
--       window somebody already paid for runs to its end.
--   3 · `vendor_specialized_tools_access` — one row per shop: the paid unlock
--       window and the one-time trial claim. Its own table rather than more
--       `vendor_profiles` columns, so the self-grant guard trigger on that table
--       and its column-scope grants are not touched: this table has NO write
--       grant for `anon` / `authenticated` at all (service_role writes only).
--       The trial claim is the shipped `booth_addon_trial_used_at` pattern
--       (20270908863003): a one-time marker, claimed atomically with
--       `… WHERE trial_used_at IS NULL`.
--   4 · `vendor_specialized_tools_unlocked(shop, event)` — THE single answer.
--   5 · `specialized_tools_claim_trial(shop)` + an AFTER trigger on
--       `event_vendors` that calls it when a booking lands, so the trial is
--       frozen at the moment of the first booking, not whenever somebody first
--       looks.
--   6 · The two shipped gates read the unlock too:
--       `vendor_papic_challenge_entitled` (challenge authoring + photo delivery)
--       and `event_branded_booth_vendor_ids` (the branded booth in a couple's
--       3D Plan). `papic_create_vendor_challenge`'s plan floor admits `verified`.
--   7 · Usage measurement: `specialized_tool_usage` + ONE security-definer RPC
--       `record_specialized_tool_use`. Tool SHAPE and counts only — never a
--       guest, a name, a field value or anything a supplier typed.
--
-- ── THE FREE TIER IS NOT IN THIS FILE, ON PURPOSE ─────────────────────────
-- Scanner · Headcount · Run of show · Emcee script · Song Desk · Floor Command +
-- March · Live Watch need no purchase. Nothing here gates them: no function in
-- this file is called by any of them. apps/web/lib/specialized-tools-free-tier.test.ts
-- holds that.
--
-- 🛑 NEVER APPLIED BY HAND. The pipeline pushes this file (CLAUDE.md).
-- Idempotent: IF NOT EXISTS / CREATE OR REPLACE / ON CONFLICT / DROP … IF EXISTS.
-- ============================================================================

BEGIN;

-- ── 1 · THE TWO ROWS ────────────────────────────────────────────────────────
-- display_order 84 / 87 sit among the add-ons (AI 82 · challenge 83 · booth 85 ·
-- booth per event 86 · entry rows 88/89). price_php is NOT overwritten on
-- conflict — once the row exists its price is the admin's.
INSERT INTO public.vendor_billing_catalog
  (sku_code, title, price_php, offering_type, token_grant_count, max_categories,
   max_sub_seats, display_order, is_active, description)
VALUES
  ('vendor_specialized_tools', 'Specialized tools (4 weeks)', 499.00,
   'vendor_addon_recurring', NULL, NULL, NULL, 84, TRUE,
   'Unlocks every paid specialized tool for 4 weeks: Papic challenge, 3D plan, and every new Setnayan tool. Verified and up. Included in Pro and Ultra.'),
  ('vendor_specialized_tools_annual', 'Specialized tools (1 year)', 4990.00,
   'vendor_addon_recurring', NULL, NULL, NULL, 87, TRUE,
   'Unlocks every paid specialized tool for 1 year: Papic challenge, 3D plan, and every new Setnayan tool. Verified and up. Included in Pro and Ultra.')
ON CONFLICT (sku_code) DO UPDATE SET
  title             = EXCLUDED.title,
  offering_type     = EXCLUDED.offering_type,
  token_grant_count = EXCLUDED.token_grant_count,
  max_categories    = EXCLUDED.max_categories,
  max_sub_seats     = EXCLUDED.max_sub_seats,
  display_order     = EXCLUDED.display_order,
  description       = EXCLUDED.description,
  updated_at        = NOW();
  -- price_php and is_active intentionally NOT overwritten on conflict (admin-managed).

-- ── 2 · THE THREE OLD ADD-ONS RETIRE (never deleted) ───────────────────────
-- COALESCE everywhere so a re-apply never moves an existing stamp, and an admin
-- who already wrote a reason keeps it.
UPDATE public.vendor_billing_catalog
   SET is_active            = FALSE,
       retired_at           = COALESCE(retired_at, NOW()),
       retirement_reason    = COALESCE(retirement_reason,
         'Owner 2026-11-09 (BUILD 4 ANSWERS): retired into Specialized tools (₱499 / 4 weeks · ₱4,990 / year). Time already paid for is honoured to its end.'),
       replaced_by_sku_code = COALESCE(replaced_by_sku_code, 'vendor_specialized_tools'),
       updated_at           = NOW()
 WHERE sku_code IN ('vendor_photo_challenge', 'vendor_3d_booth', 'vendor_3d_booth_event');

-- ── 3 · ONE ROW PER SHOP: THE PAID WINDOW + THE ONE-TIME TRIAL ─────────────
CREATE TABLE IF NOT EXISTS public.vendor_specialized_tools_access (
  vendor_profile_id     UUID PRIMARY KEY
                          REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  unlock_expires_at     TIMESTAMPTZ,
  trial_used_at         TIMESTAMPTZ,
  trial_event_id        UUID REFERENCES public.events(event_id) ON DELETE SET NULL,
  trial_event_vendor_id UUID REFERENCES public.event_vendors(vendor_id) ON DELETE SET NULL,
  trial_ends_at         TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- A claimed trial always knows when it ends; an unclaimed one carries nothing.
  CONSTRAINT vendor_specialized_tools_access_trial_shape CHECK (
    (trial_used_at IS NULL AND trial_ends_at IS NULL AND trial_event_id IS NULL AND trial_event_vendor_id IS NULL)
    OR (trial_used_at IS NOT NULL AND trial_ends_at IS NOT NULL)
  )
);
ALTER TABLE public.vendor_specialized_tools_access ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.vendor_specialized_tools_access IS
  'Specialized tools (owner 2026-11-09, Build 4): one row per shop. unlock_expires_at = the paid ₱499 / 4-week or ₱4,990 / year window (stamped by the sku-activation hook on approval, stacking). trial_* = the ONE-TIME first-booked-event trial (claimed atomically by specialized_tools_claim_trial, the booth_addon_trial_used_at pattern). service_role only — no anon/authenticated grant of any kind. Read through vendor_specialized_tools_unlocked().';
COMMENT ON COLUMN public.vendor_specialized_tools_access.unlock_expires_at IS
  'End of the paid Specialized tools window. Live while now() < this. NULL = never bought. Lapse is automatic at read time — no cron.';
COMMENT ON COLUMN public.vendor_specialized_tools_access.trial_used_at IS
  'When the one-time trial was claimed. NULL = still available. Once set it is never cleared (a deleted event leaves it set: the trial was spent). One per BUSINESS: specialized_tools_claim_trial refuses when a matched shop (booking_fee_business_matches) already holds one.';
COMMENT ON COLUMN public.vendor_specialized_tools_access.trial_ends_at IS
  'The end of the trial event''s last day (Asia/Manila). Every paid tool is unlocked on trial_event_id only, while now() < this. Then it locks.';

CREATE INDEX IF NOT EXISTS vendor_specialized_tools_access_trial_event_idx
  ON public.vendor_specialized_tools_access (trial_event_id)
  WHERE trial_event_id IS NOT NULL;

-- RLS on, NO policy and NO grant for anon / authenticated: service_role only.
-- Nothing needs a signed-in session to read this row — every reader is the
-- server (`fetchVendorSpecializedToolsUnlocked` with the admin client, the two
-- SQL gates as SECURITY DEFINER). A shop that wants to SEE its trial is drawn
-- by the server, the same way. (Narrowest shape: exposure-freeze.db.test.ts.)
REVOKE ALL ON public.vendor_specialized_tools_access FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.vendor_specialized_tools_access TO service_role;

-- ── 4 · THE ONE ANSWER ─────────────────────────────────────────────────────
-- May this shop use the PAID specialized tools at this event? Three ways in:
--   (a) a live paid window — a VERIFIED shop on Verified, Solo, Pro or Ultra;
--   (b) a live Pro or Ultra plan — the plan includes the unlock (owner 2026-11-09);
--   (c) the one-time trial, on its own event only, until that event ends — a
--       VERIFIED shop on Verified and up.
-- `custom` is not on any list: the plan retired 2026-11-06 and every reader
-- (TS `asVendorTier`, SQL `vendor_tier_limit`) treats it as Free.
-- A paid plan whose tier_expires_at has passed does not count (the same explicit
-- check `subscriptionClearsSpecializationFloor` makes — the tier sweep is
-- login-driven, so a lapsed shop can still carry a paid tier_state).
-- Mirror: `specializedToolsUnlockFrom` in apps/web/lib/specialized-tools-access.ts.
CREATE OR REPLACE FUNCTION public.vendor_specialized_tools_unlocked(
  p_vendor_profile_id UUID,
  p_event_id          UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE((
    SELECT
      -- (b) Pro and Ultra include it.
      (vp.tier_state::TEXT IN ('pro', 'enterprise')
         AND (vp.tier_expires_at IS NULL OR vp.tier_expires_at > NOW()))
      OR (
        vp.verification_state::TEXT = 'verified'
        AND vp.tier_state::TEXT IN ('verified', 'solo', 'pro', 'enterprise')
        AND (
          -- (a) a live paid window.
          (a.unlock_expires_at IS NOT NULL AND a.unlock_expires_at > NOW())
          -- (c) the trial, on its event, until it ends.
          OR (p_event_id IS NOT NULL
              AND a.trial_event_id = p_event_id
              AND a.trial_ends_at IS NOT NULL
              AND a.trial_ends_at > NOW())
        )
      )
    FROM public.vendor_profiles vp
    LEFT JOIN public.vendor_specialized_tools_access a
      ON a.vendor_profile_id = vp.vendor_profile_id
    WHERE vp.vendor_profile_id = p_vendor_profile_id
  ), FALSE);
$$;

COMMENT ON FUNCTION public.vendor_specialized_tools_unlocked(UUID, UUID) IS
  'May this shop use the PAID specialized tools (Papic challenge, 3D plan branding, every future tool) at this event? TRUE for (a) a live paid Specialized tools window on a verified Verified-and-up shop, (b) a live Pro or Ultra plan (included, owner 2026-11-09), or (c) the one-time first-booked-event trial on THAT event until it ends. The FREE tools never call this. Mirror: specializedToolsUnlockFrom (apps/web/lib/specialized-tools-access.ts). service_role only; the SECURITY DEFINER gates that call it run as the owner.';

REVOKE ALL ON FUNCTION public.vendor_specialized_tools_unlocked(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vendor_specialized_tools_unlocked(UUID, UUID) TO service_role;

-- ── 5 · THE TRIAL CLAIM (one per business, fail closed) ─────────────────────
-- Returns jsonb {status, event_id?, ends_at?}:
--   claimed         — this shop holds the trial (just now, or frozen earlier)
--   not_eligible    — not a verified shop on Verified and up
--   used_by_business — another shop of the same business already took it
--   no_booking      — no qualifying booking yet (nothing is written; a later one can claim)
--   unreadable      — something could not be read; NOTHING is granted
--
-- THE QUALIFYING BOOKING (the guards the owner accepted):
--   · a real booking of THIS shop: status booked, not archived, not voided for
--     fraud, not a 'covered' row inside a package (its anchor is the booking);
--   · a real client: the event has a couple member who is NOT the shop's owner or
--     anyone on its team, and NO couple member who is;
--   · not a sample event (`events.is_sample`);
--   · a FUTURE date: the event's last day is after the day it was booked — or,
--     for a booking made before this went on sale, after the launch day (the
--     Specialized tools row's created_at). So a booking that existed before Build 4
--     for an event still to come counts as the first; one for an event already
--     over does not.
-- The FIRST one = the earliest booked (lock_agreed_at, else the row's created_at).
-- Its end may already have passed when the claim runs; it is frozen anyway — the
-- trial was that event, and it is over.
CREATE OR REPLACE FUNCTION public.specialized_tools_claim_trial(p_vendor_profile_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_vp       RECORD;
  v_existing RECORD;
  v_launch   TIMESTAMPTZ;
  v_lock_id  UUID;
  v_pick     RECORD;
  v_claimed  RECORD;
BEGIN
  IF p_vendor_profile_id IS NULL THEN
    RETURN jsonb_build_object('status', 'unreadable');
  END IF;

  SELECT vp.vendor_profile_id, vp.user_id,
         vp.verification_state::TEXT AS verification,
         vp.tier_state::TEXT AS tier,
         COALESCE(vp.is_demo, FALSE) AS is_demo
    INTO v_vp
    FROM public.vendor_profiles vp
   WHERE vp.vendor_profile_id = p_vendor_profile_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'unreadable');
  END IF;

  -- Already claimed → the frozen answer, whatever has changed since.
  SELECT a.trial_used_at, a.trial_event_id, a.trial_ends_at INTO v_existing
    FROM public.vendor_specialized_tools_access a
   WHERE a.vendor_profile_id = p_vendor_profile_id;
  IF FOUND AND v_existing.trial_used_at IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'claimed',
                              'event_id', v_existing.trial_event_id,
                              'ends_at', v_existing.trial_ends_at);
  END IF;

  -- Verified and up only — and never a demo shop.
  IF v_vp.is_demo
     OR v_vp.verification IS DISTINCT FROM 'verified'
     OR v_vp.tier NOT IN ('verified', 'solo', 'pro', 'enterprise') THEN
    RETURN jsonb_build_object('status', 'not_eligible');
  END IF;

  SELECT c.created_at INTO v_launch
    FROM public.vendor_billing_catalog c
   WHERE c.sku_code = 'vendor_specialized_tools';
  IF v_launch IS NULL THEN
    RETURN jsonb_build_object('status', 'unreadable');
  END IF;

  -- One lock per shop of the BUSINESS, in uuid order — the precedent in
  -- booking_fee_open_lock_charge (20271319712279): the match is symmetric, so two
  -- matched shops claiming at once take the same locks in the same order and
  -- cannot both read "nobody has it".
  BEGIN
    FOR v_lock_id IN
      SELECT s.id FROM (
        SELECT p_vendor_profile_id AS id
        UNION
        SELECT m.other_vendor_profile_id
          FROM public.booking_fee_business_matches(ARRAY[p_vendor_profile_id]) m
      ) s
      ORDER BY s.id
    LOOP
      PERFORM pg_advisory_xact_lock(hashtextextended('specialized_tools_trial:' || v_lock_id::TEXT, 0));
    END LOOP;

    -- ONE PER BUSINESS: a matched shop (same registration number, phone or payout
    -- account) that already claimed it spends it for every shop of the business.
    IF EXISTS (
      SELECT 1
        FROM public.booking_fee_business_matches(ARRAY[p_vendor_profile_id]) m
        JOIN public.vendor_specialized_tools_access a
          ON a.vendor_profile_id = m.other_vendor_profile_id
       WHERE a.trial_used_at IS NOT NULL
    ) THEN
      RETURN jsonb_build_object('status', 'used_by_business');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- 🔒 FAIL CLOSED. A match that could not run is never "nobody matched".
    RETURN jsonb_build_object('status', 'unreadable');
  END;

  SELECT ev.vendor_id AS event_vendor_id,
         ev.event_id,
         ((COALESCE(e.event_end_date, e.event_date) + 1)::TIMESTAMP AT TIME ZONE 'Asia/Manila') AS ends_at
    INTO v_pick
    FROM public.event_vendors ev
    JOIN public.events e ON e.event_id = ev.event_id
   WHERE ev.marketplace_vendor_id = p_vendor_profile_id
     AND ev.status::TEXT IN ('contracted', 'deposit_paid', 'delivered', 'complete')
     AND ev.archived_at IS NULL
     AND ev.voided_by_fraud IS NOT TRUE
     AND ev.package_role IS DISTINCT FROM 'covered'
     AND NOT COALESCE(e.is_sample, FALSE)
     AND e.event_date IS NOT NULL
     -- a future date, at the moment it was booked (or at launch, if booked before)
     AND COALESCE(e.event_end_date, e.event_date)
           > (GREATEST(COALESCE(ev.lock_agreed_at, ev.created_at), v_launch) AT TIME ZONE 'Asia/Manila')::DATE
     -- a real client: somebody who is not the shop hosts it …
     AND EXISTS (
       SELECT 1 FROM public.event_members em
        WHERE em.event_id = ev.event_id
          AND em.member_type = 'couple'
          AND em.user_id IS NOT NULL
          AND em.user_id IS DISTINCT FROM v_vp.user_id
          AND NOT EXISTS (SELECT 1 FROM public.vendor_team_members vtm
                           WHERE vtm.vendor_profile_id = p_vendor_profile_id
                             AND vtm.user_id = em.user_id))
     -- … and nobody who is the shop does.
     AND NOT EXISTS (
       SELECT 1 FROM public.event_members em
        WHERE em.event_id = ev.event_id
          AND em.member_type = 'couple'
          AND em.user_id IS NOT NULL
          AND (em.user_id = v_vp.user_id
               OR EXISTS (SELECT 1 FROM public.vendor_team_members vtm
                           WHERE vtm.vendor_profile_id = p_vendor_profile_id
                             AND vtm.user_id = em.user_id)))
   ORDER BY COALESCE(ev.lock_agreed_at, ev.created_at), ev.vendor_id
   LIMIT 1;

  IF v_pick.event_id IS NULL THEN
    RETURN jsonb_build_object('status', 'no_booking');
  END IF;

  -- The atomic one-time claim (the booth_addon_trial_used_at pattern): only a row
  -- whose trial_used_at is still NULL takes it.
  INSERT INTO public.vendor_specialized_tools_access AS a
    (vendor_profile_id, trial_used_at, trial_event_id, trial_event_vendor_id, trial_ends_at)
  VALUES
    (p_vendor_profile_id, NOW(), v_pick.event_id, v_pick.event_vendor_id, v_pick.ends_at)
  ON CONFLICT (vendor_profile_id) DO UPDATE
     SET trial_used_at         = EXCLUDED.trial_used_at,
         trial_event_id        = EXCLUDED.trial_event_id,
         trial_event_vendor_id = EXCLUDED.trial_event_vendor_id,
         trial_ends_at         = EXCLUDED.trial_ends_at,
         updated_at            = NOW()
   WHERE a.trial_used_at IS NULL;

  SELECT a.trial_event_id, a.trial_ends_at INTO v_claimed
    FROM public.vendor_specialized_tools_access a
   WHERE a.vendor_profile_id = p_vendor_profile_id;
  RETURN jsonb_build_object('status', 'claimed',
                            'event_id', v_claimed.trial_event_id,
                            'ends_at', v_claimed.trial_ends_at);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('status', 'unreadable');
END;
$function$;

COMMENT ON FUNCTION public.specialized_tools_claim_trial(UUID) IS
  'Claim (or read back) the shop''s ONE-TIME Specialized tools trial: every paid tool on its FIRST booked real-client event until that event ends (owner 2026-11-09). Verified and up; one per BUSINESS via booking_fee_business_matches; host not the shop or its team; a future date at booking; not is_sample. Fails closed (unreadable = nothing granted). Called by the event_vendors booking trigger and by the server (lib/specialized-tools-access.server.ts). service_role only.';

REVOKE ALL ON FUNCTION public.specialized_tools_claim_trial(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.specialized_tools_claim_trial(UUID) TO service_role;

-- The booking moment. AFTER, never BEFORE, and every error swallowed: a trial
-- claim must never be able to stop a booking from landing.
CREATE OR REPLACE FUNCTION public.specialized_tools_trial_on_booking()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.marketplace_vendor_id IS NOT NULL
     AND NEW.status::TEXT IN ('contracted', 'deposit_paid', 'delivered', 'complete')
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status)
     AND NOT EXISTS (SELECT 1 FROM public.vendor_specialized_tools_access a
                      WHERE a.vendor_profile_id = NEW.marketplace_vendor_id
                        AND a.trial_used_at IS NOT NULL) THEN
    BEGIN
      PERFORM public.specialized_tools_claim_trial(NEW.marketplace_vendor_id);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;
  RETURN NULL;
END;
$function$;

REVOKE ALL ON FUNCTION public.specialized_tools_trial_on_booking() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS specialized_tools_trial_on_booking ON public.event_vendors;
CREATE TRIGGER specialized_tools_trial_on_booking
  AFTER INSERT OR UPDATE OF status ON public.event_vendors
  FOR EACH ROW EXECUTE FUNCTION public.specialized_tools_trial_on_booking();

-- ── 6a · PAPIC CHALLENGE: the old window OR the unlock ─────────────────────
-- Body from 20271182071895 (the only later definer), with ONE arm added. The
-- signature is unchanged (both callers' grants survive); `p_event_id`, accepted
-- and ignored since 2026-08-29, is now read — the trial is per event.
CREATE OR REPLACE FUNCTION public.vendor_papic_challenge_entitled(
  p_vendor_profile_id UUID,
  p_event_id          UUID
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  -- (1) a live legacy 28-day subscription — retired 2026-11-09, but time already
  --     paid for runs to its end;
  SELECT EXISTS (
    SELECT 1 FROM public.vendor_profiles vp
     WHERE vp.vendor_profile_id = p_vendor_profile_id
       AND vp.papic_challenge_expires_at IS NOT NULL
       AND vp.papic_challenge_expires_at > NOW()
  )
  -- (2) ⟵ NEW (owner 2026-11-09): the Specialized tools unlock — paid, Pro/Ultra,
  --     or the first-booked-event trial on THIS event.
  OR public.vendor_specialized_tools_unlocked(p_vendor_profile_id, p_event_id);
$$;

COMMENT ON FUNCTION public.vendor_papic_challenge_entitled(UUID, UUID) IS
  'May this shop run a Papic Challenge at this event? TRUE for a live legacy 28-day subscription (vendor_profiles.papic_challenge_expires_at — the SKU retired 2026-11-09, paid time honoured to its end) OR the Specialized tools unlock (vendor_specialized_tools_unlocked: paid, Pro/Ultra, or the first-booked-event trial on p_event_id). THE SINGLE definition — called by papic_create_vendor_challenge (authoring) and papic_vendor_challenge_photos (delivery). If you replace either caller, keep the call.';

-- ── 6b · PAPIC CHALLENGE AUTHORING: the plan floor admits Verified ─────────
-- Body from 20271183197819 (the latest definer). ONE change: `verified` joins the
-- floor. That migration's own header named this exact spot: "if a verified free
-- shop should be admitted, those are the two places to change" — the owner ruled
-- it on 2026-11-09 (Verified and up). The entitlement call below is UNCHANGED,
-- so a Verified shop still needs the unlock (or its trial) to author anything.
-- `custom` is kept as it was (the plan is retired; no shop holds it to lose).
CREATE OR REPLACE FUNCTION public.papic_create_vendor_challenge(
  p_event_id UUID,
  p_prompt   TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_ids       UUID[];
  v_event_vendor_id   UUID;
  v_vendor_profile_id UUID;
  v_tier              public.vendor_tier_state;
  v_prompt            TEXT;
  v_mission_id        UUID;
BEGIN
  -- Normalize + bound the copy to the papic_missions length(prompt) 1..280 CHECK.
  v_prompt := btrim(coalesce(p_prompt, ''));
  IF length(v_prompt) = 0 THEN
    RAISE EXCEPTION 'prompt is required';
  END IF;
  IF length(v_prompt) > 280 THEN
    RAISE EXCEPTION 'prompt must be 280 characters or fewer';
  END IF;

  -- The caller's vendor identity (owner + admin team members).
  SELECT array_agg(v) INTO v_profile_ids FROM public.current_vendor_profile_ids() AS v;
  IF v_profile_ids IS NULL OR array_length(v_profile_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'not a vendor';
  END IF;

  -- BOOKED-only: the caller must own a booked event_vendors row for this event.
  SELECT ev.vendor_id, vp.vendor_profile_id, vp.tier_state
    INTO v_event_vendor_id, v_vendor_profile_id, v_tier
  FROM public.event_vendors ev
  JOIN public.vendor_profiles vp ON vp.vendor_profile_id = ev.marketplace_vendor_id
  WHERE ev.event_id = p_event_id
    AND ev.marketplace_vendor_id = ANY(v_profile_ids)
    AND ev.status IN ('contracted', 'deposit_paid', 'delivered', 'complete')
  ORDER BY ev.created_at
  LIMIT 1;
  IF v_event_vendor_id IS NULL THEN
    RAISE EXCEPTION 'not booked for this event';
  END IF;

  -- PLAN FLOOR, UNCONDITIONAL. ⟵ CHANGED (owner 2026-11-09): Verified and up —
  -- the Specialized tools unlock is sold to Verified, and a floor above the buyer
  -- would take their money and refuse them.
  IF v_tier IS NULL OR v_tier NOT IN ('verified', 'solo', 'pro', 'enterprise', 'custom') THEN
    RAISE EXCEPTION 'Papic Challenges comes with Specialized tools (Verified and up)';
  END IF;

  -- PAID gate: the legacy subscription OR the Specialized tools unlock — both
  -- through vendor_papic_challenge_entitled(). Do not remove this call.
  IF NOT public.vendor_papic_challenge_entitled(v_vendor_profile_id, p_event_id) THEN
    RAISE EXCEPTION 'PAPIC_CHALLENGE_NOT_SUBSCRIBED: unlock Specialized tools for your shop first';
  END IF;

  INSERT INTO public.papic_missions
    (event_id, mission_type, source, vendor_id, prompt, approved, is_active)
  VALUES
    (p_event_id, 'vendor_booth', 'vendor', v_event_vendor_id, v_prompt, false, true)
  RETURNING mission_id INTO v_mission_id;

  RETURN v_mission_id;
END;
$$;

COMMENT ON FUNCTION public.papic_create_vendor_challenge(UUID, TEXT) IS
  'Papic Games §3.4/§3.6: a BOOKED vendor on Verified and up (owner 2026-11-09; was Solo+ from 2026-08-29) whose shop is entitled — a live legacy Papic Challenges window or the Specialized tools unlock, both through vendor_papic_challenge_entitled() — authors a custom challenge (approved=false until the couple approves). SECURITY DEFINER. ⚠ The plan floor is unconditional and must not ride a price switch. ⚠ If you replace this function, keep the entitlement call — it was silently deleted once by a CREATE OR REPLACE that rebased on an older body.';

-- ── 6c · THE BRANDED BOOTH: per-event orders OR the unlock at this event ───
-- Body from 20271205905484 (the only definer), with ONE arm added and ONE latent fault fixed (marked below): the shops
-- booked on this event that hold the Specialized tools unlock HERE. The legacy
-- 28-day window (booth_addon_expires_at) is still read by lib/seating.ts beside
-- this, so a paid cycle runs to its end.
CREATE OR REPLACE FUNCTION public.event_branded_booth_vendor_ids(p_event_id UUID)
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT x.vendor_profile_id FROM (
    SELECT o.vendor_profile_id
    FROM public.orders o
    WHERE o.event_id = p_event_id
      AND o.service_key = 'vendor_3d_booth_event'
      AND o.status IN ('paid', 'fulfilled')
      AND o.vendor_profile_id IS NOT NULL
    UNION
    -- ⟵ NEW (owner 2026-11-09): Specialized tools — paid, Pro/Ultra, or the trial on this event.
    SELECT ev.marketplace_vendor_id
    FROM public.event_vendors ev
    WHERE ev.event_id = p_event_id
      AND ev.marketplace_vendor_id IS NOT NULL
      AND ev.status IN ('contracted', 'deposit_paid', 'delivered', 'complete')
      AND ev.archived_at IS NULL
      AND public.vendor_specialized_tools_unlocked(ev.marketplace_vendor_id, p_event_id)
  ) x
  WHERE (
      public.is_admin()
      OR p_event_id IN (SELECT public.current_event_ids())
      -- ⟵ FIXED: was `current_user = 'service_role'`, which can NEVER be true here — inside a SECURITY
      -- DEFINER function current_user is the function's OWNER (measured in the replay: 'postgres'). The only
      -- caller is the service-role server read (lib/seating.ts fetchBooths), which therefore got an empty set
      -- since 20271205905484: a paid per-event booth never branded. auth.role() reads the caller's JWT role.
      OR auth.role() = 'service_role'
    );
$$;

COMMENT ON FUNCTION public.event_branded_booth_vendor_ids(UUID) IS
  'Which vendors brand their 3D booth at this event beyond the legacy 28-day window: a PAID per-event 3D Booth order (orders.service_key = vendor_3d_booth_event, retired 2026-11-09, paid orders honoured) OR a booked shop holding the Specialized tools unlock at this event (vendor_specialized_tools_unlocked). The other half of lib/seating-3d boothIsBranded is vendor_profiles.booth_addon_expires_at. service_role ONLY — read server-side by lib/seating.ts fetchBooths via its brandedReader. Ids only — never amounts.';

REVOKE ALL ON FUNCTION public.event_branded_booth_vendor_ids(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.event_branded_booth_vendor_ids(UUID) TO service_role;

-- ── 7 · USAGE: TOOL SHAPE AND COUNTS, NEVER ENTERED DATA ───────────────────
-- Owner 2026-11-09: *"can we get information if they keep using the tool, we sell
-- something similar to it?"* + "usage of a tool's shape (never guest data) is
-- measured". One row per (shop, event, tool shape); two counters.
--
-- 🔒 WHY NOTHING ENTERED CAN LAND HERE: the tool key is a CLOSED list (a new tool
-- adds its key in its own migration), and template / scanner mode / category are
-- short lower-case keys (`^[a-z][a-z0-9_]{0,31}$`) — no spaces, no capitals, no
-- digits-first, no punctuation, so no name, phone, sentence or id fits. There is
-- no free-text column and no guest or person reference of any kind.
CREATE TABLE IF NOT EXISTS public.specialized_tool_usage (
  usage_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_profile_id UUID NOT NULL REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  event_id          UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  tool_key          TEXT NOT NULL,
  template_key      TEXT NOT NULL DEFAULT '',
  scanner_mode      TEXT NOT NULL DEFAULT '',
  category          TEXT NOT NULL DEFAULT '',
  opens             INTEGER NOT NULL DEFAULT 0 CHECK (opens >= 0),
  scans             INTEGER NOT NULL DEFAULT 0 CHECK (scans >= 0),
  first_used_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT specialized_tool_usage_tool_key_known CHECK (tool_key IN (
    -- the free tier (owner 2026-11-09, "The six" + the Scanner)
    'scanner', 'headcount', 'run_of_show', 'emcee_script', 'song_desk',
    'floor_command', 'march', 'live_watch',
    -- the paid tools
    'papic_challenge', '3d_plan',
    -- a tool the shop made itself (Tools Maker, Thu 12 Nov) — its template says which shape
    'custom'
  )),
  CONSTRAINT specialized_tool_usage_template_shape CHECK (template_key ~ '^([a-z][a-z0-9_]{0,31})?$'),
  CONSTRAINT specialized_tool_usage_scanner_mode_shape CHECK (scanner_mode ~ '^([a-z][a-z0-9_]{0,31})?$'),
  CONSTRAINT specialized_tool_usage_category_shape CHECK (category ~ '^([a-z][a-z0-9_]{0,31})?$'),
  CONSTRAINT specialized_tool_usage_one_shape UNIQUE
    (vendor_profile_id, event_id, tool_key, template_key, scanner_mode, category)
);
ALTER TABLE public.specialized_tool_usage ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.specialized_tool_usage IS
  'How much each specialized tool is used, by SHAPE only (owner 2026-11-09): tool key (closed list), template, scanner mode, category, and open/scan counts per shop per event. NEVER guest data, names, field values or anything a supplier typed — the shape CHECKs make free text unstorable. Written only by record_specialized_tool_use(); read with the service role (admin). No anon/authenticated grant.';

CREATE INDEX IF NOT EXISTS specialized_tool_usage_tool_idx
  ON public.specialized_tool_usage (tool_key, template_key);
CREATE INDEX IF NOT EXISTS specialized_tool_usage_event_idx
  ON public.specialized_tool_usage (event_id);

-- RLS on, NO policy and NO grant for anon / authenticated: the only way in is
-- the RPC below, and the only reader is the admin console (service role).
REVOKE ALL ON public.specialized_tool_usage FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.specialized_tool_usage TO service_role;

-- THE ONE RPC. The caller must be the owner or a team member of a shop BOOKED on
-- this event; the shop is derived from the session, never passed in, so nobody
-- can count against another shop. Returns FALSE (and counts nothing) when the
-- caller is not such a shop — a tool must never break because measurement
-- refused it. A shape that does not fit RAISES, so a caller that tries to send
-- entered data finds out in development.
CREATE OR REPLACE FUNCTION public.record_specialized_tool_use(
  p_event_id     UUID,
  p_tool_key     TEXT,
  p_kind         TEXT DEFAULT 'open',
  p_template_key TEXT DEFAULT NULL,
  p_scanner_mode TEXT DEFAULT NULL,
  p_category     TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid      UUID := auth.uid();
  v_vpid     UUID;
  v_template TEXT := COALESCE(p_template_key, '');
  v_mode     TEXT := COALESCE(p_scanner_mode, '');
  v_category TEXT := COALESCE(p_category, '');
BEGIN
  IF p_kind IS NULL OR p_kind NOT IN ('open', 'scan') THEN
    RAISE EXCEPTION 'record_specialized_tool_use: kind must be open or scan'
      USING ERRCODE = 'check_violation';
  END IF;
  IF v_template !~ '^([a-z][a-z0-9_]{0,31})?$'
     OR v_mode !~ '^([a-z][a-z0-9_]{0,31})?$'
     OR v_category !~ '^([a-z][a-z0-9_]{0,31})?$' THEN
    RAISE EXCEPTION 'record_specialized_tool_use: shape keys only — never entered data'
      USING ERRCODE = 'check_violation';
  END IF;
  IF p_event_id IS NULL OR v_uid IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT ev.marketplace_vendor_id INTO v_vpid
    FROM public.event_vendors ev
   WHERE ev.event_id = p_event_id
     AND ev.marketplace_vendor_id IS NOT NULL
     AND ev.status::TEXT IN ('contracted', 'deposit_paid', 'delivered', 'complete')
     AND ev.archived_at IS NULL
     AND (
       EXISTS (SELECT 1 FROM public.vendor_profiles vp
                WHERE vp.vendor_profile_id = ev.marketplace_vendor_id AND vp.user_id = v_uid)
       OR EXISTS (SELECT 1 FROM public.vendor_team_members vtm
                   WHERE vtm.vendor_profile_id = ev.marketplace_vendor_id
                     AND vtm.user_id = v_uid
                     AND vtm.deactivated_at IS NULL)
     )
   ORDER BY ev.created_at
   LIMIT 1;
  IF v_vpid IS NULL THEN
    RETURN FALSE;
  END IF;

  -- The tool key's CHECK raises on an unknown key — the same "find out in
  -- development" rule as the shape keys above.
  INSERT INTO public.specialized_tool_usage AS u
    (vendor_profile_id, event_id, tool_key, template_key, scanner_mode, category, opens, scans)
  VALUES
    (v_vpid, p_event_id, p_tool_key, v_template, v_mode, v_category,
     CASE WHEN p_kind = 'open' THEN 1 ELSE 0 END,
     CASE WHEN p_kind = 'scan' THEN 1 ELSE 0 END)
  ON CONFLICT (vendor_profile_id, event_id, tool_key, template_key, scanner_mode, category) DO UPDATE
     SET opens        = u.opens + EXCLUDED.opens,
         scans        = u.scans + EXCLUDED.scans,
         last_used_at = NOW();
  RETURN TRUE;
END;
$function$;

COMMENT ON FUNCTION public.record_specialized_tool_use(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) IS
  'Count one open or one scan of a specialized tool, by SHAPE only (tool key · template · scanner mode · category), for the caller''s shop booked on this event. The shop comes from the session (owner or active team member), never a parameter. FALSE = not counted (not a booked shop). Raises on a key that is not a shape key, so entered data cannot be sent. Owner 2026-11-09.';

REVOKE ALL ON FUNCTION public.record_specialized_tool_use(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_specialized_tool_use(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;

COMMIT;

-- ============================================================================
-- VERIFICATION (read-only, after the pipeline applies it):
--
-- SELECT sku_code, price_php, offering_type, is_active, replaced_by_sku_code
--   FROM vendor_billing_catalog
--  WHERE sku_code IN ('vendor_specialized_tools','vendor_specialized_tools_annual',
--                     'vendor_photo_challenge','vendor_3d_booth','vendor_3d_booth_event');
-- -- Expected: the two new rows on sale at 499.00 / 4990.00; the three old ones
-- --           is_active = false, replaced_by_sku_code = vendor_specialized_tools.
--
-- SELECT to_regclass('public.vendor_specialized_tools_access'),
--        to_regclass('public.specialized_tool_usage');
-- ============================================================================
