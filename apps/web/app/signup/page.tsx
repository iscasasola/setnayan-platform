/**
 * /signup — v2.1 template port from
 * /tmp/setnayan-keynote-template/components/login-signup.jsx (SignupScreen +
 * SignupScreenMobile variants).
 *
 * WHY: CLAUDE.md 2026-05-28 11th row "v2.1 BRIEF LOCKED AS CANONICAL". Owner
 * directive: port v2.1 visual treatment across marketing surfaces. Signup is
 * the funnel from marketing → dashboard; visual continuity from the homepage
 * + /vendors editorial register through the signup door matters.
 *
 * SCOPE — visual treatment ONLY:
 *   - Two-column desktop layout: brand panel (left · 1fr) + form panel
 *     (right · 1.1fr). Mobile collapses to single column.
 *   - --m-* CSS variable palette.
 *   - Wordmark + .m-serif + .m-mono typography.
 *   - "Set your day in motion." display heading with italic orange accent.
 *   - Couple / Vendor pill toggle (matches template's segmented control).
 *     ⚠ REMOVED 2026-09-20 — see the 2026-09-20 note at the foot of this block.
 *   - First-name / Last-name / Mobile / Wedding-date visual fields are
 *     rendered but NOT wired to backend in V1 (signUp action consumes only
 *     email + password + account_type + public_summary_consent). V1.1
 *     follow-up wires the additional fields to a new public.users column
 *     set + onboarding profile-completion server action. The fields ship
 *     visible so the surface matches the v2.1 template exactly per
 *     [[feedback_setnayan_button_preservation]] — form field shapes +
 *     placements preserved verbatim from template.
 *
 * PRESERVED:
 *   - signUp server action from ./actions.ts (Supabase Auth wiring).
 *   - OAuthButtonRow above email form per industry-standard placement.
 *   - account_type — DOM contract unchanged (one `name="account_type"` posting
 *     'customer' | 'vendor'), but a hidden value since 2026-09-20, not a radio.
 *   - Public Event Summary consent checkbox — locked in CLAUDE.md 2026-05-19
 *     rows 426 + 428 with 8 RA 10173 safe-harbor guardrails. Field name +
 *     value identical to prior implementation. Rendered only for a couple —
 *     decided on the SERVER since 2026-09-20 (it was [data-couple-only] + a
 *     `:has()` variant aimed at the now-deleted radio).
 *   - searchParams contract (error / sent / next / as / prefill_email).
 *   - ERROR_COPY map unchanged.
 *
 * v2.1 drift scrub (template marketing copy):
 *   - "Free planning forever" + "No card" + "Guest list + RSVP · free" +
 *     "192 verified vendors" + "BIR-stamped receipts" + "Setnayan AI AI"
 *     bullets preserved as-is from template — all canonical under v2.1
 *     brief (CLAUDE.md 2026-05-28 11th row).
 *
 * 2026-06-13 reprice scrub (Pricing.md § 00.D): RSVP is a paid SKU and the
 * "BIR-stamped receipts" claim was purged platform-wide (PR #1316), so the
 * bullets + "Free planning forever" line above are superseded — copy now
 * sells the free workspace (guest list · seating · budget · mood board).
 *
 * 2026-07-05 frozen-count fix: the "192 verified vendors" bullet was a live
 * count frozen in copy (fabricated for a founder-only marketplace) — a checkable
 * public claim that isn't true. It's now a THRESHOLD-GATED live read
 * (getVerifiedVendorMarketplaceCount, same predicate as the couple-facing
 * catalog/onboarding counts). The number renders only at/above
 * VENDOR_COUNT_BRAG_THRESHOLD; below the floor the bullet omits the figure
 * ("Verified vendor marketplace") so the public-claims lock stays honest.
 *
 * ── 2026-09-20 · THE SCREEN NO LONGER ASKS WHO YOU ARE ──────────────────────
 * The owner tapped one of our NFC vendor cards on his own phone. It landed on
 * /vendor-invite/<slug>, he followed "Sign up free & add this vendor", and this
 * page asked him whether he was a couple or a vendor. Verbatim: *"you shouldn't
 * ask if they are a vendor since it should be directly as a user."* Locked the
 * same day, and widened by him to a bare /signup as well: signing up is signing
 * up as a person; `?as=vendor` is the one way to arrive as a vendor.
 *
 * 🔑 THE LINK HAD ALREADY SAID SO, AND NOTHING READ IT. Five call sites have
 * sent `?as=couple` for months — /vendor-invite/[slug] (page + action),
 * /vendor/lock/[token] (page + action), /vendor/fit/[ref] — and this page only
 * ever tested `params.as === 'vendor'`. So `as=couple` did exactly one thing:
 * leave the couple pill pre-ticked. A parameter that is written, carried and
 * ignored is indistinguishable, from the outside, from a screen that was
 * designed to ask.
 *
 * The rule itself lives in `lib/signup-intent.ts` rather than in a ternary
 * here, because this is a server component: a guard can't render it, so a guard
 * written against this file could only grep it — and a grep cannot tell
 * 'customer' from 'vendor' inside a branch it never takes, which is the exact
 * shape of the bug being fixed. `signup-intent.test.ts` EXECUTES the decision.
 *
 * ⚠ THE VENDOR DOOR MOVED INSIDE; IT DID NOT CLOSE. Owner, same conversation:
 * *"we should also have the direct to vendor application app as well, but not
 * there."* `/signup?as=vendor` is untouched (reached from /vendors, /open-shop,
 * /vendor/claim/[token], the front door), and a signed-in customer reaches
 * `/open-shop` from the account switcher's "Create your shop" — where
 * `becomeVendor` self-heals `users.account_type` to 'vendor'. Nobody is
 * trapped in the wrong account by this change.
 */
import Link from 'next/link';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { SubmitButton } from '@/app/_components/submit-button';
import { Wordmark } from '@/app/_components/brand-marks';
import { ANY_OAUTH_ENABLED, OAuthButtonRow } from '@/app/_components/oauth-button-row';
import { DesktopOAuthButtons } from '@/app/_components/desktop-oauth-buttons';
import { getClientShell } from '@/lib/request-platform';
import { safeNext } from '@/lib/auth';
import { accountHomePath } from '@/lib/account-security';
import { createClient } from '@/lib/supabase/server';
import { readGuestSession } from '@/lib/guest-session';
import { accountTypeForSignup, showsCoupleConsent } from '@/lib/signup-intent';
import {
  getVerifiedVendorMarketplaceCount,
  VENDOR_COUNT_BRAG_THRESHOLD,
} from '@/lib/vendor-counts';
import { signUp } from './actions';
import { TurnstileField } from '@/app/_components/auth/turnstile-field';

export const metadata: Metadata = {
  title: 'Create account',
  description:
    'Create a Setnayan account in seconds. Free to start for couples planning their wedding. Free baseline listing for Filipino wedding vendors.',
  alternates: { canonical: '/signup' },
};

const ERROR_COPY: Record<string, string> = {
  missing: 'Please enter both an email and a password.',
  password_too_short: 'Password must be at least 8 characters.',
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
  /** Guest → host growth-loop attribution. Set by the guest-page CTA
   *  (`/signup?ref=guest&src_event=<public_id>`). Carried through the form as
   *  hidden inputs so the signUp action can fire the `guest_to_host_signup`
   *  north-star event on a successful new-account creation. No PII. */
  ref?: string;
  src_event?: string;
  /** Couple referral rewards. A new account arriving via a couple's shared
   *  referral link (`/signup?refc=<code>`). Carried through the form as a
   *  hidden input so signUp records an OPEN redemption on account creation. */
  refc?: string;
}>;

export default async function SignupPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const rawError = params.error ? decodeURIComponent(params.error) : null;
  const errorMessage = rawError ? (ERROR_COPY[rawError] ?? rawError) : null;
  const confirmationSent = params.sent === '1';
  const next = safeNext(params.next);
  // WHO IS SIGNING UP IS DECIDED BY THE LINK, NOT BY A QUESTION (owner-locked
  // 2026-09-20). `?as=vendor` — set only by the deliberate "Register your
  // business" doors — is the one way to arrive as a vendor; everything else,
  // including a bare /signup, is a couple. The rule and the reasons live in
  // lib/signup-intent.ts, where a guard can EXECUTE them; a server component
  // can only ever be grepped.
  const accountType = accountTypeForSignup(params.as);
  const isVendorSignup = accountType === 'vendor';
  const coupleConsent = showsCoupleConsent(params.as);

  // Already-authenticated bypass. /signup has no session check today, so a
  // logged-in user clicking a "Register your business" CTA (?as=vendor) —
  // e.g. an admin/couple account testing the vendor side — lands on a full
  // account-creation form instead of vendor onboarding, and submitting it
  // with their own email just errors ("user already exists"). Mirrors the
  // rawNext==='/' shortcut in login/actions.ts: an explicit `next` wins,
  // otherwise `as=vendor` sends straight to /vendor-dashboard (which already
  // renders a fresh intake form when the user has no vendor_profiles row)
  // rather than accountHomePath, which would bounce an admin to /admin.
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

  // OAuth visibility by shell (mirrors /login): web + the rebuilt desktop app
  // (system-browser loopback OAuth) show the buttons; mobile / older-native stay
  // email-only because Google refuses OAuth in an embedded WebView. Desktop gets
  // the loopback variant; web gets the server-action row.
  const shell = await getClientShell();
  const showOAuth = ANY_OAUTH_ENABLED && shell !== 'mobile';
  const desktopOAuth = showOAuth && shell === 'desktop';
  const prefilledEmail =
    typeof params.prefill_email === 'string' ? params.prefill_email : '';
  // Guest → host attribution. Only `ref=guest` is meaningful today; `src_event`
  // is a public_id (text). Both are echoed into hidden form inputs so the
  // signUp action can attribute the new account. No PII.
  const refParam = params.ref === 'guest' ? 'guest' : '';
  const srcEvent =
    refParam === 'guest' && typeof params.src_event === 'string'
      ? params.src_event
      : '';
  // Couple referral code (?refc=). Accept the S89R-<10> shape only; anything
  // else is dropped so a junk param can't paint the referred-signup banner.
  const referralCode =
    typeof params.refc === 'string' && /^S89R-[0-9A-Z]{10}$/i.test(params.refc.trim())
      ? params.refc.trim().toUpperCase()
      : '';
  const loginHref = `/login${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`;
  // Persistent guest accounts (PR-E): if this browser carries a signed guest
  // session, the signUp action will link the guest's tagged event photos to the
  // new account. Surface a calm, generic reassurance — no event name lookup,
  // no PII (the signed cookie is the only thing we read).
  const hasGuestSession = (await readGuestSession()) !== null;

  // Vendor-marketplace bullet · threshold-gated LIVE count (never a frozen
  // number). Below the brag floor — the marketplace is founder-only at launch,
  // so a live count today is tiny — we drop the figure and just name the
  // feature, keeping the public-claims lock honest (every checkable claim TRUE).
  const verifiedVendorCount = await getVerifiedVendorMarketplaceCount();
  const vendorBullet =
    verifiedVendorCount >= VENDOR_COUNT_BRAG_THRESHOLD
      ? `${verifiedVendorCount.toLocaleString('en-PH')} verified vendors`
      : 'Verified vendor marketplace';

  const benefitBullets = [
    'Guest list + schedule · free',
    vendorBullet,
    'Mood board · free',
    'Budget + seating tools · free',
  ];

  return (
    <main className="flex min-h-dvh w-full items-center justify-center bg-cream px-4 py-6">
      {/* ⚖ THE COMPOSITION IS UNCHANGED — 960px, brand panel then form, one
          column until lg. This port changes the REGISTER (colour, type, the
          threshold edge), never the layout: reconcile, never redraw. */}
      <div
        className="m-signup-card w-full max-w-[960px] overflow-hidden rounded-2xl border border-ink/10 border-t-[3px] border-t-mulberry bg-surface shadow-sm"
        style={{ display: 'grid', gridTemplateColumns: '1fr' }}
      >
        {/* Brand panel · stacked on mobile, becomes left column on lg+ */}
        <div
          className="m-signup-brand"
          style={{
            padding: '36px 32px',
            background:
              'linear-gradient(135deg, rgb(var(--color-terracotta) / 0.06) 0%, rgb(var(--color-ink) / 0.03) 100%)',
            display: 'flex',
            flexDirection: 'column',
            gap: 24,
            color: 'rgb(var(--color-ink))',
          }}
        >
          <Link
            href="/"
            aria-label="Setnayan home"
            style={{ display: 'inline-flex', textDecoration: 'none' }}
          >
            <Wordmark size={26} />
          </Link>
          <div>
            <div
              className="m-mono"
              style={{
                fontSize: 10,
                color: 'rgb(var(--color-ink) / 0.72)',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
              }}
            >
              Start free · 90 seconds
            </div>
            {/* The page's real headline, and now its only <h1>. It was an <h2>
                with no <h1> anywhere above it — a heading order that reads as a
                document starting at level two. */}
            <h1
              className="m-serif"
              style={{
                fontSize: 34,
                lineHeight: 1.04,
                margin: '10px 0 0',
                color: 'rgb(var(--color-ink))',
                fontWeight: 400,
                letterSpacing: '-0.02em',
              }}
            >
              Set your day{' '}
              <em className="text-mulberry" style={{ fontStyle: 'italic' }}>
                in motion.
              </em>
            </h1>
            <p
              className="m-serif"
              style={{
                fontStyle: 'italic',
                fontSize: 14,
                color: 'rgb(var(--color-ink) / 0.72)',
                marginTop: 12,
                lineHeight: 1.55,
              }}
            >
              No card. The planning workspace is free. Invite co-hosts later.
            </p>
          </div>
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: 'auto 0 0',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            {benefitBullets.map((b) => (
              <li
                key={b}
                style={{
                  fontSize: 12,
                  color: 'rgb(var(--color-ink) / 0.72)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span className="font-semibold text-mulberry">✓</span>
                {b}
              </li>
            ))}
          </ul>
        </div>

        {/* Form panel · right column on lg+ */}
        <div
          style={{
            padding: '36px 32px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            background: 'rgb(var(--color-cream))',
          }}
        >
          <div className="space-y-1">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-mulberry">
              Create account
            </p>
            <h2 className="font-serif text-2xl font-semibold tracking-tight text-ink">
              One account, every celebration.
            </h2>
          </div>

          {hasGuestSession ? (
            <p
              role="status"
              style={{
                margin: 0,
                padding: '10px 12px',
                borderRadius: 'var(--m-r-sm)',
                border: '1px solid rgb(var(--color-ink) / 0.12)',
                background: 'rgb(var(--color-ink) / 0.04)',
                color: 'rgb(var(--color-ink))',
                fontSize: 13,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span style={{ color: 'rgb(var(--color-mulberry))', fontWeight: 600 }}>✓</span>
              Your event photos will be saved to your new account.
            </p>
          ) : null}

          {errorMessage ? (
            <p
              role="alert"
              style={{
                margin: 0,
                padding: '10px 12px',
                borderRadius: 'var(--m-r-sm)',
                border: '1px solid rgb(var(--color-mulberry) / 0.30)',
                background: 'rgb(var(--color-mulberry) / 0.07)',
                color: 'rgb(var(--color-mulberry-600))',
                fontSize: 13,
              }}
            >
              {errorMessage}
            </p>
          ) : null}

          {confirmationSent ? (
            <p
              role="status"
              style={{
                margin: 0,
                padding: '10px 12px',
                borderRadius: 'var(--m-r-sm)',
                border: '1px solid rgb(var(--color-ink) / 0.12)',
                background: 'rgb(var(--color-ink) / 0.04)',
                color: 'rgb(var(--color-ink))',
                fontSize: 13,
              }}
            >
              We sent a confirmation link to your email. Open it to finish creating your
              account.
            </p>
          ) : null}

          {/* Couple referral rewards — a friend's shared link. Reassures the
              new couple that a perk is waiting once they book their first
              service. No amount shown (it's admin-managed + may be inert). */}
          {referralCode ? (
            <p
              role="status"
              style={{
                margin: 0,
                padding: '10px 12px',
                borderRadius: 'var(--m-r-sm)',
                border: '1px solid rgb(var(--color-ink) / 0.12)',
                background: 'rgb(var(--color-ink) / 0.04)',
                color: 'rgb(var(--color-ink))',
                fontSize: 13,
              }}
            >
              A couple invited you to Setnayan. Create your account and you&rsquo;ll
              both get a little something when you book your first service.
            </p>
          ) : null}

          {/* OAuth above the email form (PR #422). Desktop gets the loopback
              variant, web the server-action row; mobile/older-native = email-only
              (see showOAuth/desktopOAuth). */}
          {showOAuth ? (
            // withAccountType: carry the Couple/Vendor selection into the web
            // OAuth row so a vendor signing up via Google/Apple isn't
            // misclassified as a customer. (Desktop-loopback OAuth threading is a
            // separate follow-up — the Tauri flow doesn't post a form.)
            desktopOAuth ? <DesktopOAuthButtons next={next} /> : <OAuthButtonRow next={next} withAccountType defaultAccountType={accountType} />
          ) : null}

          {showOAuth ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                margin: '4px 0',
                fontSize: 11,
                color: 'rgb(var(--color-ink) / 0.72)',
              }}
            >
              <div style={{ flex: 1, height: 1, background: 'rgb(var(--color-ink) / 0.12)' }} />
              <span
                className="m-mono"
                style={{
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  color: 'rgb(var(--color-ink) / 0.60)',
                }}
              >
                or sign up with email
              </span>
              <div style={{ flex: 1, height: 1, background: 'rgb(var(--color-ink) / 0.12)' }} />
            </div>
          ) : null}

          <form
            action={signUp}
            // The couples-only consent block used to hide itself here, with a
            // `:has(input[value='vendor']:checked)` rule aimed at the Couple/
            // Vendor radio. That radio is gone (owner 2026-09-20), so the
            // selector could never match again and the block would have
            // rendered for vendors. It is gated on the server now instead —
            // `coupleConsent`, from the same helper that picks the account
            // type, so the two can never disagree.
            style={{ display: 'grid', gap: 12 }}
          >
            <input type="hidden" name="next" value={next} />
            <TurnstileField action="signup" />
            {/* Guest → host growth-loop attribution (no PII) — carried from the
                guest-page CTA so signUp can fire `guest_to_host_signup`. */}
            {refParam ? <input type="hidden" name="ref" value={refParam} /> : null}
            {srcEvent ? (
              <input type="hidden" name="src_event" value={srcEvent} />
            ) : null}
            {/* Couple referral rewards — carried so signUp records the OPEN
                redemption tying this new couple to the referrer. */}
            {referralCode ? (
              <input type="hidden" name="refc" value={referralCode} />
            ) : null}

            {/* WHO IS SIGNING UP IS ALREADY DECIDED — see lib/signup-intent.ts.
                This was a Couple/Vendor pill toggle. The owner tapped an NFC
                vendor card on his own phone, followed "Sign up free & add this
                vendor", and was asked whether he was a vendor: *"you shouldn't
                ask if they are a vendor since it should be directly as a user."*

                🔑 THE LINK HAD ALREADY SAID SO, AND NOTHING READ IT. Five entries
                have been sending `?as=couple` for months and this page only ever
                tested for 'vendor', so the param's only effect was to leave the
                couple pill pre-ticked — indistinguishable, from the outside, from
                a screen designed to ask.

                The DOM contract signUp reads is unchanged: one `account_type`
                posting 'customer' | 'vendor' via formData.get('account_type').
                It is now a value rather than a question. The vendor door is not
                closed — it is `/signup?as=vendor` (unchanged) and `/open-shop`
                from inside a signed-in account, which self-heals account_type. */}
            <input type="hidden" name="account_type" value={accountType} />

            {/* Public Event Summary consent · couples only. Field name + value
                identical to prior implementation (locked in CLAUDE.md
                2026-05-19 rows 426 + 428). Starts UNticked (2026-07-05 NPC
                consent hygiene) — showcase consent must be freely given, not
                pre-selected. The 8 RA 10173 safe-harbor guardrails still apply
                once opted in.

                🔑 IT IS THE SERVER THAT HIDES THIS NOW, NOT A SELECTOR. The old
                `[data-couple-only]` + `:has(input[value='vendor']:checked)` pair
                pointed at a radio that no longer exists, so it would have shown
                a photography studio a consent question about *its wedding*. A
                CSS rule aimed at a deleted element does not fail — it silently
                stops hiding anything. */}
            {coupleConsent ? (
            <div
              style={{
                padding: '10px 12px',
                borderRadius: 'var(--m-r-sm)',
                border: '1px solid rgb(var(--color-ink) / 0.12)',
                background: 'rgb(var(--color-ink) / 0.04)',
              }}
            >
              <label
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 8,
                  cursor: 'pointer',
                  fontSize: 12,
                  color: 'rgb(var(--color-ink) / 0.72)',
                  lineHeight: 1.4,
                }}
              >
                <input
                  type="checkbox"
                  name="public_summary_consent"
                  value="yes"
                  style={{
                    marginTop: 2,
                    width: 14,
                    height: 14,
                    flexShrink: 0,
                    accentColor: 'rgb(var(--color-mulberry))',
                  }}
                />
                <span>
                  <span style={{ color: 'rgb(var(--color-ink))', fontWeight: 500 }}>
                    Include my wedding in Setnayan&rsquo;s Stories showcase.
                  </span>{' '}
                  30 days after our event, our editorial page becomes publicly
                  searchable on{' '}
                  <span className="m-mono" style={{ fontSize: 11 }}>
                    setnayan.com/realstories
                  </span>
                  . We can keep it private at any time.
                </span>
              </label>
            </div>
            ) : null}

            {/* Visual-only optional fields · NOT wired to V1 signUp action.
                Template ships First name + Last name + Mobile + Wedding date
                so the v2.1 visual treatment matches. V1.1 wires these into
                a post-signup profile-completion step. The fields are kept
                non-required so the form still submits with just email +
                password (the V1 backend contract). */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 8,
              }}
            >
              <FormField
                label="First name (optional)"
                id="first_name"
                name="first_name"
                type="text"
                autoComplete="given-name"
                placeholder="Maria"
              />
              <FormField
                label="Last name (optional)"
                id="last_name"
                name="last_name"
                type="text"
                autoComplete="family-name"
                placeholder="Magsaysay"
              />
            </div>

            <FormField
              label="Email"
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="maria@example.com"
              defaultValue={prefilledEmail}
              required
            />

            <FormField
              label="Password"
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              placeholder="At least 8 characters"
              required
              minLength={8}
            />

            {/* "Stay signed in" toggle.
                Mirrors the login form's row at /login. Default CHECKED —
                explicit opt-out only. When unchecked, the signUp server
                action overwrites Supabase's sb-* cookies to session-only
                so they clear on browser close (shared / borrowed device).
                See ./actions.ts. */}
            <label
              htmlFor="remember"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                cursor: 'pointer',
                color: 'rgb(var(--color-ink) / 0.72)',
                fontSize: 12,
                userSelect: 'none',
              }}
            >
              <input
                id="remember"
                name="remember"
                type="checkbox"
                defaultChecked
                style={{
                  width: 14,
                  height: 14,
                  accentColor: 'rgb(var(--color-mulberry))',
                  cursor: 'pointer',
                }}
              />
              <span>Stay signed in</span>
            </label>

            <SubmitButton
              /* The one action that creates the account. `.button-primary` is
                 #C24E25 with a cream label — 4.61:1, the same pairing every
                 door CTA uses. It replaces a gold fill (#8A6B39, 4.79:1) that
                 also passed; this is a register change, not a fix. */
              className="button-primary mt-1 w-full"
              pendingLabel="Creating account…"
            >
              Create account · free
            </SubmitButton>

            <div
              style={{
                fontSize: 11,
                color: 'rgb(var(--color-ink) / 0.72)',
                textAlign: 'center',
                lineHeight: 1.4,
                marginTop: 4,
              }}
            >
              By signing up, you agree to our{' '}
              <Link
                href="/terms"
                style={{ color: 'rgb(var(--color-mulberry))', textDecoration: 'none' }}
              >
                Terms
              </Link>{' '}
              and{' '}
              <Link
                href="/privacy"
                style={{ color: 'rgb(var(--color-mulberry))', textDecoration: 'none' }}
              >
                Privacy
              </Link>
              .<br />
              We never sell your data — RA 10173 compliant.
            </div>
          </form>

          <div
            style={{
              fontSize: 12,
              color: 'rgb(var(--color-ink) / 0.72)',
              textAlign: 'center',
              marginTop: 4,
            }}
          >
            Already have an account?{' '}
            <Link
              href={loginHref}
              style={{
                color: 'rgb(var(--color-mulberry))',
                textDecoration: 'none',
                fontWeight: 500,
              }}
            >
              Sign in
            </Link>
          </div>
        </div>
      </div>

      <style
        // eslint-disable-next-line react/no-unknown-property
        dangerouslySetInnerHTML={{
          __html: `
            @media (min-width: 768px) {
              .m-signup-card {
                grid-template-columns: 1fr 1.1fr !important;
              }
            }
          `,
        }}
      />
    </main>
  );
}

/**
 * v2.1 form field · matches template's FormField. .m-mono uppercase
 * eyebrow label + bordered input on --m-paper-2 with --m-line border +
 * 8px radius. Native <input> so server actions consume FormData unchanged.
 */
function FormField({
  label,
  id,
  name,
  type = 'text',
  placeholder,
  defaultValue,
  required,
  autoComplete,
  inputMode,
  minLength,
}: {
  label: string;
  id: string;
  name: string;
  type?: string;
  placeholder?: string;
  defaultValue?: string;
  required?: boolean;
  autoComplete?: string;
  inputMode?: 'email' | 'text' | 'tel' | 'numeric' | 'search' | 'url';
  minLength?: number;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        placeholder={placeholder}
        defaultValue={defaultValue}
        required={required}
        autoComplete={autoComplete}
        inputMode={inputMode}
        minLength={minLength}
        className="input-field"
      />
    </div>
  );
}
