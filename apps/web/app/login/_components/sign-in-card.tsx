'use client';

/**
 * SignInCard — THE single Setnayan login (owner 2026-07-18 "we only want 1
 * login … that popup and dimming the background anywhere"). This is the light
 * greige "Sign in to Setnayan." card visitors already see from the marketing
 * top-nav; it is now ALSO what renders at /login and in the intercepted overlay,
 * so every entry point shows the same login.
 *
 * Rendered inside a `.home-reskin-ov` > `.hr-ov-card` shell (the greige glass
 * modal). Two shells drive it:
 *   • the marketing nav — OverlayShell in HomeOverlays.tsx (state-driven popup);
 *   • routes — SignInCardModal (/login page + app/@modal/(.)login overlay).
 * Styling is the `.hr-*` set in home-reskin.css, scoped under `.home-reskin-ov`.
 *
 * It renders the SAME OAuth row + email/password form as before, wired to the
 * SAME `signInWithPassword` server action, plus the status banners the /login
 * surface needs (error / check_email / ready) — these are simply absent on the
 * marketing overlay (it always opens on '/'), so the card looks unchanged there.
 *
 * `next` is threaded through (hidden input + OAuth + signup link) so a sign-in
 * reached by a redirect — e.g. bounced off /vendor-dashboard — forwards the user
 * to their destination afterward. The marketing overlay passes next='/', letting
 * the action route to the account home by account_type.
 */
import Link from 'next/link';
import { SubmitButton } from '@/app/_components/submit-button';
import { OAuthButtonRow } from '@/app/_components/oauth-button-row';
import { DesktopOAuthButtons } from '@/app/_components/desktop-oauth-buttons';
import { TurnstileField } from '@/app/_components/auth/turnstile-field';
import { signInWithPassword } from '../actions';

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
}: SignInCardProps) {
  return (
    <>
      <div className="hr-ov-eyebrow">Welcome back</div>
      <h2 className="hr-ov-title">Sign in to Setnayan.</h2>
      <p className="hr-ov-sub">
        One account for couples and vendors. Pick up right where you left off.
      </p>

      {errorMessage ? (
        <p role="alert" className="hr-si-banner hr-si-banner--error">
          {errorMessage}
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

      <form action={signInWithPassword} className="hr-si-form">
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
