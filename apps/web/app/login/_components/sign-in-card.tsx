'use client';

/**
 * SignInCard — THE single Setnayan login (owner 2026-07-18 "we only want 1
 * login … that popup and dimming the background anywhere"). This is the light
 * greige "Sign in to Setnayan." card visitors already see from the marketing
 * top-nav; it is now ALSO what renders at /login (and on any redirect there), so
 * every entry point shows the same login.
 *
 * Rendered inside a `.home-reskin-ov` > `.hr-ov-card` shell (the greige glass
 * modal). Two shells drive it:
 *   • the /login route — SignInCardModal (whole page; REDIRECTS on success);
 *   • every public surface — SignInHerePanel in _components/auth/sign-in-here
 *     (opens OVER the page; STAYS on success — see `onSignedIn` below).
 * Styling is the `.hr-*` set in home-reskin.css, scoped under `.home-reskin-ov`.
 *
 * It renders the SAME OAuth row + email/password form in both, and both wire to
 * the same credential exchange in ../actions — `signInWithPassword` for the
 * route, `signInInPlace` for the panel. The status banners (error / check_email
 * / ready) come from searchParams and so only ever appear on the route.
 *
 * `next` is threaded through (hidden input + OAuth + signup link) so a sign-in
 * reached by a redirect — e.g. bounced off /vendor-dashboard — forwards the user
 * to their destination afterward. The in-place panel passes the URL the person
 * is actually on, which is what brings an OAuth round trip back to the shop
 * they were reading instead of dropping them on the account board.
 */
import { useActionState, useEffect } from 'react';
import Link from 'next/link';
import { SubmitButton } from '@/app/_components/submit-button';
import { OAuthButtonRow } from '@/app/_components/oauth-button-row';
import { DesktopOAuthButtons } from '@/app/_components/desktop-oauth-buttons';
import { TurnstileField } from '@/app/_components/auth/turnstile-field';
import { signInWithPassword, signInInPlace } from '../actions';
import { humanAuthError } from '@/lib/human-auth-error';
import { SIGN_IN_IN_PLACE_INITIAL } from './sign-in-state';

export type SignInCardProps = {
  /** Post-sign-in destination. '/' lets the action route by account_type. */
  next: string;
  /** Signup href, already carrying next/as when present (see getLoginView). */
  signupHref: string;
  showOAuth: boolean;
  desktopOAuth: boolean;
  /** Route-only status banners; null/absent on the marketing overlay. */
  errorMessage?: string | null;
  justSignedUpEmail?: string | null;
  readyEmail?: string | null;
  prefilledEmail?: string;
  /**
   * Called when an in-card link (Forgot password / Create one) navigates away.
   * The marketing overlay passes its onClose so the popup dismisses first; the
   * route shells omit it (navigating unmounts the modal anyway).
   */
  onNavigate?: () => void;
  /**
   * IN-PLACE MODE. Passing this switches the form from `signInWithPassword`
   * (which redirects, whole-page) to `signInInPlace` (which returns), and hands
   * the result back instead of navigating.
   *
   * 🔑 THIS IS THE SEAM. On the public site the page behind the card is the
   * whole point — a shop being read, a half-written enquiry. A redirect on
   * success throws it away, and a redirect on a WRONG PASSWORD throws it away
   * for a typo. In this mode neither happens: the error renders in the card and
   * the caller decides where success goes.
   *
   * It takes no destination ON PURPOSE. In place there is nowhere to send
   * anybody — staying is the feature. Landing on the account board belongs to
   * the /login ROUTE, which really does have nothing behind it.
   */
  onSignedIn?: () => void;
};

export function SignInCard({
  next,
  signupHref,
  showOAuth,
  desktopOAuth,
  errorMessage = null,
  justSignedUpEmail = null,
  readyEmail = null,
  prefilledEmail = '',
  onNavigate,
  onSignedIn,
}: SignInCardProps) {
  const inPlace = Boolean(onSignedIn);
  const [state, submitInPlace] = useActionState(
    signInInPlace,
    SIGN_IN_IN_PLACE_INITIAL,
  );

  // Success is reported by the ACTION, not by the click — a submit that never
  // reached the server must never look like a sign-in.
  useEffect(() => {
    if (state.attempt > 0 && state.ok && onSignedIn) {
      onSignedIn();
    }
  }, [state.attempt, state.ok, onSignedIn]);

  // One banner slot, two sources: the /login route's `?error=` and the in-place
  // action's returned message. They can never both apply — the route surface
  // has no in-place action and the overlay has no searchParams.
  /*
    🔑 ONE GATE FOR EVERY SOURCE. Owner 2026-08-20, screenshotting this exact
    banner reading `{}`: *"a blank error"*. `{}` is a stringified error object
    (`JSON.stringify(new Error(...))` is `'{}'` — an Error's own properties are
    not enumerable), and this line printed whatever string it was handed.

    Messages reach here from at least four places — the /login route's
    `?error=`, the in-place action, the OAuth start action, and the desktop
    loopback — and `?error=` is a QUERY PARAM anyone can type into. Sanitising
    at each producer is four chances to forget and the next producer makes
    five, so it happens HERE, where they all converge.
  */
  const shownError = humanAuthError(inPlace ? state.error : errorMessage);

  return (
    <>
      <div className="hr-ov-eyebrow">Welcome back</div>
      <h2 className="hr-ov-title">Sign in to Setnayan.</h2>
      <p className="hr-ov-sub">
        One account for couples and vendors. Pick up right where you left off.
      </p>

      {shownError ? (
        <p role="alert" className="hr-si-banner hr-si-banner--error">
          {shownError}
        </p>
      ) : null}

      {justSignedUpEmail ? (
        <p role="status" className="hr-si-banner">
          Account created. We sent a confirmation link to{' '}
          <span className="hr-si-banner-em">{justSignedUpEmail}</span> — open it to finish,
          then sign in below.
        </p>
      ) : null}

      {readyEmail ? (
        <p role="status" className="hr-si-banner">
          Your account is ready. Sign in below with{' '}
          <span className="hr-si-banner-em">{readyEmail}</span>.
        </p>
      ) : null}

      {/* OAuth above the email form — same placement + components as before.
          Shell-gated by the caller; desktop gets the loopback variant. */}
      {showOAuth ? (
        <div className="hr-si-oauth">
          {desktopOAuth ? <DesktopOAuthButtons next={next} /> : <OAuthButtonRow next={next} />}
        </div>
      ) : null}

      {showOAuth ? (
        <div className="hr-si-or">
          <span>or continue with email</span>
        </div>
      ) : null}

      <form
        action={inPlace ? submitInPlace : signInWithPassword}
        className="hr-si-form"
      >
        <input type="hidden" name="next" value={next} />
        <TurnstileField action="login" />
        <div className="hr-si-field">
          <label htmlFor="hr-si-email" className="hr-si-label">
            Email
          </label>
          <input
            id="hr-si-email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="you@setnayan.com"
            defaultValue={prefilledEmail}
            required
            className="hr-si-input"
          />
        </div>
        <div className="hr-si-field">
          <label htmlFor="hr-si-password" className="hr-si-label">
            Password
          </label>
          <input
            id="hr-si-password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            required
            className="hr-si-input"
          />
        </div>
        {/* "Stay signed in" defaults CHECKED — explicit opt-out only (the server
            action downgrades sb-* cookies to session-only when unchecked). */}
        <div className="hr-si-row">
          <label htmlFor="hr-si-remember" className="hr-si-remember">
            <input id="hr-si-remember" name="remember" type="checkbox" defaultChecked />
            <span>Stay signed in</span>
          </label>
          <Link href="/forgot-password" className="hr-si-link" onClick={onNavigate}>
            Forgot password?
          </Link>
        </div>
        <SubmitButton className="hr-si-submit" pendingLabel="Signing in…">
          Continue
        </SubmitButton>
      </form>

      <div className="hr-si-foot">
        No account yet?{' '}
        <Link href={signupHref} className="hr-si-link" onClick={onNavigate}>
          Create one, free
        </Link>
      </div>
    </>
  );
}
