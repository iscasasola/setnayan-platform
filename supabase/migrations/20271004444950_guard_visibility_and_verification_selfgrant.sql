-- guard_visibility_and_verification_selfgrant
-- ============================================================================
-- SECURITY FIX — a vendor could mark THEMSELVES verified, and un-do a fraud
-- suspension, with one PostgREST request.
--
-- ── THE HOLE ────────────────────────────────────────────────────────────────
-- Same root cause as 20271002456914: `vendor_profiles_owner`
-- (20260513120000:62-67) is `FOR ALL TO authenticated USING (user_id = auth.uid())`,
-- Postgres RLS is ROW-level (never COLUMN-level), and there is no column-scoped
-- GRANT — so a column that `guard_vendor_profiles_entitlement` does not NAME is
-- vendor-writable. That guard covers tier/seats and the add-on windows, but not
-- the two TRUST columns:
--
--     PATCH /rest/v1/vendor_profiles?user_id=eq.<self>
--     { "verification_state": "verified", "public_visibility": "verified" }
--
--   • `verification_state='verified'` → the PUBLIC "Verified" trust badge
--     (`is_verified` at app/v/[slug]/page.tsx:397, :1070) and the verified-only
--     gates across the marketplace. This is a TRUST/SAFETY issue, not merely a
--     revenue one: the badge is what tells a couple this business was checked.
--   • `public_visibility='verified'` → restores marketplace visibility, which
--     REVERSES an admin visibility freeze applied to a suspended/fraudulent
--     vendor (admin/verify/actions.ts drives both columns together).
--
-- ── SAFETY OF LOCKING BOTH ─────────────────────────────────────────────────
-- Audited: EVERY writer of either column lives under `apps/web/app/admin/`
-- (admin/verify/actions.ts, admin/vendors/actions.ts) — i.e. the admin console
-- and service-role paths. There is NO vendor-facing write path for either, so
-- locking them breaks nothing a vendor legitimately does. `public.is_admin()`
-- still exempts the console, and service_role never matches
-- `current_user IN ('authenticated','anon')`.
--
-- An ordinary profile edit (business_name, logo, …) keeps both columns = OLD and
-- therefore no-ops through this guard.
--
-- IDEMPOTENT: CREATE OR REPLACE of the function only; the trigger binding from
-- 20270920020000:125-129 is unchanged and is NOT re-created here.
-- ============================================================================

BEGIN;

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
         -- and 'coming_soon' (20260515005000:64-65, NOT 'hidden') — and both are
         -- ENUMs, so they are cast explicitly. Getting either wrong would reject
         -- ordinary vendor registration.
         OR NEW.verification_state
              IS DISTINCT FROM 'unverified'::public.vendor_verification_state
         OR NEW.public_visibility
              IS DISTINCT FROM 'coming_soon'::public.vendor_public_visibility
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

COMMENT ON FUNCTION public.guard_vendor_profiles_entitlement() IS
  'Self-grant guard for public.vendor_profiles. RLS is row-level only and vendor_profiles_owner is FOR ALL with no column scoping, so every PRIVILEGED column needs an explicit trigger check here. Guards: tier_state, tier_expires_at, extra_agent_seats (20270920020000) + the four add-on window/trial columns (20271002456914) + ai_addon_level (20271003111715) + verification_state, public_visibility (20271004444950 — the public trust badge and the admin visibility freeze). ⚠ ADD EVERY NEW PRIVILEGED COLUMN HERE — an unguarded one is vendor-writable through PostgREST the day it ships.';

COMMIT;
