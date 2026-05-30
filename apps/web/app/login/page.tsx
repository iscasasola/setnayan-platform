/**
 * /login — v2.1 template port from
 * /tmp/setnayan-keynote-template/components/login-signup.jsx (LoginScreen +
 * LoginScreenMobile variants).
 *
 * WHY: CLAUDE.md 2026-05-28 11th row "v2.1 BRIEF LOCKED AS CANONICAL". Owner
 * directive: port v2.1 visual treatment across marketing surfaces. The
 * /login surface is the gateway between marketing site (v2.1 paper-and-ink
 * editorial register) and the dashboard (existing v1 chrome) — visual
 * continuity from the marketing site through the door matters.
 *
 * SCOPE — visual treatment ONLY:
 *   - Two-column desktop layout: brand panel (left · 1fr) + form panel
 *     (right · 1.1fr). Mobile collapses to single column with the brand
 *     panel content rendered as a top strip.
 *   - --m-* CSS variable palette (paper · ink · slate · ivory · orange · line).
 *   - Wordmark from @/app/_components/brand-marks.
 *   - "Pick up where you left off." display heading with italic blush accent.
 *   - .m-mono uppercase eyebrows + .m-serif italic micro-copy.
 *
 * PRESERVED per [[feedback_setnayan_button_preservation]]:
 *   - Server actions signInWithPassword + signInWithMagicLink from
 *     ./actions.ts (Supabase Auth wiring untouched).
 *   - OAuthButtonRow above the email form per industry-standard "OAuth-first"
 *     placement (Stripe / Linear / GitHub / Notion pattern) — locked in
 *     PR #422 (CLAUDE.md 2026-05-23 row 1).
 *   - All form field names + IDs + autoComplete attrs + required flags
 *     match the prior implementation exactly so server actions consume
 *     unchanged.
 *   - searchParams contract (error / sent / check_email / ready / next) +
 *     safeNext() validator preserved.
 *   - "Forgot password?" + "No account yet · Create one" tail link.
 *   - Magic-link form preserved as secondary auth method (industry-standard
 *     "passwordless" affordance).
 *
 * v2.1 drift scrub (template had Google / Apple / GCash OAuth buttons in
 * a 3-column strip): replaced with the existing OAuthButtonRow which has
 * Google + Facebook per the locked V1 provider set (Apple deferred V1.1
 * per CLAUDE.md 2026-05-23 row 1; GCash auth not in scope · GCash is a
 * payment rail, not an identity provider).
 */
import Link from 'next/link';
import type { Metadata } from 'next';
import { SubmitButton } from '@/app/_components/submit-button';
import { Wordmark } from '@/app/_components/brand-marks';
import { ANY_OAUTH_ENABLED, OAuthButtonRow } from '@/app/_components/oauth-button-row';
import { safeNext } from '@/lib/auth';
import { signInWithMagicLink, signInWithPassword } from './actions';

export const metadata: Metadata = {
  title: 'Sign in · Setnayan',
  description:
    'Sign in to your Setnayan account. One account for couples planning their wedding and vendors selling their services.',
  alternates: { canonical: '/login' },
};

type SearchParams = Promise<{
  error?: string;
  sent?: string;
  check_email?: string;
  ready?: string;
  next?: string;
}>;

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const errorMessage = params.error ? decodeURIComponent(params.error) : null;
  const magicLinkSent = params.sent === '1';
  const justSignedUpEmail = params.check_email
    ? decodeURIComponent(params.check_email)
    : null;
  const readyEmail = params.ready ? decodeURIComponent(params.ready) : null;
  const prefilledEmail = readyEmail ?? '';
  const next = safeNext(params.next);
  const signupHref = `/signup${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`;

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
        className="m-login-card"
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
        {/* Brand panel · stacked on mobile, becomes left column on lg+ via
            .m-login-card css. Gradient + tagline mirror the template's
            LoginScreen left rail (1fr column on desktop). */}
        <div
          className="m-login-brand"
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
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
              }}
            >
              Welcome back
            </div>
            <h2
              className="m-serif"
              style={{
                fontSize: 34,
                lineHeight: 1.04,
                margin: '12px 0 0',
                color: 'var(--m-ink)',
                fontWeight: 400,
                letterSpacing: '-0.02em',
              }}
            >
              Pick up{' '}
              <em style={{ fontStyle: 'italic', color: 'var(--m-blush-deep)' }}>
                where you left off.
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
              Your guest list is right where you saved it.
            </p>
          </div>
          <div
            className="m-mono"
            style={{
              fontSize: 10,
              color: 'var(--m-slate-2)',
              letterSpacing: '0.06em',
              marginTop: 'auto',
            }}
          >
            setnayan.com
          </div>
        </div>

        {/* Form panel · right column on lg+. The email + password + magic-link
            forms are wired to existing Supabase Auth server actions; only the
            visual chrome around them is v2.1 template-derived. */}
        <div
          style={{
            padding: '36px 32px',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
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
            Sign in
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

          {magicLinkSent ? (
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
              Magic link sent. Check your email to finish signing in.
            </p>
          ) : null}

          {justSignedUpEmail ? (
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
              Account created. We sent a confirmation link to{' '}
              <span style={{ fontWeight: 600 }}>{justSignedUpEmail}</span> — open it to
              finish, then sign in below.
            </p>
          ) : null}

          {readyEmail ? (
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
              Your account is ready. Sign in below with{' '}
              <span style={{ fontWeight: 600 }}>{readyEmail}</span>.
            </p>
          ) : null}

          {/* OAuth row above email form per industry-standard placement (PR #422
              from CLAUDE.md 2026-05-23 row 1). When ANY_OAUTH_ENABLED is false,
              the row collapses to null and the divider hides automatically. */}
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
                or continue with email
              </span>
              <div style={{ flex: 1, height: 1, background: 'var(--m-line)' }} />
            </div>
          ) : null}

          <form action={signInWithPassword} style={{ display: 'grid', gap: 12 }}>
            <input type="hidden" name="next" value={next} />
            <FormField
              label="Email"
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="you@setnayan.com"
              defaultValue={prefilledEmail}
              required
            />
            <FormField
              label="Password"
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              required
            />
            {/* "Stay signed in" + "Forgot password?" row.
                Canonical Google / Stripe / Linear / GitHub layout — checkbox
                left, forgot link right, single row below the password field.
                Default CHECKED — explicit opt-out only. When unchecked, the
                signInWithPassword server action overwrites Supabase's sb-*
                cookies to session-only so they clear on browser close
                (shared / borrowed device scenario). See ./actions.ts. */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
                fontSize: 12,
              }}
            >
              <label
                htmlFor="remember"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  cursor: 'pointer',
                  color: 'var(--m-slate)',
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
              <Link
                href="/forgot-password"
                style={{
                  color: 'var(--m-orange-2)',
                  textDecoration: 'none',
                  fontWeight: 500,
                }}
              >
                Forgot password?
              </Link>
            </div>
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
              pendingLabel="Signing in…"
            >
              Continue
            </SubmitButton>
          </form>

          {/* Magic-link form preserved as secondary auth method. Visually
              tighter than the password form (single field + secondary button)
              so it reads as the "or just email me a link" affordance. */}
          <form action={signInWithMagicLink} style={{ display: 'grid', gap: 8 }}>
            <input type="hidden" name="next" value={next} />
            <FormField
              label="Or send a magic link"
              id="magic-email"
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="you@setnayan.com"
              required
            />
            <SubmitButton
              className="m-btn-ghost"
              style={{
                padding: '10px 14px',
                fontSize: 13,
                justifyContent: 'center',
                width: '100%',
                background: 'transparent',
                color: 'var(--m-ink)',
                border: '1px solid var(--m-line)',
                borderRadius: 999,
                fontFamily: 'inherit',
                cursor: 'pointer',
                fontWeight: 500,
              }}
              pendingLabel="Sending…"
            >
              Email me a magic link
            </SubmitButton>
          </form>

          <div
            style={{
              fontSize: 12,
              color: 'var(--m-slate)',
              textAlign: 'center',
              marginTop: 8,
            }}
          >
            No account yet?{' '}
            <Link
              href={signupHref}
              style={{
                color: 'var(--m-orange-2)',
                textDecoration: 'none',
                fontWeight: 500,
              }}
            >
              Create one — free
            </Link>
          </div>
        </div>
      </div>

      {/* Responsive: on lg+ the card splits into two columns (brand left,
          form right) at 1fr / 1.1fr ratio matching the template's
          LoginScreen layout. Below the breakpoint it stays single column
          for mobile. Inline `<style>` block scoped via the .m-login-card
          class — no global side-effects. */}
      <style
        // eslint-disable-next-line react/no-unknown-property
        dangerouslySetInnerHTML={{
          __html: `
            @media (min-width: 768px) {
              .m-login-card {
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
 * v2.1 form field · matches the template's FormField component:
 * .m-mono uppercase eyebrow label + bordered input on --m-paper-2 with
 * --m-line border + 8px radius. Native <input> so server actions consume
 * FormData unchanged.
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
