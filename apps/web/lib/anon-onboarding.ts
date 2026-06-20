/**
 * Anonymous-draft onboarding flag.
 *
 * When ON, a visitor can finish onboarding WITHOUT signing in: the commit
 * action mints a Supabase native anonymous session (a real `auth.uid()`), saves
 * their event under it, and drops them straight into the dashboard. Sign-in
 * becomes an optional "secure your plan" step that converts the SAME anonymous
 * uid into a permanent account (no claim/merge — the event was always theirs).
 *
 * Default OFF. Going live needs two owner actions the code can't do:
 *   1. Enable `enable_anonymous_sign_ins` in the Supabase Auth dashboard.
 *   2. Apply the null-email-tolerant `handle_new_auth_user` trigger migration
 *      (anonymous users have no email; the pre-existing trigger would crash the
 *      NOT NULL insert into public.users).
 * …then set NEXT_PUBLIC_ANON_ONBOARDING_ENABLED=true.
 *
 * NEXT_PUBLIC_ so the onboarding client (which drops the account-gate screen
 * from the flow) and the server actions read the SAME flag — one source of
 * truth, no client/server drift.
 */
export function anonOnboardingEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ANON_ONBOARDING_ENABLED === 'true';
}
