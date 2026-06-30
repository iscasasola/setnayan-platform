/**
 * Sign-in rail — the right (desktop) / bottom-sheet (mobile) frosted obsidian
 * panel of the redesigned /login surface. Carries the entire auth form.
 *
 * Server component: the email+password form is wired to the existing
 * `signInWithPassword` server action and the OAuth rows are server-action forms,
 * so this whole subtree renders on the server and is passed as a child to the
 * client LoginOverlay (intercepted modal) OR rendered directly on the standalone
 * page. The wrapper owns motion + a11y; the rail owns the form.
 *
 * PRESERVED per [[feedback_setnayan_button_preservation]] / the prior
 * /login/page.tsx SCOPE note:
 *   - signInWithPassword action + field names/ids/autocomplete/required.
 *   - OAuth-first placement (PR #422) above the "or continue with email" rule.
 *   - "Stay signed in" (default checked) + "Forgot password?" + "Create one".
 * The magic-link "email me a one-time link" line in the mockup is intentionally
 * NOT rendered — the provider set is locked to email+password + Google/Apple
 * (owner 2026-06-15); re-adding magic-link would reverse that lock.
 */
import Link from 'next/link';
import { SubmitButton } from '@/app/_components/submit-button';
import { OAuthButtonRow } from '@/app/_components/oauth-button-row';
import { DesktopOAuthButtons } from '@/app/_components/desktop-oauth-buttons';
import { LoginLoadingBridge } from './login-loading-bridge';
import { PasswordField } from './password-field';
import { signInWithPassword } from '../actions';
import type { LoginView } from './login-data';

export function SignInRail({
  errorMessage,
  justSignedUpEmail,
  readyEmail,
  prefilledEmail,
  next,
  signupHref,
  showOAuth,
  desktopOAuth,
}: Omit<LoginView, 'heroImageUrl'>) {
  return (
    <div className="sn-login-rail-inner">
      <div className="sn-login-rail-head">
        <h2 className="sn-login-rail-title">Sign in</h2>
        <p className="sn-login-rail-welcome">
          Welcome back — your memories are right where you left them.
        </p>
      </div>

      {errorMessage ? (
        <p role="alert" className="sn-login-banner sn-login-banner--error">
          {errorMessage}
        </p>
      ) : null}

      {justSignedUpEmail ? (
        <p role="status" className="sn-login-banner">
          Account created. We sent a confirmation link to{' '}
          <span className="sn-login-banner-em">{justSignedUpEmail}</span> — open it to
          finish, then sign in below.
        </p>
      ) : null}

      {readyEmail ? (
        <p role="status" className="sn-login-banner">
          Your account is ready. Sign in below with{' '}
          <span className="sn-login-banner-em">{readyEmail}</span>.
        </p>
      ) : null}

      {/* OAuth-first (PR #422), dark treatment for the obsidian rail. */}
      {showOAuth ? (
        desktopOAuth ? (
          <DesktopOAuthButtons next={next} variant="dark" />
        ) : (
          <OAuthButtonRow next={next} variant="dark" />
        )
      ) : null}

      {showOAuth ? (
        <div className="sn-login-divider">
          <span className="sn-login-divider-line" aria-hidden />
          <span className="sn-login-divider-label">or continue with email</span>
          <span className="sn-login-divider-line" aria-hidden />
        </div>
      ) : null}

      <form action={signInWithPassword} className="sn-login-form">
        {/* Brand "thinking" overlay during sign-in (boot moment). */}
        <LoginLoadingBridge />
        <input type="hidden" name="next" value={next} />

        <div className="sn-login-field">
          <label htmlFor="email" className="sn-login-label">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="you@setnayan.com"
            defaultValue={prefilledEmail}
            required
            className="sn-login-input"
          />
        </div>

        <PasswordField />

        {/* "Stay signed in" — default CHECKED; unchecking makes the session
            cookies session-only via the server action (shared-device case). */}
        <label htmlFor="remember" className="sn-login-remember">
          <input id="remember" name="remember" type="checkbox" defaultChecked />
          <span>Stay signed in</span>
        </label>

        <SubmitButton className="sn-login-submit" pendingLabel="Signing in…">
          Continue
        </SubmitButton>
      </form>

      <div className="sn-login-tail">
        No account yet?{' '}
        <Link href={signupHref} className="sn-login-tail-link">
          Create one — free
        </Link>
      </div>
    </div>
  );
}
