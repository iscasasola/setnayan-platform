-- the_challenge_is_a_subscription
-- ============================================================================
-- OWNER 2026-08-28, verbatim: **"unlimited us 2500 for 4 weeks."**
--
-- Papic Challenges stops being ₱400 PER EVENT and becomes **₱2,500 per 28 days,
-- unlimited, across every celebration the shop is booked for.** Four weeks is
-- 28 days exactly, which is the cadence every other vendor add-on already bills
-- on — so this needs NO new renewal arithmetic. It reuses the shape the Vendor
-- AI add-on has used since 2026-07-22: an expiry timestamp on the shop's own
-- row, evaluated at READ time (this project is cron-free; nothing sweeps a
-- lapse, and nothing needs to).
--
-- ┌───────────────────────────────────────────────────────────────────────────┐
-- │ 🚨 THE PAYWALL ON AUTHORING A CHALLENGE HAS BEEN OPEN IN PRODUCTION.      │
-- └───────────────────────────────────────────────────────────────────────────┘
-- Read out of prod BY THE OBJECT (`pg_get_functiondef`, not from a migration
-- file and not from a comment): the LIVE `papic_create_vendor_challenge` has
-- **no sponsorship check of any kind**. 20270907628470 added one; four weeks
-- later 20271001130000 replaced the function to make the TIER gate conditional
-- and rebased its body on 20270906348207 — a migration whose prefix is LOWER
-- than the one that had added the paywall. Its own header says the body is
-- *"otherwise identical"* to that older migration. It was, and that is the bug:
-- **a CREATE OR REPLACE that copies an older body forward silently reverts
-- every guard added in between.** Nothing threw, no test covered it, and the
-- delivery half (`papic_vendor_challenge_photos`) kept its gate — so the paid
-- product half-worked and looked fine.
--
-- Inert today: prod holds 0 vendor missions, 0 mission completions, 0
-- sponsorships and 0 challenge orders, ever. It is repaired HERE rather than in
-- its own PR because the repair and the new entitlement are the same line of
-- code — restoring the old per-event check only to replace it an hour later
-- would be two changes to one gate.
--
-- 🔑 AND IT IS REPAIRED SO IT CANNOT HAPPEN AGAIN THE SAME WAY: the question
-- *"is this shop entitled to run a challenge on this event?"* now lives in ONE
-- function, `vendor_papic_challenge_entitled()`, called by the authoring RPC
-- AND by the photo-delivery RPC. A future CREATE OR REPLACE that drops the call
-- deletes a named function call rather than an inline block, and the db test
-- asserts both callers refuse an unentitled shop.
--
-- WHAT COUNTS AS ENTITLED (both arms, deliberately):
--   • a LIVE subscription — vendor_profiles.papic_challenge_expires_at > now();
--   • OR a legacy per-event sponsorship row. Prod has none, but a per-event row
--     is what somebody's ₱400 bought, and a repricing must never retroactively
--     unsell it. The legacy arm is dead weight the day it stops mattering; it
--     is not dead weight while a single row could exist.
--
-- ⚠ THE NEW COLUMN IS A PAID ENTITLEMENT, SO IT GOES IN THE SELF-GRANT GUARD.
-- `vendor_profiles_owner` is FOR ALL with no column scoping, so RLS says "this
-- row is yours" and has no opinion about what is IN it. Without the guard entry
-- below, any shop could PATCH `papic_challenge_expires_at` to 2099 through
-- PostgREST with the public anon key and take the product for nothing —
-- the eighth instance of that shape in this schema, and
-- guard_vendor_profiles_entitlement's own comment says in capitals to add every
-- new paid column here.
--
-- ⚠ NOT ADDED TO THE `anon` COLUMN ALLOWLIST (20271014385411), deliberately: a
-- shop's billing window is not public. anon holds a per-column grant on
-- vendor_profiles, so a new column is unreachable to it by default — the
-- correct default, and the opposite of the `events` table, where a missing
-- grant breaks every read.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS · CREATE OR REPLACE · a catalog UPDATE
-- that is safe to re-run.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. The entitlement window. Mirrors vendor_profiles.ai_addon_expires_at.
-- ----------------------------------------------------------------------------
ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS papic_challenge_expires_at TIMESTAMPTZ;

COMMENT ON COLUMN public.vendor_profiles.papic_challenge_expires_at IS
  'Owner 2026-08-28 ("unlimited us 2500 for 4 weeks"): while now() < this, the shop may run Papic Challenges on EVERY celebration it is booked for. Written only by the sku-activation hook on admin payment approval (service_role) and reversed on refund/reject; vendor self-writes are refused by trg_guard_vendor_profiles_entitlement. Lapse is evaluated at read time — this project is cron-free and nothing sweeps it. Supersedes the ₱400 per-event papic_photo_challenge_sponsorships row, which is still honoured for anyone who bought one.';

-- ----------------------------------------------------------------------------
-- 2. The self-grant guard learns the new column.
--
-- 🚨 THE BODY BELOW IS COPIED FROM THE LIVE FUNCTION IN PRODUCTION
--    (`pg_get_functiondef`, read 2026-08-29), NOT from the migration that
--    created it — and I got that wrong on the first attempt in exactly the way
--    this migration's own header warns about, two screens up.
--
--    The first draft rebased on 20271002456914 (seven columns) and added the new
--    one. Ten db tests went red, and every one of them named a guard that had
--    been added AFTERWARDS and that my CREATE OR REPLACE had silently deleted:
--      · ai_addon_level (self-promotion to 'advanced')
--      · verification_state    → A SHOP COULD HAVE SELF-VERIFIED
--      · public_visibility     → and reversed an admin's suspension
--      · experience_verified_at / _by / last_verified_at
--      · the year-change auto-unverify, which lives in this body
--      · pending_tier + its four companions, and subscription_credit_php
--        → a free plan change and a self-written account balance
--
--    So the failure this migration exists to repair happened again, to the
--    person repairing it, inside the same file. **The lesson is not "be
--    careful": it is that a CREATE OR REPLACE must start from the OBJECT, never
--    from the migration that last touched it, because applied migrations are
--    never edited and the newest one is not necessarily the newest change.**
--    It was caught only because those guards have BEHAVIOURAL db tests that try
--    the forgery; a guard asserted by reading source would have passed.
--
--    Diff against the live body: two added disjuncts, one per arm. Nothing else.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_vendor_profiles_entitlement()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  new_level TEXT := to_jsonb(NEW) ->> 'ai_addon_level';
  old_level TEXT := CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ->> 'ai_addon_level' END;
BEGIN
  IF current_user IN ('authenticated', 'anon') AND NOT public.is_admin() THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.tier_state IS DISTINCT FROM 'free'::public.vendor_tier_state
         OR NEW.tier_expires_at IS NOT NULL
         OR NEW.extra_agent_seats IS DISTINCT FROM 0
         OR NEW.ai_addon_expires_at IS NOT NULL
         OR NEW.ai_addon_trial_used_at IS NOT NULL
         OR NEW.booth_addon_expires_at IS NOT NULL
         OR NEW.booth_addon_trial_used_at IS NOT NULL
         -- Papic Challenges, added 20271181420277. A shop cannot be born holding
         -- a 28-day window it never paid for.
         OR NEW.papic_challenge_expires_at IS NOT NULL
         OR (new_level IS NOT NULL AND new_level <> 'basic')
         -- Trust columns: a self-created profile may never arrive pre-verified
         -- or pre-visible. Both are admin-granted only. The literals below are
         -- the COLUMN DEFAULTS verbatim — 'unverified' (20260516050000:83-84)
         -- and 'hidden' (20271013500000 step 2; WAS 'coming_soon' from
         -- 20260515005000 until the owner retired that state on 2026-07-27) —
         -- and both are ENUMs, so they are cast explicitly. Getting either wrong
         -- would reject ordinary vendor registration.
         OR NEW.verification_state
              IS DISTINCT FROM 'unverified'::public.vendor_verification_state
         OR NEW.public_visibility
              IS DISTINCT FROM 'hidden'::public.vendor_public_visibility
         -- Trust columns, added 20271134103060. A shop cannot be BORN carrying
         -- the mark that says Setnayan checked it, any more than it can be born
         -- verified. All three are stamped only by /admin/verify (service-role).
         OR NEW.experience_verified_at IS NOT NULL
         OR NEW.experience_verified_by IS NOT NULL
         OR NEW.last_verified_at IS NOT NULL
         -- A shop cannot be born holding money, or born with a plan queued up
         -- behind the one it is on. With the applier live, an unguarded
         -- `pending_tier` is a plan that switches itself on for free the moment
         -- the current term runs out.
         OR NEW.pending_tier IS NOT NULL
         OR NEW.pending_tier_purchase_id IS NOT NULL
         OR COALESCE(NEW.subscription_credit_php, 0) <> 0
      THEN
        RAISE EXCEPTION
          'vendor_profiles tier/seat/add-on/trust columns are not writable by the vendor (self-grant blocked)'
          USING ERRCODE = 'insufficient_privilege',
                HINT = 'Tier, paid seats, paid add-ons, scheduled plan changes, account credit, verification, public visibility and the experience check are granted by the admin console or the paid activation path (service_role).';
      END IF;
    ELSE  -- UPDATE
      -- Enforce the year-change auto-unverify that the app performs as a
      -- courtesy. Done BEFORE the refusal check so the forced NULLs are what
      -- the check below sees — and so a vendor who PATCHes the year directly,
      -- never naming the stamp columns, still loses the mark. The admin's
      -- check was against a specific number; change the number and the check
      -- no longer means anything.
      IF NEW.in_business_since_year IS DISTINCT FROM OLD.in_business_since_year THEN
        NEW.experience_verified_at := NULL;
        NEW.experience_verified_by := NULL;
      END IF;

      IF NEW.tier_state IS DISTINCT FROM OLD.tier_state
         OR NEW.tier_expires_at IS DISTINCT FROM OLD.tier_expires_at
         OR NEW.extra_agent_seats IS DISTINCT FROM OLD.extra_agent_seats
         OR NEW.ai_addon_expires_at IS DISTINCT FROM OLD.ai_addon_expires_at
         OR NEW.ai_addon_trial_used_at IS DISTINCT FROM OLD.ai_addon_trial_used_at
         OR NEW.booth_addon_expires_at IS DISTINCT FROM OLD.booth_addon_expires_at
         OR NEW.booth_addon_trial_used_at IS DISTINCT FROM OLD.booth_addon_trial_used_at
         -- Papic Challenges, added 20271181420277.
         OR NEW.papic_challenge_expires_at IS DISTINCT FROM OLD.papic_challenge_expires_at
         OR new_level IS DISTINCT FROM old_level
         -- Trust columns: self-verification, and reversing an admin visibility
         -- freeze on a suspended vendor.
         OR NEW.verification_state IS DISTINCT FROM OLD.verification_state
         OR NEW.public_visibility IS DISTINCT FROM OLD.public_visibility
         -- When the shop was last verified is the admin's record, never the
         -- vendor's — not even to clear it.
         OR NEW.last_verified_at IS DISTINCT FROM OLD.last_verified_at
         -- The experience mark may be CLEARED by the vendor (that is the
         -- year-change unverify, and giving up your own badge harms nobody) but
         -- never SET or moved to another value. Written as "changed AND the new
         -- value is not null" so the allowed direction stays one-way.
         OR (NEW.experience_verified_at IS DISTINCT FROM OLD.experience_verified_at
             AND NEW.experience_verified_at IS NOT NULL)
         OR (NEW.experience_verified_by IS DISTINCT FROM OLD.experience_verified_by
             AND NEW.experience_verified_by IS NOT NULL)
         -- Every part of a scheduled plan change, and the money balance. All six
         -- are named: the applier reads the cycle, the period and the purchase
         -- id as well as the tier, so guarding only `pending_tier` would leave a
         -- shop able to stretch a 28-day plan into 3,650 days.
         OR NEW.pending_tier IS DISTINCT FROM OLD.pending_tier
         OR NEW.pending_tier_period_days IS DISTINCT FROM OLD.pending_tier_period_days
         OR NEW.pending_tier_purchase_id IS DISTINCT FROM OLD.pending_tier_purchase_id
         OR NEW.pending_tier_billing_cycle IS DISTINCT FROM OLD.pending_tier_billing_cycle
         OR NEW.pending_tier_sku_code IS DISTINCT FROM OLD.pending_tier_sku_code
         OR NEW.subscription_credit_php IS DISTINCT FROM OLD.subscription_credit_php
      THEN
        RAISE EXCEPTION
          'vendor_profiles tier/seat/add-on/trust columns are not writable by the vendor (self-grant blocked)'
          USING ERRCODE = 'insufficient_privilege',
                HINT = 'Tier, paid seats, paid add-ons, scheduled plan changes, account credit, verification, public visibility and the experience check are granted by the admin console or the paid activation path (service_role).';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.guard_vendor_profiles_entitlement() IS
  'Self-grant guard for public.vendor_profiles. RLS is row-level only and vendor_profiles_owner is FOR ALL with no column scoping, so every PAID or ADMIN-GRANTED column needs an explicit check here. Guards: tier_state, tier_expires_at, extra_agent_seats · ai_addon_expires_at/_trial_used_at/_level · booth_addon_expires_at/_trial_used_at · verification_state, public_visibility, experience_verified_at/_by, last_verified_at · pending_tier + its four companions, subscription_credit_php · papic_challenge_expires_at (20271181420277). ⚠ ADD EVERY NEW PAID ENTITLEMENT COLUMN HERE — an unguarded one is vendor-writable through PostgREST the day it ships. ⚠ AND WHEN YOU REPLACE THIS FUNCTION, COPY THE BODY OUT OF THE LIVE OBJECT (pg_get_functiondef), NEVER out of the migration that last touched it: rebasing on an older body silently deletes every guard added since, which has now happened twice in this schema.';

-- ----------------------------------------------------------------------------
-- 3. ONE ANSWER TO "may this shop run a challenge here", two callers.
-- ----------------------------------------------------------------------------
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
  SELECT
    -- The 28-day subscription: unlimited challenges on every booked event.
    EXISTS (
      SELECT 1 FROM public.vendor_profiles vp
       WHERE vp.vendor_profile_id = p_vendor_profile_id
         AND vp.papic_challenge_expires_at IS NOT NULL
         AND vp.papic_challenge_expires_at > NOW()
    )
    -- OR a legacy ₱400 per-event sponsorship. Nobody holds one in production,
    -- and a repricing must still never unsell what somebody already bought.
    OR EXISTS (
      SELECT 1 FROM public.papic_photo_challenge_sponsorships s
       WHERE s.vendor_profile_id = p_vendor_profile_id
         AND s.event_id = p_event_id
    );
$$;

COMMENT ON FUNCTION public.vendor_papic_challenge_entitled(UUID, UUID) IS
  'May this shop run a Papic Challenge on this celebration? TRUE for a live 28-day subscription (vendor_profiles.papic_challenge_expires_at, owner 2026-08-28) or a legacy per-event sponsorship row. THE SINGLE definition — called by papic_create_vendor_challenge (authoring) and papic_vendor_challenge_photos (delivery), which drifted apart once already when a CREATE OR REPLACE rebased the authoring RPC on a pre-paywall body and silently deleted its gate. Takes a vendor_profile_id, so it is NOT granted to any user role; both callers are SECURITY DEFINER and resolve the caller themselves.';

REVOKE ALL ON FUNCTION public.vendor_papic_challenge_entitled(UUID, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vendor_papic_challenge_entitled(UUID, UUID) TO service_role;

-- ----------------------------------------------------------------------------
-- 4. AUTHORING — the paywall, restored, in its subscription form.
--
--    Everything else in this body is exactly the live 20271001130000 version:
--    the prompt bounds, the vendor identity, the BOOKED-only join, and the
--    all-tiers flag. The only change is that the entitlement is asked for again.
-- ----------------------------------------------------------------------------
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
  v_all_tiers         BOOLEAN;
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
  -- Capture the marketplace vendor_profile_id (for the entitlement gate) and the
  -- tier (for the all-tiers gate) in the same pass.
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

  -- 2026-07-25 tiered add-on model: when enabled, Papic Challenge opens to ALL
  -- tiers (they pay the entry price); otherwise the pre-2026-07-25 paid-tier
  -- gate (Solo/Pro/Enterprise/Custom) stands verbatim.
  SELECT COALESCE(ps.vendor_addon_tiered_pricing_enabled, FALSE)
    INTO v_all_tiers
    FROM public.platform_settings ps
   WHERE ps.id = 1;

  IF NOT COALESCE(v_all_tiers, FALSE) THEN
    IF v_tier IS NULL OR v_tier NOT IN ('solo', 'pro', 'enterprise', 'custom') THEN
      RAISE EXCEPTION 'custom challenges require a paid vendor plan (Solo, Pro, Enterprise, or Custom)';
    END IF;
  END IF;

  -- PAID gate, RESTORED 2026-08-29 (see this migration's header: it was lost by
  -- a CREATE OR REPLACE that rebased on a pre-paywall body). Apply-then-pay: the
  -- window is written by the sku-activation hook on admin payment approval, so
  -- this is also the payment-verified handshake — a pending order never unlocks
  -- it.
  IF NOT public.vendor_papic_challenge_entitled(v_vendor_profile_id, p_event_id) THEN
    RAISE EXCEPTION 'PAPIC_CHALLENGE_NOT_SUBSCRIBED: turn on Papic Challenges for your shop first';
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
  'Papic Games §3.4/§3.6: a BOOKED vendor whose shop holds a live Papic Challenges subscription (or a legacy per-event sponsorship) authors a custom challenge (approved=false until the couple approves). SECURITY DEFINER; booked + tier + PAID gated, the last through vendor_papic_challenge_entitled(). ⚠ The paid gate was silently reverted between 2026-07-22 and 2026-08-29 by a CREATE OR REPLACE that rebased on an older body — if you replace this function, keep the entitlement call.';

-- ----------------------------------------------------------------------------
-- 5. DELIVERY — same question, same function. Behaviour for a legacy per-event
--    sponsor is unchanged; a subscriber now also collects, which is the point.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.papic_vendor_challenge_photos(p_event_id UUID)
RETURNS TABLE(
  capture_id uuid, mission_id uuid, prompt text, media_type text,
  display_r2_key text, thumb_r2_key text, poster_r2_key text,
  clip_web_r2_key text, captured_at timestamp with time zone
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_profile_ids UUID[];
BEGIN
  SELECT array_agg(v) INTO v_profile_ids FROM public.current_vendor_profile_ids() AS v;
  IF v_profile_ids IS NULL OR array_length(v_profile_ids, 1) IS NULL THEN
    RETURN;  -- not a vendor → empty
  END IF;

  RETURN QUERY
  SELECT cap.capture_id, m.mission_id, m.prompt, cap.media_type,
         cap.display_r2_key, cap.thumb_r2_key, cap.poster_r2_key, cap.clip_web_r2_key,
         cap.captured_at
  FROM public.papic_mission_completions comp
  -- the completion's mission must be a VENDOR challenge owned by THIS vendor.
  JOIN public.papic_missions m
    ON m.mission_id = comp.mission_id AND m.source = 'vendor'
  JOIN public.event_vendors ev
    ON ev.vendor_id = m.vendor_id AND ev.marketplace_vendor_id = ANY(v_profile_ids)
  JOIN public.papic_guest_captures cap
    ON cap.capture_id = comp.capture_id
  WHERE comp.event_id = p_event_id
    -- Per-mission entitlement correlation (defence in depth): the mission's OWN
    -- vendor profile must be entitled — not merely some profile the caller
    -- controls. Same function the authoring RPC calls, so the delivery gate can
    -- never drift from the create gate again.
    AND public.vendor_papic_challenge_entitled(ev.marketplace_vendor_id, comp.event_id)
    -- §4 per-vendor share consent (the guest tapped "Share this photo with <vendor>").
    AND comp.consent_to_share = true
    -- STRICT OUTBOUND moderation allowlist (not the couple denylist): the capture
    -- must have been NSFW-screened clean and not moderation-hidden.
    AND cap.moderation_state = 'clean'
    AND cap.hidden_at IS NULL
  ORDER BY comp.created_at DESC;
END;
$$;

-- ----------------------------------------------------------------------------
-- 6. The catalogue row is repriced and re-shaped in place.
--
--    ONE sku_code, not a second row: `vendor_photo_challenge` is also the
--    literal orders.service_key and the key of the activation hook, and this
--    repo has already paid for a "rung" that existed in the catalogue and not
--    in the activation map — it takes the money and grants nothing. Prod holds
--    ZERO orders on this key, so nothing historical is re-described.
--
--    ⚠ The 2026-07-25 tiered matrix in apps/web/lib/vendor-addon-tier-pricing.ts
--    ALSO carries a price for this SKU (entry ₱500 / growth ₱400 per event) and
--    OVERRIDES the catalogue when NEXT_PUBLIC_VENDOR_ADDON_TIERED_PRICING is on.
--    Both bands move to ₱2,500 in the same PR — the owner set one number, not a
--    band pair, and leaving the matrix behind would charge ₱400 for a 28-day
--    subscription the moment that flag flips.
-- ----------------------------------------------------------------------------
UPDATE public.vendor_billing_catalog
   SET offering_type = 'vendor_addon_recurring',
       price_php     = 2500,
       title         = 'Papic Challenges (unlimited · 28 days)',
       updated_at    = NOW()
 WHERE sku_code = 'vendor_photo_challenge';

COMMIT;
