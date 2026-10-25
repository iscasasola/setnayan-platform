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
 * (CTRL-B3, unticked, required, JUST above the submit — one box for all three doors since 2026-10-22, and it gates Google / Apple from there — `lib/terms-agreement.ts`),
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
import { FirstRunBrand } from '@/app/_components/first-run-brand';
import { OAUTH_FLAGS, OAuthButtonRow } from '@/app/_components/oauth-button-row';
import { TermsFirst } from '@/app/_components/auth/terms-first';
import { DesktopOAuthButtons } from '@/app/_components/desktop-oauth-buttons';
import { NativeOAuthButtons } from '@/app/_components/native-oauth-buttons';
import { getOAuthGate } from '@/lib/request-platform';
import { safeNext } from '@/lib/auth';
import { accountHomePath } from '@/lib/account-security';
import { createClient } from '@/lib/supabase/server';
import { readGuestSession } from '@/lib/guest-session';
import { accountTypeForSignup } from '@/lib/signup-intent';
import { signUp } from './actions';
import { TurnstileField } from '@/app/_components/auth/turnstile-field';
import { TERMS_FIELD, TERMS_REQUIRED_MESSAGE } from '@/lib/terms-agreement';
import { GoogleAddressDoor } from '@/app/_components/auth/google-address-door';
import '@/app/_components/home/home-reskin.css';

export const metadata: Metadata = {
  title: 'Create account',
  description:
    'Create a Setnayan account in seconds. Free to start for anyone planning an event. Free baseline listing for Filipino suppliers.',
  alternates: { canonical: '/signup' },
};

/** The one Terms box (inside the email form, just above its submit) and that form — one id each. */
const TERMS_BOX_ID = 'hr-su-terms';
const SIGNUP_FORM_ID = 'hr-su-form';

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

  // OAuth visibility by shell (mirrors /login — lib/oauth-shell-gate.ts): web +
  // desktop show the buttons; the phone app only in a build with the native
  // flow (Google refuses the embedded web view). Desktop gets the loopback
  // variant, the phone app the native one, web the server-action row.
  const gate = await getOAuthGate(OAUTH_FLAGS);
  const showOAuth = gate.show;
  const desktopOAuth = gate.desktop;
  const nativeOAuth = gate.native;
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
      <div className="home-reskin-ov">
        <div className="hr-ov-card sn-signin-terra" style={{ maxWidth: 460 }}>
          {/* No ✕: this is a page of its own with nothing behind it (the same
              mistake as aria-modal, one layer up — overlay chrome on a page).
              The way out is the browser and the Sign-in link below. */}
          {/* The brand line (owner 2026-10-21, "make sure there is Setnayan"): the shipped wordmark, small —
              not the brand PANEL retired above. */}
          <FirstRunBrand className="hr-si-brand" />
          <div className="hr-ov-eyebrow">Your account</div>
          <h1 className="hr-ov-title">Create your account.</h1>
          {/* THE OWNER'S OWN WORDS (2026-09-23): "enter your email address and
              create your password. or directly sign in with Google or Apple." —
              said in the order the card now shows them (2026-09-25: Google /
              Apple first, like the invitation). */}
          <p className="hr-ov-sub">
            {showOAuth ? 'Sign in directly with Google or Apple — or enter' : 'Enter'} your email
            address and create your password.
          </p>

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

          {/* ONE DOOR, ONE ORDER (owner 2026-09-25, verbatim: "When a new account
              is created via website must be similar to the event invitation").
              Google / Apple FIRST, as on the invitation door (DECISION_LOG
              2026-09-10: a provider redirect under a half-filled form loses the
              form) and the approved one_door_FINAL_2026-09-22 card; then the email
              form. ⚠ This reverses the 2026-09-23 ORDER only (email first); the
              owner's WORDS from that day stay — "sign in directly with Google or
              Apple" (the sentence above); the buttons say `OAUTH_VERB`
              (lib/oauth-words.ts, "Continue with"), the one wording every door
              uses (sweep C9, 2026-10-19). The one Terms box — below them, just
              above "Create user account" (owner 2026-10-22, "do both") — is the
              agreement on this path as well; `TermsFirst` holds them until it is
              ticked.
              Same components and shell gate as /login; `withAccountType` carries
              the URL's decision so a vendor arriving by Google is filed as one. */}
          {showOAuth ? (
            <div className="hr-si-oauth">
              <TermsFirst boxId={TERMS_BOX_ID}>
                {desktopOAuth ? (
                  <DesktopOAuthButtons next={next} termsBoxId={TERMS_BOX_ID} />
                ) : nativeOAuth ? (
                  <NativeOAuthButtons next={next} accountType={accountType} />
                ) : (
                  <OAuthButtonRow next={next} withAccountType defaultAccountType={accountType} />
                )}
              </TermsFirst>
            </div>
          ) : null}
          {showOAuth ? (
            <div className="hr-si-or">
              <span>or create a password with your email</span>
            </div>
          ) : null}

          <form action={signUp} id={SIGNUP_FORM_ID} className="hr-si-form">
            <input type="hidden" name="next" value={next} />
            <TurnstileField action="signup" />
            {refParam ? <input type="hidden" name="ref" value={refParam} /> : null}
            {srcEvent ? <input type="hidden" name="src_event" value={srcEvent} /> : null}
            {referralCode ? <input type="hidden" name="refc" value={referralCode} /> : null}
            {/* The one `account_type`, carrying the value the URL decided. */}
            <input type="hidden" name="account_type" value={accountType} />

            <div className="hr-si-field">
              <label htmlFor="hr-su-email" className="hr-si-label">
                Email address
              </label>
              <input
                id="hr-su-email"
                name="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                placeholder="you@email.com"
                defaultValue={prefilledEmail}
                required
                className="hr-si-input"
              />
            </div>
            {/* A TYPED Google address takes the Google button's own door (owner
                2026-10-18) — same words, same account type as the row above. */}
            <GoogleAddressDoor
              enabled={showOAuth}
              desktopOAuth={desktopOAuth}
              nativeOAuth={nativeOAuth}
              next={next}
              accountType={accountType}
              termsBoxId={TERMS_BOX_ID}
            />
            <div className="hr-si-field" data-password-only="">
              <label htmlFor="hr-su-password" className="hr-si-label">
                Create your password
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

            {/* "Stay signed in" defaults CHECKED — explicit opt-out only; the
                action downgrades sb-* cookies to session-only when unchecked. */}
            <div className="hr-si-row" data-password-only="">
              <label htmlFor="hr-su-remember" className="hr-si-remember">
                <input id="hr-su-remember" name="remember" type="checkbox" defaultChecked />
                <span>Stay signed in</span>
              </label>
            </div>

            {/* THE AGREEMENT — ONE BOX FOR ALL THREE DOORS (owner 2026-10-22, "Yes to all": Host 1 option B,
                prototype journey_fixes_2026-10-22.html), and since the same day ("do both") JUST ABOVE the button
                that creates the account — the card reads choose how (Google · Apple · or email + password) →
                agree → create. Clickwrap, UNTICKED, `required` (CTRL-B3). Inside the form, so the email door posts
                it as before; NOT `data-password-only`, so it stays on screen when a typed Google address folds the
                password half away. `TermsFirst` above still dims Google / Apple until it is ticked, and a press on
                them unticked scrolls here and nudges it; the tick rides the provider round trip (`carrySignupTerms`
                → `app/auth/callback`), so a Google / Apple account that ticked here never meets "One quick thing". */}
            <label htmlFor={TERMS_BOX_ID} className="hr-si-remember" style={{ alignItems: 'flex-start' }}>
              <input id={TERMS_BOX_ID} name={TERMS_FIELD} type="checkbox" required data-terms-box="" style={{ marginTop: 3 }} />
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
            <p id={`${TERMS_BOX_ID}-hint`} role="status" className="hr-si-hint hr-si-terms-hint" hidden>
              Tick the Terms first.
            </p>

            <SubmitButton className="hr-si-submit" pendingLabel="Creating account…" data-password-only="">
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
