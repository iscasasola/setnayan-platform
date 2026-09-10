-- verified_badge_deadlines
-- ============================================================================
-- THE BADGE HAS A DEADLINE; THE SHOP DOES NOT.
--
-- Owner rulings 2026-09-11 (DECISION_LOG "SEVEN SUPPLIER-SIDE QUESTIONS"):
--   Q4 — the two shops verified before the papers check existed keep the
--        Verified badge for six months while their papers come in; after six
--        months without them the badge comes off (the same deadline as a vouch).
--   Q5 — a Mayor's Permit that runs out: a reminder 60 days ahead, then the
--        Verified badge comes off — the shop STAYS FINDABLE AND BOOKABLE.
--
-- ── WHAT THE BADGE READS NOW ────────────────────────────────────────────────
-- `verification_state = 'verified'` is the public read policy AND the booking
-- trigger AND the badge, so flipping it at a deadline would hide the shop and
-- make it unbookable — the one thing Q5 forbids. The state is therefore never
-- touched at a deadline. The badge alone reads `next_renewal_due_at`, which
-- approval already writes (one year out, or now the permit's printed date):
--   badge = verification_state = 'verified' AND (deadline IS NULL OR deadline > now)
-- Expiry on read (apps/web/lib/verified-badge.ts · hasVerifiedBadge) — no job
-- decides the badge, so it is never late.
--
-- ── 1 · THE DEADLINE BECOMES A TRUST COLUMN ─────────────────────────────────
-- Until today `next_renewal_due_at` was inert, and it was WRITABLE BY THE
-- VENDOR: `vendor_profiles_owner` is FOR ALL on user_id = auth.uid(),
-- `authenticated` holds UPDATE on the column, and the entitlement guard did not
-- name it. Harmless while nothing read it. Once it decides the badge, a shop
-- could PATCH its own deadline to 2099 and never lose the badge. So it joins
-- `last_verified_at` in the guard, refused in both directions and at INSERT.
--
-- Re-emitted in full (CREATE OR REPLACE, the house pattern) from
-- 20271209332066 — whose body was confirmed BYTE-IDENTICAL to production's
-- live `prosrc` on 2026-09-11 (md5 9ff6f296b6b90f4d7dc3680f1ee86093, 7268
-- bytes) — with the two `next_renewal_due_at` clauses added and nothing else
-- changed.
-- ============================================================================

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
         -- The Verified badge's deadline, added 20271221359289. It decides
         -- whether the badge shows; a shop cannot be born holding one.
         OR NEW.next_renewal_due_at IS NOT NULL
         -- A shop cannot be born holding money, or born with a plan queued up
         -- behind the one it is on. With the applier live, an unguarded
         -- `pending_tier` is a plan that switches itself on for free the moment
         -- the current term runs out.
         OR NEW.pending_tier IS NOT NULL
         OR NEW.pending_tier_purchase_id IS NOT NULL
         OR COALESCE(NEW.subscription_credit_php, 0) <> 0
         -- tier_source, added with the column in 20271209332066. A shop cannot
         -- be BORN claiming it paid its own way: the default is the only value a
         -- vendor may arrive with, and self-serve checkout writes as service_role.
         OR NEW.tier_source IS DISTINCT FROM 'admin_comp'
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
         -- The Verified badge's deadline (20271221359289). Moving it LATER keeps
         -- a badge past its papers; clearing it makes the badge permanent. Both
         -- directions are the admin's alone.
         OR NEW.next_renewal_due_at IS DISTINCT FROM OLD.next_renewal_due_at
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
         -- tier_source is the record of WHO PAID, so it is exactly the kind of
         -- claim its subject must not be able to make about itself. Flipping it to
         -- 'self_serve' grants no tier — it makes a GIFT look purchased, which
         -- hides the vendor from fetchCompedVendors and from /admin/gifts.
         OR NEW.tier_source IS DISTINCT FROM OLD.tier_source
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

COMMENT ON COLUMN public.vendor_profiles.next_renewal_due_at IS
  'The day the Verified badge needs fresh papers: the Mayor''s Permit''s printed '
  'expiry when the reviewer recorded it at approval, else approval + 1 year; for '
  'a vouch, the papers deadline. Past it the BADGE is off (lib/verified-badge.ts '
  '· hasVerifiedBadge) — the shop stays listed and bookable, because listing and '
  'booking read verification_state alone. Admin-written only (entitlement guard).';

-- ── 2 · Q4 — THE SHOPS VERIFIED BEFORE THE PAPERS CHECK ─────────────────────
-- Selected by a STABLE CONDITION, never by id: verified, no APPROVED papers
-- application, and not already vouched for. Measured in production 2026-09-11,
-- that is exactly two shops (both verified, one draft application with empty
-- slots between them, zero vouch rows) — and it is also the right answer for
-- any other shop in the same position in any other database this replays into.
--
-- They are given EXACTLY what a vouch is — a row in the vouch table with a
-- reason, and the same 182-day window — so the desk shows them as vouched with
-- a countdown and the same pass reminds them; plus the badge deadline itself.
-- The date is fixed (2026-09-11 + 182 days, end of day Manila) so the date the
-- owner is told is the date the badge obeys, however long this waits to merge.
--
-- ⚠ Nothing here touches verification_state or public_visibility. Both shops
-- stay exactly as findable and bookable as they are this morning.
-- BACKFILL:BEGIN
WITH early AS (
  SELECT vp.vendor_profile_id
    FROM public.vendor_profiles vp
   WHERE vp.verification_state = 'verified'::public.vendor_verification_state
     AND NOT EXISTS (
       SELECT 1 FROM public.vendor_verification_applications a
        WHERE a.vendor_profile_id = vp.vendor_profile_id
          AND a.status = 'approved'
     )
     AND NOT EXISTS (
       SELECT 1 FROM public.vendor_verification_bypasses b
        WHERE b.vendor_profile_id = vp.vendor_profile_id
     )
),
vouched AS (
  INSERT INTO public.vendor_verification_bypasses
    (vendor_profile_id, granted_at, expires_at, reason, granted_by, updated_at)
  SELECT e.vendor_profile_id,
         now(),
         TIMESTAMPTZ '2027-03-12 23:59:59+08',
         'Verified before the papers check existed. Owner ruling 2026-09-11 (Q4): '
           'the badge stays for six months while the papers come in, then comes off '
           'if they have not — the same deadline as a vouch.',
         NULL,
         now()
    FROM early e
  RETURNING vendor_profile_id
),
dated AS (
  UPDATE public.vendor_profiles vp
     SET next_renewal_due_at = TIMESTAMPTZ '2027-03-12 23:59:59+08'
    FROM vouched v
   WHERE vp.vendor_profile_id = v.vendor_profile_id
  RETURNING vp.vendor_profile_id, vp.business_name, vp.public_id
)
INSERT INTO public.admin_audit_log (action, target_table, target_id, reason, actor_user_id, metadata)
SELECT 'vendor_verification_bypass_grant',
       'vendor_profiles',
       d.vendor_profile_id::text,
       'Owner ruling 2026-09-11 (Q4): verified before the papers check existed.',
       NULL,
       jsonb_build_object(
         'business_name', d.business_name,
         'public_id', d.public_id,
         'expires_at', '2027-03-12T15:59:59.000Z',
         'source', 'migration 20271221359289 (owner ruling 2026-09-11 Q4)'
       )
  FROM dated d;
-- BACKFILL:END

-- ── Post-conditions ─────────────────────────────────────────────────────────
DO $$
DECLARE
  v_def TEXT;
  v_orphans BIGINT;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'guard_vendor_profiles_entitlement';
  IF v_def IS NULL OR v_def NOT LIKE '%NEW.next_renewal_due_at IS DISTINCT FROM OLD.next_renewal_due_at%' THEN
    RAISE EXCEPTION 'POST-CONDITION FAILED: the entitlement guard does not refuse a vendor moving next_renewal_due_at.';
  END IF;
  -- It must still guard what it guarded before (a stale re-emit would drop these).
  IF v_def NOT LIKE '%NEW.tier_source IS DISTINCT FROM OLD.tier_source%'
     OR v_def NOT LIKE '%NEW.last_verified_at IS DISTINCT FROM OLD.last_verified_at%'
     OR v_def NOT LIKE '%NEW.verification_state IS DISTINCT FROM OLD.verification_state%' THEN
    RAISE EXCEPTION 'POST-CONDITION FAILED: the re-emitted guard lost a clause it had before.';
  END IF;

  -- Every verified shop without approved papers now carries a vouch row.
  SELECT COUNT(*) INTO v_orphans
    FROM public.vendor_profiles vp
   WHERE vp.verification_state = 'verified'::public.vendor_verification_state
     AND NOT EXISTS (SELECT 1 FROM public.vendor_verification_applications a
                      WHERE a.vendor_profile_id = vp.vendor_profile_id AND a.status = 'approved')
     AND NOT EXISTS (SELECT 1 FROM public.vendor_verification_bypasses b
                      WHERE b.vendor_profile_id = vp.vendor_profile_id);
  IF v_orphans > 0 THEN
    RAISE EXCEPTION 'POST-CONDITION FAILED: % verified shop(s) without papers still carry no deadline.', v_orphans;
  END IF;
END;
$$;
