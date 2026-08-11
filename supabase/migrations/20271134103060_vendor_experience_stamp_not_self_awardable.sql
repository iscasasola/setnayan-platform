-- ============================================================================
-- A SHOP CANNOT AWARD ITSELF THE MARK THAT SAYS SETNAYAN CHECKED IT.
-- ============================================================================
--
-- Fourth instance today of one shape: a policy that says "this row is yours"
-- (`vendor_profiles_owner`, PERMISSIVE FOR ALL on `user_id = auth.uid()`) never
-- had an opinion about what is IN the row, and a field recording SOMEBODY
-- ELSE'S decision was left writable. Siblings: 20271132839561 (chat sender),
-- 20271132843141 (broadcast sender), 20271132891176 (self-promotion to admin).
--
-- ── WHAT WAS POSSIBLE (measured in the full-corpus replay, pre-fix) ────────
--   1. A vendor UPDATEs their own row setting experience_verified_at +
--      experience_verified_by → ACCEPTED.
--   2. An admin stamps the shop; the vendor then changes
--      in_business_since_year → ACCEPTED, and the stamp SURVIVES.
--
-- (1) puts a green check on the public shop page. `app/v/[slug]/page.tsx:901`
-- derives `verified` from this column and renders the badge; the canonical
-- bare-root shop URL renders through the same path. Its tooltip tells couples
-- the years-in-business figure was checked against the vendor's government
-- business registration. Nobody checked anything. It also hides the
-- Confirm-against-DTI control on our own /admin/verify screen, so the staff
-- member reviewing that shop is told the check is already done.
--
-- (2) is the quieter half and was found by the planning pass, not the sweep:
-- the app clears the stamp when the year changes
-- (vendor-dashboard/actions.ts:637), but that is an APP courtesy. A vendor
-- PATCHing the year directly kept the stamp, so the badge attested to a number
-- the admin had never seen. The clear is now enforced by the database.
--
-- ── WHY THE GUARD MISSED IT ───────────────────────────────────────────────
-- `guard_vendor_profiles_entitlement` already fires BEFORE INSERT OR UPDATE —
-- the verbs were covered this time. What was wrong is the LIST. It blocks ten
-- columns and its own comment calls two of them "Trust columns"; three more
-- trust columns were never added when they shipped
-- (experience_verified_at / _by in 20270209420471, described there as "purely
-- additive"). A deny-list is a bill you have to keep paying, and this is the
-- payment that was missed.
--
-- ── WHY A TRIGGER AND NOT A GRANT REVOKE ──────────────────────────────────
-- The two sibling migrations revoked the column grant. That is wrong HERE: the
-- vendor's own session legitimately NAMES these columns — the year-change
-- auto-unverify writes `experience_verified_at = NULL` through the caller's
-- RLS client. Postgres checks column privileges against the columns NAMED in
-- the statement, not the values, so a revoke would break every year edit while
-- looking like a clean security win. The trigger can tell the two apart:
-- clearing to NULL is allowed, setting a value is not.
--
-- (The structural fix — the events-style computed all-columns-minus-deny-set
-- grant for this very wide table — is worth doing, and is deliberately NOT
-- smuggled in here. It needs its own PR and its own app change.)
--
-- Nothing about the ADMIN path changes: verifyVendorExperience() in
-- app/admin/verify/actions.ts uses the service-role client, and the guard's
-- outer condition already exempts anything that is not an end-user session.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.guard_vendor_profiles_entitlement()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
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
      THEN
        RAISE EXCEPTION
          'vendor_profiles tier/seat/add-on/trust columns are not writable by the vendor (self-grant blocked)'
          USING ERRCODE = 'insufficient_privilege',
                HINT = 'Tier, paid seats, paid add-ons, verification, public visibility and the experience check are granted by the admin console or the paid activation path (service_role).';
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
      THEN
        RAISE EXCEPTION
          'vendor_profiles tier/seat/add-on/trust columns are not writable by the vendor (self-grant blocked)'
          USING ERRCODE = 'insufficient_privilege',
                HINT = 'Tier, paid seats, paid add-ons, verification, public visibility and the experience check are granted by the admin console or the paid activation path (service_role).';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.guard_vendor_profiles_entitlement() IS
  'Neutralises self-granted entitlement and TRUST columns on vendor_profiles for '
  'end-user sessions. Trust set: verification_state, public_visibility, '
  'experience_verified_at/_by, last_verified_at. The experience mark may be '
  'cleared but never set, because the vendor''s own year-change path clears it; '
  'and a year change now clears it in the database rather than relying on the '
  'app to do so. Migration 20271134103060.';

COMMENT ON COLUMN public.vendor_profiles.experience_verified_at IS
  'When an admin confirmed in_business_since_year against the vendor''s DTI '
  'registration. Renders the green check on the public shop page. Set ONLY by '
  '/admin/verify (service-role); guard_vendor_profiles_entitlement refuses any '
  'end-user session that tries to set it, and clears it automatically when '
  'in_business_since_year changes.';
