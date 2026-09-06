-- vendor_tier_source_and_sku_comps
--
-- G6 /admin/gifts polish (build-sessions/GIFTS-PLAN.md § G6), item 3: the
-- `fetchCompedVendors` trip-wire (lib/vendor-tier-comps.ts docblock). That
-- reader treats `tier_state <> 'free'` as "comped" — true today only because
-- `setVendorTier` is the ONLY writer of a non-free tier (self-serve vendor
-- checkout does not exist yet). The docblock warned this stops being true the
-- moment self-serve ships, with no column to tell a comp from a real payment
-- apart. This migration adds that column NOW, while it is cheap (one writer,
-- zero ambiguity), instead of leaving it for whoever builds checkout to
-- remember under deadline.
--
-- `tier_source` records HOW a vendor reached its current tier:
--   'admin_comp' — set via the admin console (setVendorTier). Every row today.
--   'self_serve' — reserved for the future checkout writer. Unused until then.
--
-- Defaults every existing + future row to 'admin_comp', which is exactly true
-- of every row in production today (setVendorTier is the only writer).

ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS tier_source TEXT NOT NULL DEFAULT 'admin_comp';

DO $$
BEGIN
  ALTER TABLE public.vendor_profiles
    ADD CONSTRAINT vendor_profiles_tier_source_check
    CHECK (tier_source IN ('admin_comp', 'self_serve'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON COLUMN public.vendor_profiles.tier_source IS
  'How this vendor reached vendor_profiles.tier_state. ''admin_comp'' = set via /admin/gifts or /admin/vendors/:id/plan (setVendorTier) — every row today, since self-serve vendor billing does not exist yet. ''self_serve'' is reserved for the future checkout writer; fetchCompedVendors (lib/vendor-tier-comps.ts) must filter to admin_comp once that writer ships, or a paying vendor reads as a gift.';

-- ----------------------------------------------------------------------------
-- G6 item 2: SKU-level vendor comps via `comp_grants.vendor_profile_id`
-- (dormant until now — its only prior reader was the vendor_self_comp quota
-- trigger, which counts vendor_profile_id rows ONLY when source =
-- 'vendor_self_comp'; see migration 20260515030000_self_review_gate.sql. An
-- admin-issued vendor comp always writes source = 'external_promo', so it can
-- never trip that quota — read the trigger before touching this column again).
--
-- Today's only wired vendor SKU is Papic Challenges: entitlement is ONE
-- column, `vendor_profiles.papic_challenge_expires_at` (see
-- public.vendor_papic_challenge_entitled(), migration 20271182071895), so an
-- admin comp can grant it for real with a direct UPDATE — no order, no new
-- gate. comp_grants gets the audit-grade row; vendor_profiles gets the actual
-- entitlement. Every OTHER vendor add-on (3D Booth, Deep Search, seats,
-- branches, the portfolio pack) has its own resolver with "no shared choke
-- point" (lib/promo-free-windows.ts) and is NOT wired here — extending this to
-- another SKU means writing that SKU's own direct-grant path, not widening a
-- generic switch.
COMMENT ON COLUMN public.comp_grants.vendor_profile_id IS
  'The vendor a comp TARGETS, when granted_by an admin (source=''external_promo'') via issueVendorSkuComp (apps/web/app/admin/vendors/actions.ts) — scope=''specific_skus'', scoped_skus names the SKU (e.g. vendor_photo_challenge). Mutually exclusive with user_id in that case: a vendor SKU comp has no user_id. SEPARATE MEANING when source=''vendor_self_comp'': there it names the vendor who is comping a COUPLE (user_id is the couple, this column is who paid nothing for it) — see enforce_vendor_self_comp_quota(). Same column, two meanings, disambiguated by source; never assume one without checking it.';

-- ----------------------------------------------------------------------------
-- 🛑 THE COLUMN ALSO NEEDS THE VALUE-LEVEL GUARD, OR IT IS A CLAIM ITS OWN
-- SUBJECT CAN MAKE ABOUT ITSELF.
--
-- `vendor_profiles` grants `authenticated` SELECT+INSERT+UPDATE on all ~105 of
-- its columns, and `vendor_profiles_owner` is `FOR ALL ... USING (user_id =
-- auth.uid())` — so a vendor can PATCH their own row over PostgREST with the
-- public anon key. RLS is ROW-level: the policy that lets a vendor edit their
-- own shop cannot stop them writing a particular VALUE into it.
--
-- This table's answer to that is not a column REVOKE — it is
-- `guard_vendor_profiles_entitlement`, a BEFORE INSERT/UPDATE trigger that
-- refuses vendor-initiated changes to `tier_state`, `tier_expires_at`,
-- `extra_agent_seats`, every add-on expiry, `papic_challenge_expires_at`,
-- `verification_state`, `public_visibility`, the trust stamps, all six
-- `pending_tier*` columns and `subscription_credit_php`. Every one of those is
-- ALSO `authenticated=SIU` in `supabase/security/exposure-surface.baseline.txt`,
-- which is what makes the trigger, not the grant, the real gate here.
--
-- `tier_source` was added above without joining that list. It grants no tier,
-- so nothing escalates — but flipping it to 'self_serve' makes a GIFTED tier
-- read as a PURCHASED one, which is precisely the distinction the column was
-- created to record, and it removes the vendor from `fetchCompedVendors` and
-- from /admin/gifts. A shop marking its own comp as paid-for is the whole
-- defect, and it is invisible to the exposure freeze, which measures grants.
--
-- Self-serve checkout, when it ships, writes as service_role and so is not
-- caught by `current_user IN ('authenticated','anon')` — it can still set
-- 'self_serve' truthfully.
--
-- Re-emitted in full (CREATE OR REPLACE, the house pattern) from
-- 20271181420277, with the two `tier_source` clauses added and nothing else
-- changed.
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


-- ----------------------------------------------------------------------------
-- 🛑 THE FEATURE ABOVE IS DEAD ON ARRIVAL IN PRODUCTION WITHOUT THIS LINE.
--
-- `issueVendorSkuComp` (apps/web/app/admin/vendors/actions.ts) inserts a comp
-- with `user_id: null` — deliberately, and correctly: a comp that targets a
-- VENDOR has no user, which is why the column comment above says the two are
-- mutually exclusive for `source = 'external_promo'`.
--
-- Production has `comp_grants.user_id` marked NOT NULL. **No migration in this
-- repo creates that constraint** — the whole migration set declares the column
-- nullable (20260515030000 adds it as a bare `UUID REFERENCES …`), so the
-- PGlite replay every db test runs against has it nullable too. Measured
-- 2026-09-06 with `pg_attribute.attnotnull` against prod: user_id = true,
-- rationale = true, granted_by = false.
--
-- The consequence is the whole reason this line exists: every vendor SKU comp
-- would raise 23502 in production while the entire local db suite stayed green,
-- because the replay has no NOT NULL to violate. A feature that cannot run
-- once, and no test on this machine can see it.
--
-- 🔑 NULLABLE IS THE DECLARED INTENT, SO PROD IS THE HALF THAT IS WRONG. This
-- brings production back to the schema-as-code rather than weakening a
-- constraint anyone designed, exactly as 20271208517365 did for `granted_by` —
-- the same drift, on the same table, found the same way. `comp_grants` holds
-- zero rows in production, so nothing is at risk.
--
-- ⚠ `rationale` carries the identical undocumented prod NOT NULL and is NOT
-- touched here: every writer supplies it, so it is drift without a defect.
-- Reconciling it belongs with the schema-drift guard work, not with a feature.
--
-- No-op where the column is already nullable (the replay, any fresh database).
ALTER TABLE public.comp_grants
  ALTER COLUMN user_id DROP NOT NULL;
