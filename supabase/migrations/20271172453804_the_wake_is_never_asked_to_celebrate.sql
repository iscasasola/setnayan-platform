-- ============================================================================
-- the_wake_is_never_asked_to_celebrate
--
-- The funeral (live since 2026-08-24, migration 20271163083797) shipped with
-- `event_type_profiles.onboarding_flow_key` NULL — the only enabled type with no
-- value in that column. `resolveOnboardingFlow` read NULL as the pack key
-- 'generic', so anything authored FOR a funeral was unreachable, while
-- /admin/event-types/funeral/onboarding (which already falls back to the event
-- type) showed HQ a pack the visitor was never given.
--
-- This sets the column to match every other type. The application-side fallback
-- was corrected in the same change (lib/onboarding/flow-config.ts), so the fix
-- does not depend on this migration having been applied — belt and braces, the
-- same posture FUNERAL_PROFILE already takes for the solemn register.
--
-- DATA ONLY. No DDL, no policy, no grant. Idempotent (guarded UPDATE).
--
-- ⚠ WHAT THIS MIGRATION DOES **NOT** CARRY, deliberately: the wake's quiz and
-- reveal wording. `event_type_onboarding.axis_overrides` / `reveal_overrides`
-- would hold it, and `getOnboardingSpec` degrades to the code defaults on any
-- read error — so on a hiccup a bereaved family would be asked "How big does it
-- feel? Grand & full-house — the more the merrier" and handed a card reading
-- "The Grand Celebration". That copy lives in apps/web/lib/onboarding/
-- solemn-content.ts, keyed on the REGISTER, where nothing can fail it open.
-- An admin override still layers on top; it just cannot lose the base.
-- ============================================================================

UPDATE public.event_type_profiles
   SET onboarding_flow_key = 'funeral',
       updated_at = now()
 WHERE event_type = 'funeral'
   AND onboarding_flow_key IS DISTINCT FROM 'funeral';
