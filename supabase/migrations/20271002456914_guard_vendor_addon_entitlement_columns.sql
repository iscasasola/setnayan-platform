-- guard_vendor_addon_entitlement_columns
-- ============================================================================
-- SECURITY FIX — close a live SELF-GRANT hole on the paid ADD-ON entitlement
-- columns of public.vendor_profiles.
--
-- ── THE HOLE ────────────────────────────────────────────────────────────────
-- `vendor_profiles_owner` (20260513120000:62-67) is:
--     FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (...)
-- Postgres RLS is ROW-level, never COLUMN-level, and there is no column-scoped
-- GRANT/REVOKE on this table. So an authenticated vendor may PATCH ANY column of
-- their OWN row through PostgREST unless a trigger says otherwise.
--
-- `guard_vendor_profiles_entitlement` (20270920020000) exists for exactly that
-- reason — but it guards only THREE columns: tier_state, tier_expires_at,
-- extra_agent_seats. The four PAID ADD-ON columns added later were never added
-- to it, so today a vendor can simply:
--
--     PATCH /rest/v1/vendor_profiles?user_id=eq.<self>
--     { "booth_addon_expires_at": "2099-01-01", "ai_addon_expires_at": "2099-01-01",
--       "ai_addon_trial_used_at": null,          "booth_addon_trial_used_at": null }
--
--   • booth_addon_expires_at  → a FREE branded 3D booth in their couples' live
--     published 3D Plans (isVendor3dBoothActive → boothIsBranded), AND the
--     vendor-unlock path for the couple's 3D Plan
--     (vendor-3d-plan-unlock-actions.ts:86). Worth ₱1,500–2,000 / 28 days.
--   • ai_addon_expires_at     → a FREE Vendor AI add-on window
--     (isVendorAiAddonActive → the auto-reply engine's `no_addon` gate).
--     Worth ₱1,500–2,000 / 28 days.
--   • *_trial_used_at → NULL  → re-arms the ONE-TIME free first cycle, on demand,
--     forever. This also defeats the atomic `WHERE … IS NULL` trial claims in
--     ai-addon-actions.ts / booth-addon-actions.ts, whose whole safety argument
--     is that the marker is write-once.
--
-- This is a REVENUE hole, not a data-exposure one: no other vendor's row is
-- reachable (the USING clause still pins user_id = auth.uid()).
--
-- ── THE FIX ────────────────────────────────────────────────────────────────
-- Extend the SAME guard to the four add-on columns, in both the INSERT
-- (DELETE + re-INSERT self-elevation) and UPDATE branches. Verified safe: every
-- legitimate writer of these columns is the SERVICE-ROLE client, which does not
-- match `current_user IN ('authenticated','anon')` —
--     apps/web/app/vendor-dashboard/subscription/ai-addon-actions.ts:179   (admin)
--     apps/web/app/vendor-dashboard/subscription/booth-addon-actions.ts:246,256 (admin)
--     apps/web/lib/sku-activation.ts  (ctx.admin, the paid activation hooks)
-- …and `public.is_admin()` still exempts the admin console.
--
-- A plain profile edit (business_name, logo, …) keeps every guarded column
-- = OLD, so this no-ops on the real path.
--
-- IDEMPOTENT: CREATE OR REPLACE of the function only; the trigger binding from
-- 20270920020000:125-129 is unchanged and is NOT re-created here.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.guard_vendor_profiles_entitlement()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') AND NOT public.is_admin() THEN
    IF TG_OP = 'INSERT' THEN
      -- A non-privileged writer may only create a row at the 'free' default with
      -- no expiry, ZERO paid extra seats, and NO paid add-on window or spent
      -- trial marker. Legitimate registration (app/open-shop/actions.ts) inserts
      -- {user_id} only via the service-role admin client, so this never fires on
      -- the real path; it closes the DELETE+re-INSERT self-elevation vector.
      IF NEW.tier_state IS DISTINCT FROM 'free'::public.vendor_tier_state
         OR NEW.tier_expires_at IS NOT NULL
         OR NEW.extra_agent_seats IS DISTINCT FROM 0
         OR NEW.ai_addon_expires_at IS NOT NULL
         OR NEW.ai_addon_trial_used_at IS NOT NULL
         OR NEW.booth_addon_expires_at IS NOT NULL
         OR NEW.booth_addon_trial_used_at IS NOT NULL
      THEN
        RAISE EXCEPTION
          'vendor_profiles tier/seat/add-on entitlement columns are not writable by the vendor (self-grant blocked)'
          USING ERRCODE = 'insufficient_privilege',
                HINT = 'Tier, paid seat and paid add-on changes go through the admin console or the paid activation path (service_role).';
      END IF;
    ELSE  -- UPDATE
      -- A plain profile edit (business_name, logo, …) keeps every guarded column
      -- = OLD, so this no-ops; only a self-grant of tier, expiry, paid extra
      -- seats, or a paid add-on window / trial marker is blocked.
      IF NEW.tier_state IS DISTINCT FROM OLD.tier_state
         OR NEW.tier_expires_at IS DISTINCT FROM OLD.tier_expires_at
         OR NEW.extra_agent_seats IS DISTINCT FROM OLD.extra_agent_seats
         OR NEW.ai_addon_expires_at IS DISTINCT FROM OLD.ai_addon_expires_at
         OR NEW.ai_addon_trial_used_at IS DISTINCT FROM OLD.ai_addon_trial_used_at
         OR NEW.booth_addon_expires_at IS DISTINCT FROM OLD.booth_addon_expires_at
         OR NEW.booth_addon_trial_used_at IS DISTINCT FROM OLD.booth_addon_trial_used_at
      THEN
        RAISE EXCEPTION
          'vendor_profiles tier/seat/add-on entitlement columns are not writable by the vendor (self-grant blocked)'
          USING ERRCODE = 'insufficient_privilege',
                HINT = 'Tier, paid seat and paid add-on changes go through the admin console or the paid activation path (service_role).';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.guard_vendor_profiles_entitlement() IS
  'Self-grant guard for public.vendor_profiles. RLS is row-level only and vendor_profiles_owner is FOR ALL with no column scoping, so every PAID column needs an explicit trigger check here. Guards: tier_state, tier_expires_at, extra_agent_seats (20270920020000) + ai_addon_expires_at, ai_addon_trial_used_at, booth_addon_expires_at, booth_addon_trial_used_at (20271002456914). ⚠ ADD EVERY NEW PAID ENTITLEMENT COLUMN HERE — an unguarded one is vendor-writable through PostgREST the day it ships.';

COMMIT;
