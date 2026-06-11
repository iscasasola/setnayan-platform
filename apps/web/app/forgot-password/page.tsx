/**
 * /forgot-password — public password-recovery request page.
 *
 * WHY THIS ROUTE EXISTS: the /login page has linked "Forgot password?" →
 * /forgot-password since the v2.1 port, but the route never existed — the
 * URL fell through to the `[slug]` event catch-all and rendered garbage with
 * HTTP 200. A static segment takes precedence over the catch-all, so this
 * page fixes the live dead link.
 *
 * Visual register mirrors /login (v2.1 paper-and-ink editorial: --m-* CSS
 * variables, .m-mono eyebrows, .m-serif italics, Wordmark) as a single-column
 * card — the recovery flow doesn't need the two-column brand panel.
 *
 * Anti-enumeration: the confirmation copy is identical whether or not an
 * account exists for the email (see ./actions.ts).
 */
import Link from 'next/link';
import type { Metadata } from 'next';
import { SubmitButton } from '@/app/_components/submit-button';
import { Wordmark } from '@/app/_components/brand-marks';
import { requestPasswordReset } from './actions';

export const metadata: Metadata = {
  title: 'Reset your password · Setnayan',
  description:
    'Request a password-reset link for your Setnayan account. One account for couples planning their wedding and vendors selling their services.',
  alternates: { canonical: '/forgot-password' },
};

type SearchParams = Promise<{
  sent?: string;
  error?: string;
}>;

const ERROR_COPY: Record<string, string> = {
  missing: 'Enter the email you signed up with.',
  rate_limited:
    'Too many reset requests in a row — please wait a minute, then try again.',
};

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const sent = params.sent === '1';
  const errorMessage = params.error
    ? (ERROR_COPY[params.error] ?? 'Something went wrong — please try again.')
    : null;

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
        style={{
          width: '100%',
          maxWidth: 460,
          background: 'var(--m-paper)',
          borderRadius: 18,
          overflow: 'hidden',
          border: '1px solid var(--m-line)',
          boxShadow: '0 30px 60px -25px rgba(45,48,56,0.18)',
          padding: '36px 32px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
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
            Account recovery
          </div>
          <h1
            className="m-serif"
            style={{
              fontSize: 30,
              lineHeight: 1.08,
              margin: '10px 0 0',
              color: 'var(--m-ink)',
              fontWeight: 400,
              letterSpacing: '-0.02em',
            }}
          >
            Forgot your{' '}
            <em style={{ fontStyle: 'italic', color: 'var(--m-blush-deep)' }}>
              password?
            </em>
          </h1>
          <p
            className="m-serif"
            style={{
              fontStyle: 'italic',
              fontSize: 14,
              color: 'var(--m-slate)',
              marginTop: 10,
              lineHeight: 1.55,
            }}
          >
            Tell us your email and we&rsquo;ll send a link to set a new one.
          </p>
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

        {sent ? (
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
            If an account exists for that email, a reset link is on its way.
            Check your inbox (and spam folder) — the link works once and
            expires after a short while.
          </p>
        ) : null}

        <form action={requestPasswordReset} style={{ display: 'grid', gap: 12 }}>
          <div>
            <label
              htmlFor="email"
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
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="you@setnayan.com"
              required
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
          <SubmitButton
            className="m-btn-orange"
            style={{
              padding: '12px 18px',
              fontSize: 14,
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
            pendingLabel="Sending…"
          >
            Email me a reset link
          </SubmitButton>
        </form>

        <div
          style={{
            fontSize: 12,
            color: 'var(--m-slate)',
            textAlign: 'center',
            marginTop: 4,
          }}
        >
          Remembered it?{' '}
          <Link
            href="/login"
            style={{
              color: 'var(--m-orange-2)',
              textDecoration: 'none',
              fontWeight: 500,
            }}
          >
            Back to sign in
          </Link>
        </div>
      </div>
    </main>
  );
}
