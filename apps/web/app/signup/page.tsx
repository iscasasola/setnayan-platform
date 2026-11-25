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
 * (CTRL-B3, unticked, required — one box for all three doors since 2026-10-22, ABOVE Google / Apple since
 * 24 Nov 2026, a field of the email form by `form=` — `lib/terms-agreement.ts`),
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
import { FormingMark } from '@/app/_components/auth/forming-mark';
import { UseEmailFold } from '@/app/_components/auth/use-email-fold';
import { OAUTH_FLAGS, OAuthButtonRow } from '@/app/_components/oauth-button-row';
import { TermsFirst } from '@/app/_components/auth/terms-first';
import { DesktopOAuthButtons } from '@/app/_components/desktop-oauth-buttons';
import { NativeOAuthButtons } from '@/app/_components/native-oauth-buttons';
import { getOAuthGate } from '@/lib/request-platform';
import { safeNext, getCurrentUser } from '@/lib/auth';
import { accountHomePath } from '@/lib/account-security';
import { createClient } from '@/lib/supabase/server';
import { accountTypeForSignup } from '@/lib/signup-intent';
import { signUp } from './actions';
import { TurnstileField } from '@/app/_components/auth/turnstile-field';
import { TERMS_FIELD, TERMS_REQUIRED_MESSAGE } from '@/lib/terms-agreement';
import { GoogleAddressDoor } from '@/app/_components/auth/google-address-door';
import '@/app/_components/home/home-reskin.css';
import { PasswordField } from '@/app/_components/password-field';
import { InfoTip } from '@/app/_components/info-tip';

export const metadata: Metadata = {
  title: 'Create account',
  description:
    'Create a Setnayan account. Free to start for anyone planning an event. Free baseline listing for Filipino suppliers.',
  alternates: { canonical: '/signup' },
};

/** The one Terms box (above Google / Apple, a field of the email form by `form=`) and that form — one id each. */
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
    const user = await getCurrentUser();
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

  // A paper base under the greige dim, exactly as /login does, so a hard load
  // never flashes a void behind the card.
  return (
    <main style={{ minHeight: '100dvh', background: 'var(--m-paper)' }}>
      {/* `sn-signin-simple` + `sn-signin-scene`: the 24 Nov 2026 card on the celebration photo — the same pair /login wears. */}
      <div className="home-reskin-ov sn-signin-simple sn-signin-scene">
        <div className="hr-ov-card sn-signin-terra" style={{ maxWidth: 460 }}>
          {/* No ✕: this is a page of its own with nothing behind it (the same
              mistake as aria-modal, one layer up — overlay chrome on a page).
              The way out is the browser and the Sign-in link below. */}
          {/* THE HEADING (owner 24 Nov 2026, "simple and straight to the point"): the forming mark over one centred
              title. The SETNAYAN word beside the mark, the eyebrow and the sentence are gone (amends 21 Oct, the
              brand line — the mark stays and says Setnayan). */}
          <div className="hr-si-head">
            <FormingMark />
            <h1 className="hr-ov-title">Create account</h1>
          </div>

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

          {/* ⛔ No "Your event photos will be saved to your new account." (final check A1-061): since 2026-09-30 signing
              up links no seat and no photos ("SIGNING UP BINDS NO SEAT", actions.ts); only /join/{id}/connect does,
              on its own Yes. A promise the sign-up does not keep is not shown. */}
          {referralCode ? (
            <p role="status" className="hr-si-banner">
              A couple invited you to Setnayan.{' '}
              <InfoTip label="" ariaLabel="About the invite" align="start">
                Create your account and you&rsquo;ll both get a little something when you book your first service.
              </InfoTip>
            </p>
          ) : null}

          {/* THE AGREEMENT — ONE BOX FOR ALL THREE DOORS (owner 2026-10-22, "Yes to all": Host 1 option B), and since
              24 Nov 2026 ABOVE the buttons it controls (owner, on the approved drawing `login_simple_dark_2026-11-24`:
              "Create account puts the Terms tick above Google/Apple (it still gates all three)" — amends 22 Oct's
              "just above Create user account"). Clickwrap, UNTICKED, `required` (CTRL-B3). It sits outside the email
              form now, so `form={SIGNUP_FORM_ID}` makes it one of that form's fields: the email door posts it and the
              browser refuses that submit without it, exactly as before. NOT `data-password-only`, so it never folds
              away with the password half. `TermsFirst` below dims Google / Apple until it is ticked, and a press on
              them unticked nudges it; the tick rides the provider round trip (`carrySignupTerms` →
              `app/auth/callback`), so a Google / Apple account that ticked here never meets "One quick thing". */}
          <label htmlFor={TERMS_BOX_ID} className="hr-si-remember hr-si-terms">
            <input id={TERMS_BOX_ID} name={TERMS_FIELD} form={SIGNUP_FORM_ID} type="checkbox" required data-terms-box="" />
            <span>
              I agree to the{' '}
              <Link href="/terms" className="hr-si-link">
                Terms
              </Link>{' '}
              and{' '}
              <Link href="/privacy" className="hr-si-link">
                Privacy Policy
              </Link>
            </span>
          </label>
          <p id={`${TERMS_BOX_ID}-hint`} role="status" className="hr-si-hint hr-si-terms-hint" hidden>
            Tick the Terms first.
          </p>

          {/* ONE DOOR, ONE ORDER (owner 2026-09-25: "similar to the event invitation"): Google / Apple FIRST, then
              "Use email" (owner 24 Nov 2026). The buttons say `OAUTH_VERB` (lib/oauth-words.ts, "Continue with"),
              the one wording every door uses (sweep C9, 2026-10-19). `TermsFirst` holds them until the box above is
              ticked. Same components and shell gate as /login; `withAccountType` carries the URL's decision so a
              vendor arriving by Google is filed as one. */}
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

          {/* "Use email" (owner 24 Nov 2026): the email half waits behind one quiet switch under Google / Apple, and
              starts open when there is something to show or keep (an error, an address handed over by a link). */}
          <UseEmailFold fold={showOAuth} open={Boolean(errorMessage || prefilledEmail)}>
            <form action={signUp} id={SIGNUP_FORM_ID} className="hr-si-form">
              <input type="hidden" name="next" value={next} />
              <TurnstileField action="signup" />
              {refParam ? <input type="hidden" name="ref" value={refParam} /> : null}
              {srcEvent ? <input type="hidden" name="src_event" value={srcEvent} /> : null}
              {referralCode ? <input type="hidden" name="refc" value={referralCode} /> : null}
              {/* The one `account_type`, carrying the value the URL decided. */}
              <input type="hidden" name="account_type" value={accountType} />

              {/* The boxes say what they hold; the labels stay for a screen reader (owner 24 Nov 2026). */}
              <div className="hr-si-field">
                <label htmlFor="hr-su-email" className="sr-only">
                  Email
                </label>
                <input
                  id="hr-su-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  placeholder="Email"
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
                <label htmlFor="hr-su-password" className="sr-only">
                  Create a password
                </label>
                {/* `brief`: the checks show only while typing, in the drawing's short words (owner 24 Nov 2026). */}
                <PasswordField
                  mode="new"
                  brief
                  leaked={rawError === 'password_leaked'}
                  id="hr-su-password"
                  name="password"
                  autoComplete="new-password"
                  placeholder="Password, 8+ characters"
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

              <SubmitButton className="hr-si-submit" pendingLabel="Creating account…" data-password-only="">
                Create account
              </SubmitButton>
            </form>
          </UseEmailFold>

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
