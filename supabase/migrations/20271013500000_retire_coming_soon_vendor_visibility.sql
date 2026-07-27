-- ============================================================================
-- Retire `coming_soon` as a PUBLIC vendor-visibility state.
--
-- OWNER RULING 2026-07-27, verbatim: "no. we only show shops that are ready."
-- followed by "demote. remove coming soon entirely."
--
-- This supersedes iteration 0006 Decision 6 (2026-05-15), which introduced
-- `coming_soon` precisely so a named-but-unverified shop WOULD appear in the
-- marketplace ("listed but not bookable") and couples could watch the vendor
-- pool grow. That intent is now rejected: a shop is private until it is ready.
--
-- ---------------------------------------------------------------------------
-- WHY THIS IS A PRIVACY FIX, NOT A TIDY-UP
-- ---------------------------------------------------------------------------
-- `/explore` has always ALSO filtered `verification_state = 'verified'` in the
-- application query, so an unverified shop never rendered in the UI. But
-- `vendor_profiles_public_read` — the RLS policy, i.e. the actual security
-- boundary — admitted BOTH 'coming_soon' AND 'verified' and never looked at
-- `verification_state` at all. The app filter was cosmetic; the row was not
-- protected.
--
-- Verified against production on 2026-07-27 with nothing but the publishable
-- anon key:
--
--   GET /rest/v1/vendor_profiles?select=business_name,contact_email,contact_phone
--   → [{"business_name":"SetnaProd","contact_email":"…","contact_phone":"+639…",
--      "public_visibility":"coming_soon","verification_state":"unverified"}]
--
-- An unapproved vendor's business name, contact email and phone number were
-- readable by anyone holding a key that ships in the browser bundle. Narrowing
-- the policy is therefore the load-bearing change here; the code cleanup that
-- accompanies it is secondary.
--
-- ---------------------------------------------------------------------------
-- WHAT THIS MIGRATION DOES NOT DO — AND WHY
-- ---------------------------------------------------------------------------
-- It does NOT drop 'coming_soon' from the `vendor_public_visibility` ENUM.
-- PostgreSQL cannot remove a value from an enum in place; it requires building
-- a replacement type and re-pointing every dependent object. Here that means
-- dropping and recreating the `vendor_market_stats` VIEW (the marketplace's
-- primary read path), the `vendor_profiles_public_read` POLICY, and
-- `vendor_profiles_public_visibility_idx` — a genuinely risky sequence whose
-- only benefit, once no code path can write the value and no reader treats it
-- as public, is cosmetic. The value is left in the type as an inert historical
-- label. `select-column-scan`-style guard: `lib/vendor-visibility.test.ts`
-- fails if 'coming_soon' re-enters the public surface set.
-- ============================================================================

-- ── 1. The security boundary ────────────────────────────────────────────────
-- Public readers get VERIFIED-and-verified only. Both columns are required:
-- `public_visibility` is marketplace listing state (admin/fraud moderation),
-- `verification_state` is the readiness decision. Requiring both means no
-- single mis-set column can expose an unapproved shop, and it makes the RLS
-- boundary agree with the /explore query instead of trailing it.
--
-- Owners keep full access via `vendor_profiles_owner` (user_id = auth.uid()),
-- team members via `vendor_profiles_member_read`, and every admin surface
-- reads through the service role, which bypasses RLS entirely — so this
-- narrowing removes nobody's legitimate access.
DROP POLICY IF EXISTS vendor_profiles_public_read ON public.vendor_profiles;

CREATE POLICY vendor_profiles_public_read
  ON public.vendor_profiles
  FOR SELECT
  TO anon, authenticated
  USING (
    public_visibility = 'verified'::public.vendor_public_visibility
    AND verification_state = 'verified'::public.vendor_verification_state
  );

-- ── 2. New shops start PRIVATE ──────────────────────────────────────────────
-- Was DEFAULT 'coming_soon' (20260515005000), which under the old policy meant
-- a bare `INSERT INTO vendor_profiles (user_id)` — exactly what the signup
-- trigger and /open-shop both do — created a publicly-readable row before the
-- vendor had typed anything. 'hidden' is the correct resting state for a shop
-- that has not been approved.
ALTER TABLE public.vendor_profiles
  ALTER COLUMN public_visibility SET DEFAULT 'hidden'::public.vendor_public_visibility;

-- ── 3. Migrate rows off the retired value ───────────────────────────────────
-- 'hidden' rather than 'verified': these rows were never approved, and the
-- ruling is that unapproved shops stay private. A vendor who should be live
-- gets there through /admin/verify, which sets both columns together.
UPDATE public.vendor_profiles
   SET public_visibility = 'hidden'::public.vendor_public_visibility,
       updated_at = NOW()
 WHERE public_visibility = 'coming_soon'::public.vendor_public_visibility;

COMMENT ON COLUMN public.vendor_profiles.public_visibility IS
  'Marketplace listing state. hidden (default, and the demote/reject/un-freeze '
  'target) · verified (the ONLY publicly-readable value) · archived. '
  'coming_soon is RETIRED (owner 2026-07-27, "we only show shops that are '
  'ready") — retained in the enum only because a value cannot be dropped from '
  'a PG enum in place; nothing may write it.';

-- ── 4. Re-point the self-grant guard at the NEW default ─────────────────────
-- ⚠ WITHOUT THIS, STEP 2 BREAKS VENDOR REGISTRATION OUTRIGHT.
--
-- `guard_vendor_profiles_entitlement` (20271004444950) pins the trust columns on
-- the INSERT branch to their COLUMN DEFAULTS verbatim, so a self-created profile
-- can never arrive pre-verified or pre-visible. It hardcoded
-- 'coming_soon' — the default at the time — and raises `insufficient_privilege`
-- on anything else. Changing the default to 'hidden' in step 2 therefore makes
-- every ordinary `INSERT INTO vendor_profiles (user_id)` (the signup trigger AND
-- /open-shop) fail 42501: no vendor could register at all.
--
-- Caught by tests/db/vendor-addon-selfgrant-guard.db.test.ts ("ordinary vendor
-- REGISTRATION still succeeds (the INSERT branch defaults)"), which is precisely
-- the failure that migration's own comment warned about: "Getting either wrong
-- would reject ordinary vendor registration."
--
-- Body is byte-identical to 20271004444950 except the one literal. Re-stated in
-- full because CREATE OR REPLACE has no partial form.
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
      THEN
        RAISE EXCEPTION
          'vendor_profiles tier/seat/add-on/trust columns are not writable by the vendor (self-grant blocked)'
          USING ERRCODE = 'insufficient_privilege',
                HINT = 'Tier, paid seats, paid add-ons, verification and public visibility are granted by the admin console or the paid activation path (service_role).';
      END IF;
    ELSE  -- UPDATE
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
      THEN
        RAISE EXCEPTION
          'vendor_profiles tier/seat/add-on/trust columns are not writable by the vendor (self-grant blocked)'
          USING ERRCODE = 'insufficient_privilege',
                HINT = 'Tier, paid seats, paid add-ons, verification and public visibility are granted by the admin console or the paid activation path (service_role).';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
