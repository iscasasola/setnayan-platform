/**
 * /signup — v2.1 template port from
 * /tmp/setnayan-keynote-template/components/login-signup.jsx (SignupScreen +
 * SignupScreenMobile variants).
 *
 * WHY: CLAUDE.md 2026-05-28 11th row "v2.1 BRIEF LOCKED AS CANONICAL". Owner
 * directive: port v2.1 visual treatment across marketing surfaces. Signup is
 * the funnel from marketing → dashboard; visual continuity from the homepage
 * + /for-vendors editorial register through the signup door matters.
 *
 * SCOPE — visual treatment ONLY:
 *   - Two-column desktop layout: brand panel (left · 1fr) + form panel
 *     (right · 1.1fr). Mobile collapses to single column.
 *   - --m-* CSS variable palette.
 *   - Wordmark + .m-serif + .m-mono typography.
 *   - "Set your day in motion." display heading with italic orange accent.
 *   - Couple / Vendor pill toggle (matches template's segmented control).
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
 *   - account_type radio (Couple / Vendor) — DOM contract unchanged · just
 *     restyled as v2.1 segmented pill toggle.
 *   - Public Event Summary consent checkbox — locked in CLAUDE.md 2026-05-19
 *     rows 426 + 428 with 8 RA 10173 safe-harbor guardrails. Field name +
 *     value identical to prior implementation. Hidden when Vendor is picked
 *     via [data-couple-only] + the form's :has() arbitrary variant.
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
 */
import Link from 'next/link';
import type { Metadata } from 'next';
import { SubmitButton } from '@/app/_components/submit-button';
import { Wordmark } from '@/app/_components/brand-marks';
import { ANY_OAUTH_ENABLED, OAuthButtonRow } from '@/app/_components/oauth-button-row';
import { safeNext } from '@/lib/auth';
import { signUp } from './actions';

export const metadata: Metadata = {
  title: 'Create account · Setnayan',
  description:
    'Create a Setnayan account in seconds. Free to start for couples planning their wedding. Free baseline listing for Filipino wedding vendors.',
  alternates: { canonical: '/signup' },
};

const ERROR_COPY: Record<string, string> = {
  missing: 'Please enter both an email and a password.',
  password_too_short: 'Password must be at least 8 characters.',
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
}>;

export default async function SignupPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const rawError = params.error ? decodeURIComponent(params.error) : null;
  const errorMessage = rawError ? (ERROR_COPY[rawError] ?? rawError) : null;
  const confirmationSent = params.sent === '1';
  const next = safeNext(params.next);
  const preselectVendor = params.as === 'vendor';
  const prefilledEmail =
    typeof params.prefill_email === 'string' ? params.prefill_email : '';
  const loginHref = `/login${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`;

  const benefitBullets = [
    'Guest list + schedule · free',
    '192 verified vendors',
    'Mood board · free',
    'Budget + seating tools · free',
  ];

  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        background: 'var(--m-paper)',
        fontFamily: 'var(--font-sans-marketing, Geist), system-ui, sans-serif',
      }}
    >
      <div
        className="m-signup-card"
        style={{
          width: '100%',
          maxWidth: 960,
          background: 'var(--m-paper)',
          borderRadius: 18,
          overflow: 'hidden',
          border: '1px solid var(--m-line)',
          boxShadow: '0 30px 60px -25px rgba(45,48,56,0.18)',
          display: 'grid',
          gridTemplateColumns: '1fr',
        }}
      >
        {/* Brand panel · stacked on mobile, becomes left column on lg+ */}
        <div
          className="m-signup-brand"
          style={{
            padding: '36px 32px',
            background:
              'linear-gradient(135deg, var(--m-ivory) 0%, var(--m-paper-2) 100%)',
            display: 'flex',
            flexDirection: 'column',
            gap: 24,
            color: 'var(--m-ink)',
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
                color: 'var(--m-slate)',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
              }}
            >
              Start free · 90 seconds
            </div>
            <h2
              className="m-serif"
              style={{
                fontSize: 34,
                lineHeight: 1.04,
                margin: '10px 0 0',
                color: 'var(--m-ink)',
                fontWeight: 400,
                letterSpacing: '-0.02em',
              }}
            >
              Set your day{' '}
              <em style={{ fontStyle: 'italic', color: 'var(--m-orange-2)' }}>
                in motion.
              </em>
            </h2>
            <p
              className="m-serif"
              style={{
                fontStyle: 'italic',
                fontSize: 14,
                color: 'var(--m-slate)',
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
                  color: 'var(--m-slate)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span style={{ color: 'var(--m-orange-2)', fontWeight: 600 }}>✓</span>
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
            background: 'var(--m-paper)',
          }}
        >
          <div
            className="m-mono"
            style={{
              fontWeight: 700,
              fontSize: 22,
              color: 'var(--m-ink)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            Create account
          </div>

          {errorMessage ? (
            <p
              role="alert"
              style={{
                margin: 0,
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid var(--m-orange-3)',
                background: 'var(--m-orange-4)',
                color: 'var(--m-orange-2)',
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
                borderRadius: 8,
                border: '1px solid var(--m-line)',
                background: 'var(--m-paper-2)',
                color: 'var(--m-ink)',
                fontSize: 13,
              }}
            >
              We sent a confirmation link to your email. Open it to finish creating your
              account.
            </p>
          ) : null}

          {/* OAuth row above email form per industry-standard placement (PR #422) */}
          <OAuthButtonRow next={next} />

          {ANY_OAUTH_ENABLED ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                margin: '4px 0',
                fontSize: 11,
                color: 'var(--m-slate)',
              }}
            >
              <div style={{ flex: 1, height: 1, background: 'var(--m-line)' }} />
              <span
                className="m-mono"
                style={{
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  color: 'var(--m-slate-2)',
                }}
              >
                or sign up with email
              </span>
              <div style={{ flex: 1, height: 1, background: 'var(--m-line)' }} />
            </div>
          ) : null}

          <form
            action={signUp}
            // [data-couple-only] consent block hides when Vendor radio is
            // checked. :has() arbitrary variant approach preserved from prior
            // implementation — no client JS needed.
            style={{ display: 'grid', gap: 12 }}
            className="[&:has(input[value='vendor']:checked)_[data-couple-only]]:hidden"
          >
            <input type="hidden" name="next" value={next} />

            {/* Account-type pill toggle · matches template's segmented control.
                DOM contract preserved (radio inputs with name='account_type'
                and value='customer' | 'vendor') so signUp server action reads
                via formData.get('account_type') unchanged. */}
            <fieldset
              style={{
                border: 'none',
                padding: 0,
                margin: 0,
                display: 'grid',
                gap: 6,
              }}
            >
              <legend
                className="m-mono"
                style={{
                  fontSize: 10,
                  color: 'var(--m-slate-2)',
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  padding: 0,
                }}
              >
                I&rsquo;m signing up as a
              </legend>
              <div
                style={{
                  display: 'flex',
                  gap: 4,
                  padding: 3,
                  background: 'var(--m-paper-2)',
                  borderRadius: 999,
                  border: '1px solid var(--m-line)',
                }}
              >
                <AccountTypeOption
                  value="customer"
                  label="I'm a couple"
                  defaultChecked={!preselectVendor}
                />
                <AccountTypeOption
                  value="vendor"
                  label="I'm a vendor"
                  defaultChecked={preselectVendor}
                />
              </div>
            </fieldset>

            {/* Public Event Summary consent · couples only. Hides via
                [data-couple-only] when Vendor is checked. Field name +
                value identical to prior implementation (locked in
                CLAUDE.md 2026-05-19 rows 426 + 428). Default checked
                per V2 publisher posture (public-by-default with 8 RA
                10173 safe-harbor guardrails). */}
            <div
              data-couple-only
              style={{
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid var(--m-line)',
                background: 'var(--m-paper-2)',
              }}
            >
              <label
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 8,
                  cursor: 'pointer',
                  fontSize: 12,
                  color: 'var(--m-slate)',
                  lineHeight: 1.4,
                }}
              >
                <input
                  type="checkbox"
                  name="public_summary_consent"
                  value="yes"
                  defaultChecked
                  style={{
                    marginTop: 2,
                    width: 14,
                    height: 14,
                    flexShrink: 0,
                    accentColor: 'var(--m-orange)',
                  }}
                />
                <span>
                  <span style={{ color: 'var(--m-ink)', fontWeight: 500 }}>
                    Include my wedding in Setnayan&rsquo;s Real Weddings showcase.
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
                color: 'var(--m-slate)',
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
                  accentColor: 'var(--m-orange)',
                  cursor: 'pointer',
                }}
              />
              <span>Stay signed in</span>
            </label>

            <SubmitButton
              className="m-btn-orange"
              style={{
                padding: '12px 18px',
                fontSize: 14,
                marginTop: 4,
                justifyContent: 'center',
                width: '100%',
                background: 'var(--m-orange)',
                color: 'var(--m-paper)',
                border: 'none',
                borderRadius: 999,
                fontFamily: 'inherit',
                cursor: 'pointer',
                fontWeight: 500,
              }}
              pendingLabel="Creating account…"
            >
              Create account · free
            </SubmitButton>

            <div
              style={{
                fontSize: 11,
                color: 'var(--m-slate)',
                textAlign: 'center',
                lineHeight: 1.4,
                marginTop: 4,
              }}
            >
              By signing up, you agree to our{' '}
              <Link
                href="/terms"
                style={{ color: 'var(--m-orange-2)', textDecoration: 'none' }}
              >
                Terms
              </Link>{' '}
              and{' '}
              <Link
                href="/privacy"
                style={{ color: 'var(--m-orange-2)', textDecoration: 'none' }}
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
              color: 'var(--m-slate)',
              textAlign: 'center',
              marginTop: 4,
            }}
          >
            Already have an account?{' '}
            <Link
              href={loginHref}
              style={{
                color: 'var(--m-orange-2)',
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
 * Segmented account-type radio · visual treatment matches template's
 * pill toggle. The radio inputs are visually hidden (sr-only) and the
 * label's checked-state is driven by :has(input:checked) so the DOM
 * contract (name='account_type' radios) stays identical to the prior
 * implementation. signUp server action consumes formData.get('account_type')
 * unchanged.
 */
function AccountTypeOption({
  value,
  label,
  defaultChecked,
}: {
  value: 'customer' | 'vendor';
  label: string;
  defaultChecked: boolean;
}) {
  return (
    <label
      style={{
        flex: 1,
        position: 'relative',
        padding: '8px 14px',
        borderRadius: 999,
        fontSize: 12,
        textAlign: 'center',
        cursor: 'pointer',
        color: 'var(--m-slate)',
        fontWeight: 400,
        transition: 'background-color 120ms, color 120ms',
      }}
      className="m-acct-pill has-[:checked]:bg-[var(--m-ink)] has-[:checked]:text-[var(--m-paper)] has-[:checked]:font-medium"
    >
      <input
        type="radio"
        name="account_type"
        value={value}
        defaultChecked={defaultChecked}
        className="peer sr-only"
      />
      {label}
    </label>
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
    <div>
      <label
        htmlFor={id}
        className="m-mono"
        style={{
          display: 'block',
          fontSize: 10,
          color: 'var(--m-slate-2)',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          marginBottom: 4,
        }}
      >
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
        style={{
          width: '100%',
          padding: '10px 12px',
          background: 'var(--m-paper-2)',
          border: '1px solid var(--m-line)',
          borderRadius: 8,
          fontSize: 13,
          fontFamily: 'inherit',
          color: 'var(--m-ink)',
          outline: 'none',
          boxSizing: 'border-box',
        }}
      />
    </div>
  );
}
