-- vendor_photo_challenge_sku
-- ============================================================================
-- Photo Challenge — a sellable, per-(vendor,event) add-on that lets a BOOKED
-- Pro/Enterprise vendor SPONSOR guest photo-engagement challenges (the existing
-- flag-dark Papic Games / missions feature) at a booked event where Papic is
-- active. Owner-locked 2026-07-22:
--
--   • FLAT ₱400 / EVENT (metered per event — NOT a subscription, NO free cycle).
--   • Pro / Enterprise tiers only (verified) — Solo/Verified/Free cannot sponsor.
--   • PAPIC-GATED: only offerable when Papic is active on that event.
--   • BOOKED-VENDORS-ONLY, their OWN events — no third-party placement.
--   • FREE & inclusive for guests/couple — the vendor pays ₱400; guests play free.
--
-- This resolves the ⚠ PRICING GAP flagged in 20270902380131 (the vendor custom
-- challenge RPC), which enforced only the buildable half (Pro+ unlimited/free)
-- because there was NO per-(vendor,event) entitlement marker. This migration
-- adds that marker + the ₱400 SKU + re-gates the authoring RPC on a paid
-- sponsorship. The underlying Papic Games runtime is UNCHANGED and stays behind
-- the GLOBAL master switch NEXT_PUBLIC_PAPIC_GAMES_V1 (default OFF).
--
-- FOUR parts:
--   1. Extend vendor_billing_catalog `offering_type` + `vendor_billing_shape`
--      CHECKs to admit a per-event metered add-on (`vendor_addon_per_event`),
--      following the same drop/recreate pattern as 20270905761946 (the AI add-on).
--   2. Seed the admin-managed `vendor_photo_challenge` SKU (₱400).
--   3. Create the per-(vendor,event) sponsorship entitlement table.
--   4. Re-gate papic_create_vendor_challenge on a paid sponsorship.
--
-- KEEP IDEMPOTENT (may be re-applied): IF NOT EXISTS / IF EXISTS everywhere,
-- ON CONFLICT DO UPDATE that never stomps an admin's price edit.
-- ============================================================================

BEGIN;

-- ── 1 · catalog: a 'vendor_addon_per_event' offering_type ────────────────────
-- Same drop+recreate pattern as 20270905761946. Include EVERY value currently
-- allowed (subscription_monthly/annual · token_pack · branch · seat ·
-- custom_addon · vendor_addon_recurring) plus the new 'vendor_addon_per_event'
-- so existing rows keep validating.
ALTER TABLE public.vendor_billing_catalog
  DROP CONSTRAINT IF EXISTS vendor_billing_catalog_offering_type_check;

ALTER TABLE public.vendor_billing_catalog
  ADD CONSTRAINT vendor_billing_catalog_offering_type_check
  CHECK (offering_type IN (
    'subscription_monthly', 'subscription_annual', 'token_pack',
    'branch', 'seat', 'custom_addon', 'vendor_addon_recurring',
    'vendor_addon_per_event'
  ));

-- A 'vendor_addon_per_event' row is shape-wise a subscription/branch/seat/
-- recurring-addon: no token grant (token_grant_count NULL) and no cap columns.
-- Add it to the non-token arm of the shape CHECK.
ALTER TABLE public.vendor_billing_catalog
  DROP CONSTRAINT IF EXISTS vendor_billing_shape;

ALTER TABLE public.vendor_billing_catalog
  ADD CONSTRAINT vendor_billing_shape CHECK (
    (offering_type IN (
       'subscription_monthly', 'subscription_annual', 'branch', 'seat',
       'custom_addon', 'vendor_addon_recurring', 'vendor_addon_per_event'
     ) AND token_grant_count IS NULL)
    OR
    (offering_type = 'token_pack' AND max_categories IS NULL AND max_sub_seats IS NULL)
  );

-- ── 2 · seed the Photo Challenge add-on SKU · ₱400 / event (owner 2026-07-22) ─
-- display_order 83 sits right after the Vendor AI add-on (82). price_php
-- intentionally NOT overwritten on conflict — once the row exists its price is
-- admin-managed at /admin/pricing. token_grant_count / max_* stay NULL (add-on shape).
INSERT INTO public.vendor_billing_catalog
  (sku_code, title, price_php, offering_type, token_grant_count, max_categories, max_sub_seats, display_order)
VALUES
  ('vendor_photo_challenge', 'Photo Challenge (per event)', 400.00, 'vendor_addon_per_event', NULL, NULL, NULL, 83)
ON CONFLICT (sku_code) DO UPDATE SET
  title             = EXCLUDED.title,
  offering_type     = EXCLUDED.offering_type,
  token_grant_count = EXCLUDED.token_grant_count,
  max_categories    = EXCLUDED.max_categories,
  max_sub_seats     = EXCLUDED.max_sub_seats,
  display_order     = EXCLUDED.display_order,
  updated_at        = NOW();
  -- price_php intentionally NOT overwritten on conflict (admin-managed).

-- ── 3 · per-(vendor,event) sponsorship entitlement ───────────────────────────
-- The marker the ₱400 order buys. One row = "this vendor has sponsored Photo
-- Challenge for this event" → they may author custom challenges for it. UNIQUE
-- (event_id, vendor_profile_id) makes the entitlement idempotent (one
-- sponsorship per vendor per event; the buy action rejects a second order and
-- the activation hook's ON CONFLICT DO NOTHING is a defensive backstop).
--
-- Keyed by vendor_profile_id (the marketplace vendor identity), not the
-- per-event event_vendors.vendor_id — the entitlement follows the paying vendor
-- ORG, matching how papic_create_vendor_challenge resolves the caller
-- (current_vendor_profile_ids → event_vendors.marketplace_vendor_id).
CREATE TABLE IF NOT EXISTS public.papic_photo_challenge_sponsorships (
  id                 BIGSERIAL PRIMARY KEY,
  sponsorship_id     UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  event_id           UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  vendor_profile_id  UUID NOT NULL REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  -- The paid order that activated this sponsorship (audit trail; SET NULL if the
  -- order is later hard-deleted — the sponsorship stands on its own row).
  order_id           UUID REFERENCES public.orders(order_id) ON DELETE SET NULL,
  sponsored_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, vendor_profile_id)
);
COMMENT ON TABLE public.papic_photo_challenge_sponsorships IS
  'Photo Challenge (owner 2026-07-22): a booked Pro/Enterprise vendor paid ₱400 to sponsor guest photo challenges for this event. One row per (event, vendor_profile). Written by the sku-activation hook on admin payment approval; gates papic_create_vendor_challenge.';

CREATE INDEX IF NOT EXISTS idx_papic_photo_challenge_sponsorships_event
  ON public.papic_photo_challenge_sponsorships (event_id);
CREATE INDEX IF NOT EXISTS idx_papic_photo_challenge_sponsorships_vendor
  ON public.papic_photo_challenge_sponsorships (vendor_profile_id);

ALTER TABLE public.papic_photo_challenge_sponsorships ENABLE ROW LEVEL SECURITY;

-- The paying vendor org reads its OWN sponsorships (so the client-event UI can
-- show "sponsored / not sponsored"). Writes come only from the admin-client
-- activation hook (RLS-bypassed) — there is no vendor/couple write policy.
DROP POLICY IF EXISTS papic_photo_challenge_sponsorships_vendor_read
  ON public.papic_photo_challenge_sponsorships;
CREATE POLICY papic_photo_challenge_sponsorships_vendor_read
  ON public.papic_photo_challenge_sponsorships
  FOR SELECT TO authenticated
  USING (vendor_profile_id IN (SELECT public.current_vendor_profile_ids()));

-- The couple/coordinator of the event may read (so the couple can see which of
-- their vendors sponsored a challenge). Read-only.
DROP POLICY IF EXISTS papic_photo_challenge_sponsorships_member_read
  ON public.papic_photo_challenge_sponsorships;
CREATE POLICY papic_photo_challenge_sponsorships_member_read
  ON public.papic_photo_challenge_sponsorships
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.event_members em
    WHERE em.event_id = papic_photo_challenge_sponsorships.event_id
      AND em.user_id = auth.uid()
      AND em.member_type IN ('couple', 'coordinator')
  ));

DROP POLICY IF EXISTS papic_photo_challenge_sponsorships_admin_all
  ON public.papic_photo_challenge_sponsorships;
CREATE POLICY papic_photo_challenge_sponsorships_admin_all
  ON public.papic_photo_challenge_sponsorships
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ── 4 · re-gate papic_create_vendor_challenge on the paid sponsorship ─────────
-- CREATE OR REPLACE of the RPC (latest prior definition: 20270906348207), adding
-- the entitlement gate: a booked Pro/Enterprise/Custom vendor may author a custom
-- challenge ONLY when they have PAID the ₱400 Photo Challenge sponsorship for THIS
-- event. Everything else is unchanged (copy bounds → vendor identity → booked gate
-- → Pro+ gate), so a gate failure keeps the same clear RAISE messages.
--
-- ⚠ SUPERSEDES 20270906348207 — TWO SAME-DAY OWNER DECISIONS DIFFER, SURFACED FOR
-- SIGN-OFF. That migration (#3515) had (a) extended eligibility DOWN to 'solo'
-- and (b) left authoring FREE during launch (collection deferred: "a per-event
-- apply-then-pay gate is an owner decision for when paying vendors exist"). THIS
-- migration IS that apply-then-pay gate, and it follows THIS task's owner-lock
-- (2026-07-22): ₱400/event, PRO/ENTERPRISE ONLY. So it (a) narrows the tier gate
-- back to pro/enterprise/custom (dropping 'solo') and (b) requires a PAID
-- sponsorship (ending free-during-launch — which #3515 anticipated). The Solo
-- inclusion is the one genuine contradiction between the two decisions; the owner
-- must confirm which wins. Flip 'solo' back into the tier list + the eligibility
-- gate (lib/vendor-photo-challenge.ts → isTierAtLeast('solo')) if Solo should pay.
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

  -- BOOKED-only (§3.3/§3.4): the caller must own a booked event_vendors row for
  -- this event. Capture the marketplace vendor_profile_id (for the sponsorship
  -- gate) + tier (for the Pro/Ent gate) in the same pass.
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

  -- Pro-and-up gate (owner 2026-07-22 — Pro/Enterprise only; 'custom' runs as
  -- Enterprise-or-better so it inherits, matching the ratified Pro+ precedents).
  IF v_tier IS NULL OR v_tier NOT IN ('pro', 'enterprise', 'custom') THEN
    RAISE EXCEPTION 'custom challenges require a Pro, Enterprise, or Custom vendor plan';
  END IF;

  -- PAID SPONSORSHIP gate (owner 2026-07-22): Photo Challenge is ₱400/event. The
  -- vendor must have an active sponsorship row for THIS (event, vendor_profile).
  -- The row is written by the sku-activation hook on admin payment approval, so
  -- this is also the payment-verified handshake — a pending order never unlocks it.
  IF NOT EXISTS (
    SELECT 1 FROM public.papic_photo_challenge_sponsorships s
    WHERE s.event_id = p_event_id
      AND s.vendor_profile_id = v_vendor_profile_id
  ) THEN
    RAISE EXCEPTION 'sponsor Photo Challenge for this event first (P400 per event)';
  END IF;

  INSERT INTO public.papic_missions
    (event_id, mission_type, source, vendor_id, prompt, approved, is_active)
  VALUES
    (p_event_id, 'vendor_booth', 'vendor', v_event_vendor_id, v_prompt, false, true)
  RETURNING mission_id INTO v_mission_id;

  RETURN v_mission_id;
END;
$$;

REVOKE ALL ON FUNCTION public.papic_create_vendor_challenge(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.papic_create_vendor_challenge(UUID, TEXT) TO authenticated;
COMMENT ON FUNCTION public.papic_create_vendor_challenge(UUID, TEXT) IS
  'Papic Games §3.4/§3.6 + Photo Challenge (owner 2026-07-22): a booked Pro/Enterprise vendor who has PAID the P400 per-event Photo Challenge sponsorship authors a custom challenge (approved=false until the couple approves). SECURITY DEFINER; booked + Pro+ + paid-sponsorship gated.';

COMMIT;

-- ============================================================================
-- VERIFICATION:
--
-- SELECT sku_code, price_php, offering_type, display_order
--   FROM vendor_billing_catalog WHERE sku_code = 'vendor_photo_challenge';
-- -- Expected: vendor_photo_challenge · 400.00 · vendor_addon_per_event · 83
--
-- SELECT to_regclass('public.papic_photo_challenge_sponsorships');
-- -- Expected: a non-null relation.
-- ============================================================================
