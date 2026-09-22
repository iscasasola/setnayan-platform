/**
 * /signup — the SAME small card as sign-in (owner 2026-09-22, verbatim: "small
 * card for signup"; prototype `one_door_FINAL_2026-09-22.html`, approved).
 *
 * ── WHAT THIS REPLACES, AND WHY ──────────────────────────────────────────────
 * Until 2026-09-22 this was the v2.1 two-panel composition: a brand panel (the
 * wordmark, "Set your day in motion.", four benefit bullets, one of them a live
 * vendor count) beside an 11-field form. Measured on setnayan.com that day:
 * 136 words for a couple, 107 for a vendor, against the sign-in popup's 44.
 * The owner's complaint across the site was too much text and a scattered
 * flow; his ruling on the prototype was one door — sign in and create account
 * are the same card, and the things this page used to ask for move to where
 * they belong:
 *   • first name / last name → the "You" card (`/signup/you`), right after the
 *     account exists, with the @account name, the formal name and the phone;
 *   • the Public Event Summary (Stories) consent → asked when an EVENT is
 *     created, per event, in words that name the event type (owner
 *     2026-09-22: "why is it asking about wedding? we have multiple events").
 *     Until that build lands, the consent is still given on the event's own
 *     privacy page (`/dashboard/[eventId]/website/privacy`), which already
 *     reads and writes the same column. The field's name, value and the eight
 *     RA 10173 guardrails (2026-05-19) are unchanged; only WHEN moves.
 *   • the brand panel, the bullets and the "RA 10173 compliant" line → gone
 *     from this screen; /privacy carries the promise.
 * Removed, and listed so the removal is visible: the `<Wordmark>` panel, the
 * `benefitBullets` (and the `getVerifiedVendorMarketplaceCount` read that fed
 * one of them), `first_name`, `last_name`, `public_summary_consent`. The
 * contract test (`signup-contract.test.ts`) moved with them, deliberately.
 *
 * ── WHAT STAYS, EXACTLY ──────────────────────────────────────────────────────
 * The `signUp` server action and every field it still reads: `account_type`
 * (one hidden input, the value the URL decided — owner-locked 2026-09-20,
 * `lib/signup-intent.ts`), `next`, `ref` / `src_event` (guest → host
 * attribution), `refc` (couple referral), `email`, `password`, the Terms box
 * (CTRL-B3, unticked, required, above the submit — `lib/terms-agreement.ts`),
 * `remember`, and the Turnstile bot check inside the form. The OAuth row above
 * the email form, shell-gated exactly as /login gates it. The status banners
 * (error · confirmation sent · guest photos will be saved · a couple invited
 * you). The signed-in bypass. `?prefill_email=` for the vendor-claim flows.
 *
 * ── THE SHELL ────────────────────────────────────────────────────────────────
 * The greige card /login wears (`.home-reskin-ov` › `.hr-ov-card.sn-signin-terra`,
 * the `.hr-si-*` set in home-reskin.css) over the paper base /login uses, so a
 * hard load of /signup and the sign-in popup are visibly one thing. The door
 * register this page wore until today (paper card, 3px terracotta top edge) is
 * retired here — `doors-are-designed.test.ts` had this file on its clone bill
 * for exactly that shape, and the line is deleted with it.
 */
import Link from 'next/link';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { SubmitButton } from '@/app/_components/submit-button';
import { ANY_OAUTH_ENABLED, OAuthButtonRow } from '@/app/_components/oauth-button-row';
import { DesktopOAuthButtons } from '@/app/_components/desktop-oauth-buttons';
import { getClientShell } from '@/lib/request-platform';
import { safeNext } from '@/lib/auth';
import { accountHomePath } from '@/lib/account-security';
import { createClient } from '@/lib/supabase/server';
import { readGuestSession } from '@/lib/guest-session';
import { accountTypeForSignup } from '@/lib/signup-intent';
import { signUp } from './actions';
import { TurnstileField } from '@/app/_components/auth/turnstile-field';
import { TERMS_FIELD, TERMS_REQUIRED_MESSAGE } from '@/lib/terms-agreement';
import '@/app/_components/home/home-reskin.css';

export const metadata: Metadata = {
  title: 'Create account',
  description:
    'Create a Setnayan account in seconds. Free to start for anyone planning a celebration. Free baseline listing for Filipino suppliers.',
  alternates: { canonical: '/signup' },
};

const ERROR_COPY: Record<string, string> = {
  missing: 'Please enter both an email and a password.',
  password_too_short: 'Password must be at least 8 characters.',
  terms_required: TERMS_REQUIRED_MESSAGE,
  password_leaked:
    'This password has appeared in a known data breach. Please choose a different one — it only takes a moment and it protects your account.',
  blacklisted:
    'This email cannot be used to create a Setnayan account. Please use a different email, or contact support if you think this is a mistake.',
};

type SearchParams = Promise<{
  error?: string;
  sent?: string;
  next?: string;
  as?: string;
  /** Pre-fill the email field — used by /vendor/claim/[token]?as=vendor flows
   *  per iteration 0006 § Invite-to-Setnayan, locked 2026-05-19. */
  prefill_email?: string;
  /** Guest → host growth-loop attribution (`/signup?ref=guest&src_event=<public_id>`). No PII. */
  ref?: string;
  src_event?: string;
  /** Couple referral rewards (`/signup?refc=<code>`). */
  refc?: string;
}>;

export default async function SignupPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const rawError = params.error ? decodeURIComponent(params.error) : null;
  const errorMessage = rawError ? (ERROR_COPY[rawError] ?? rawError) : null;
  const confirmationSent = params.sent === '1';
  const next = safeNext(params.next);
  // WHO IS SIGNING UP IS DECIDED BY THE LINK, NOT BY A QUESTION (owner-locked
  // 2026-09-20). `?as=vendor` is the one way to arrive as a vendor; a bare
  // /signup is a couple. The rule lives in lib/signup-intent.ts, executed by
  // its test; this server component can only ever be grepped.
  const accountType = accountTypeForSignup(params.as);
  const isVendorSignup = accountType === 'vendor';

  // Already-authenticated bypass: an explicit `next` wins; `as=vendor` sends a
  // signed-in person to /vendor-dashboard; otherwise their account home.
  {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      if (next !== '/') {
        redirect(next);
      }
      if (isVendorSignup) {
        redirect('/vendor-dashboard');
      }
      const { data: profile } = await supabase
        .from('users')
        .select('account_type')
        .eq('user_id', user.id)
        .maybeSingle();
      redirect(accountHomePath(profile?.account_type));
    }
  }

  // OAuth visibility by shell (mirrors /login): web + desktop show the buttons;
  // mobile / embedded WebViews stay email-only because Google refuses OAuth
  // there. Desktop gets the loopback variant, web the server-action row.
  const shell = await getClientShell();
  const showOAuth = ANY_OAUTH_ENABLED && shell !== 'mobile';
  const desktopOAuth = showOAuth && shell === 'desktop';
  const prefilledEmail = typeof params.prefill_email === 'string' ? params.prefill_email : '';
  const refParam = params.ref === 'guest' ? 'guest' : '';
  const srcEvent = refParam === 'guest' && typeof params.src_event === 'string' ? params.src_event : '';
  // Accept the S89R-<10> shape only; junk must not paint the referred banner.
  const referralCode =
    typeof params.refc === 'string' && /^S89R-[0-9A-Z]{10}$/i.test(params.refc.trim())
      ? params.refc.trim().toUpperCase()
      : '';
  const loginHref = `/login${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`;
  // Persistent guest accounts: a signed guest session on this browser means the
  // action will link the guest's tagged photos to the new account.
  const hasGuestSession = (await readGuestSession()) !== null;

  // A paper base under the greige dim, exactly as /login does, so a hard load
  // never flashes a void behind the card.
  return (
    <main style={{ minHeight: '100dvh', background: 'var(--m-paper)' }}>
      <div className="home-reskin-ov" role="dialog" aria-modal="true" aria-label="Create account">
        <div className="hr-ov-card sn-signin-terra" style={{ maxWidth: 460 }}>
          <Link href="/" className="hr-ov-x" aria-label="Close">
            ✕
          </Link>
          <div className="hr-ov-eyebrow">New here</div>
          <h1 className="hr-ov-title">Create your account.</h1>

          {errorMessage ? (
            <p role="alert" className="hr-si-banner hr-si-banner--error">
              {errorMessage}
            </p>
          ) : null}

          {confirmationSent ? (
            <p role="status" className="hr-si-banner">
              We sent a confirmation link to your email. Open it to finish creating your account.
            </p>
          ) : null}

          {hasGuestSession ? (
            <p role="status" className="hr-si-banner">
              Your event photos will be saved to your new account.
            </p>
          ) : null}

          {referralCode ? (
            <p role="status" className="hr-si-banner">
              A couple invited you to Setnayan. Create your account and you&rsquo;ll both get a
              little something when you book your first service.
            </p>
          ) : null}

          {/* OAuth above the email form, same components and gate as /login.
              `withAccountType` carries the URL's decision so a vendor signing up
              with Google is filed as a vendor. */}
          {showOAuth ? (
            <div className="hr-si-oauth">
              {desktopOAuth ? (
                <DesktopOAuthButtons next={next} />
              ) : (
                <OAuthButtonRow next={next} withAccountType defaultAccountType={accountType} />
              )}
            </div>
          ) : null}

          {showOAuth ? (
            <div className="hr-si-or">
              <span>or sign up with email</span>
            </div>
          ) : null}

          <form action={signUp} className="hr-si-form">
            <input type="hidden" name="next" value={next} />
            <TurnstileField action="signup" />
            {refParam ? <input type="hidden" name="ref" value={refParam} /> : null}
            {srcEvent ? <input type="hidden" name="src_event" value={srcEvent} /> : null}
            {referralCode ? <input type="hidden" name="refc" value={referralCode} /> : null}
            {/* The one `account_type`, carrying the value the URL decided. */}
            <input type="hidden" name="account_type" value={accountType} />

            <div className="hr-si-field">
              <label htmlFor="hr-su-email" className="hr-si-label">
                Email
              </label>
              <input
                id="hr-su-email"
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
              <label htmlFor="hr-su-password" className="hr-si-label">
                Password
              </label>
              <input
                id="hr-su-password"
                name="password"
                type="password"
                autoComplete="new-password"
                placeholder="At least 8 characters"
                required
                minLength={8}
                className="hr-si-input"
              />
            </div>

            {/* THE AGREEMENT — clickwrap, above the submit, UNTICKED (CTRL-B3).
                `required` is the browser's half; `signUp` refuses without it. */}
            <label htmlFor="hr-su-terms" className="hr-si-remember" style={{ alignItems: 'flex-start' }}>
              <input id="hr-su-terms" name={TERMS_FIELD} type="checkbox" required style={{ marginTop: 3 }} />
              <span>
                I agree to the{' '}
                <Link href="/terms" className="hr-si-link">
                  Terms
                </Link>{' '}
                and{' '}
                <Link href="/privacy" className="hr-si-link">
                  Privacy Policy
                </Link>
                .
              </span>
            </label>

            {/* "Stay signed in" defaults CHECKED — explicit opt-out only; the
                action downgrades sb-* cookies to session-only when unchecked. */}
            <div className="hr-si-row">
              <label htmlFor="hr-su-remember" className="hr-si-remember">
                <input id="hr-su-remember" name="remember" type="checkbox" defaultChecked />
                <span>Stay signed in</span>
              </label>
            </div>

            <SubmitButton className="hr-si-submit" pendingLabel="Creating account…">
              Create account · free
            </SubmitButton>
          </form>

          <div className="hr-si-foot">
            Have an account?{' '}
            <Link href={loginHref} className="hr-si-link">
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
