import Link from 'next/link';

/**
 * OAuthTermsLine — the agreement said on the Google / Apple path of a SIGN-UP door (sweep C9, 2026-10-19).
 *
 * The email path carries the clickwrap box ("I agree to the Terms and Privacy Policy", unticked, required — `signUp`
 * refuses without it). The Google / Apple buttons above it never passed that box, and the box is marked
 * `data-password-only`, so the typed-Google-address door folds it away too: on the OAuth path the agreement was
 * stated NOWHERE. This one line says it where that tap happens. Words, not a second checkbox — the provider's own
 * consent screen is the next thing the person sees, and the store-review pattern for "Continue with" is exactly this.
 *
 * No hooks: it renders in the server-rendered /signup card and inside the client `GoogleAddressDoor` alike.
 * Guard: `lib/one-oauth-wording.test.ts` (every sign-up door mounts it beside its Google / Apple row).
 */
export function OAuthTermsLine() {
  return (
    <p data-oauth-terms="" className="mt-2.5 text-center text-xs leading-relaxed text-ink/55">
      By continuing with Google or Apple, you agree to the{' '}
      <Link href="/terms" className="underline underline-offset-2 hover:text-ink">
        Terms
      </Link>{' '}
      and{' '}
      <Link href="/privacy" className="underline underline-offset-2 hover:text-ink">
        Privacy Policy
      </Link>
      .
    </p>
  );
}
