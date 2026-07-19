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

/**
 * Domain stamped onto the placeholder email the auth-user trigger gives an
 * anonymous user (`anon+<uuid>@anon.setnayan.local`). Non-routable by design.
 */
export const ANON_EMAIL_DOMAIN = '@anon.setnayan.local';

/**
 * True when an email is the non-routable placeholder an anonymous user carries
 * until they secure their account. Used to (a) suppress outbound transactional
 * email that would bounce, and (b) avoid rendering the ugly placeholder in the UI.
 */
export function isPlaceholderEmail(email: string | null | undefined): boolean {
  return !!email && email.endsWith(ANON_EMAIL_DOMAIN);
}
