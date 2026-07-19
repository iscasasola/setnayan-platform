/**
 * Onboarding V2 "brief" flag (2026-07-13 · the profile-prefill Event Brief).
 *
 * When ON, onboarding reads the four self-consented profile facts (religion,
 * civil status, birthdate, gender) and PREFILLS / skips the per-type questions
 * they already answer — "we already have their religion and status and age and
 * gender; don't ask for them again unless they're still missing" (owner,
 * 2026-07-13). OFF (default) keeps every onboarding flow byte-identical: no
 * prefill, every question rendered exactly as today.
 *
 * NEXT_PUBLIC_ so the onboarding client shells and their server commit actions
 * read the SAME flag — one source of truth, no client/server drift. Inlined at
 * build time.
 *
 * Default OFF. To enable: set NEXT_PUBLIC_ONBOARDING_V2_BRIEF_ENABLED=true in
 * .env.local (dev) / Vercel (preview·prod). No migration — it prefills from
 * columns that already exist on `public.users`.
 *
 * Scope guard: this flag governs SELF-profile prefill only. Dependent-subject
 * prefill (debutante gender/birthdate, etc.) stays behind the separate,
 * counsel-gated NEXT_PUBLIC_DEPENDENT_PEOPLE flag and is never unlocked by this.
 */
export function onboardingV2BriefEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ONBOARDING_V2_BRIEF_ENABLED === 'true';
}
