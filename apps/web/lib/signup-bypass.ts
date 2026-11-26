/**
 * 🔑 WHO /signup SENDS AWAY (final check A1-056, blocker, 25 Nov 2026).
 *
 * A host starts an event with no account (an anonymous session) and is asked for one at save: "Secure my plan" →
 * `/signup?next=/dashboard`. The page's "already signed in" bypass counted ANY session, the anonymous one included,
 * so it redirected straight back to `next` and the Create account card never drew — the host had no way to save.
 * `signUp` already turns that same anonymous account into a real one (`existingUser?.is_anonymous` in actions.ts).
 * So only a real (non-anonymous) account is sent away; an anonymous one sees the form. Same rule /login uses
 * (`signedIn = Boolean(user && !user.is_anonymous)`).
 */
export function signupShouldBypass(user: { is_anonymous?: boolean | null } | null | undefined): boolean {
  return Boolean(user && !user.is_anonymous);
}
