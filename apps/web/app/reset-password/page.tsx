/**
 * /reset-password — set a new password after following a recovery email.
 *
 * The recovery link from /forgot-password routes through the existing
 * /auth/callback code-exchange (same mechanics as magic-link login), which
 * establishes a session and forwards here. So:
 *   - session present → show the new-password form (./actions.ts completes
 *     the reset + revokes other sessions + routes to the role home)
 *   - no session → the link was already used / expired → friendly
 *     "link expired" state with a path back to /forgot-password
 *
 * Visual register mirrors /login + /forgot-password (v2.1 paper-and-ink
 * editorial, --m-* variables) as a single-column card.
 */
import Link from 'next/link';
import type { Metadata } from 'next';
import { SubmitButton } from '@/app/_components/submit-button';
import { Wordmark } from '@/app/_components/brand-marks';
import { createClient } from '@/lib/supabase/server';
import { completePasswordReset } from './actions';

export const metadata: Metadata = {
  title: 'Choose a new password · Setnayan',
  description: 'Finish resetting your Setnayan account password.',
  robots: { index: false },
};

type SearchParams = Promise<{
  error?: string;
}>;

const cardStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: 460,
  background: 'var(--m-paper)',
  borderRadius: 'var(--m-r-lg)',
  overflow: 'hidden',
  border: '1px solid var(--m-line)',
  boxShadow: '0 30px 60px -25px rgba(45,48,56,0.18)',
  padding: '36px 32px',
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
};

const mainStyle: React.CSSProperties = {
  minHeight: '100dvh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '24px 16px',
  background: 'var(--m-paper)',
  fontFamily: 'var(--font-sans-marketing, Geist), system-ui, sans-serif',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  background: 'var(--m-paper-2)',
  border: '1px solid var(--m-line)',
  borderRadius: 'var(--m-r-sm)',
  fontSize: 13,
  fontFamily: 'inherit',
  color: 'var(--m-ink)',
  outline: 'none',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 10,
  color: 'var(--m-slate-2)',
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  marginBottom: 4,
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const errorMessage = params.error ? decodeURIComponent(params.error) : null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // Recovery links are single-use and short-lived — landing here without a
    // session means the link was already used or has expired.
    return (
      <main style={mainStyle}>
        <div style={cardStyle}>
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
              This link has{' '}
              <em style={{ fontStyle: 'italic', color: 'var(--m-blush-deep)' }}>
                expired.
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
              Reset links work once and expire after a short while. Request a
              fresh one and you&rsquo;ll be back in shortly.
            </p>
          </div>
          <Link
            href="/forgot-password"
            className="m-btn-orange"
            style={{
              padding: '12px 18px',
              fontSize: 14,
              textAlign: 'center',
              background: 'var(--m-orange)',
              color: 'var(--m-paper)',
              border: 'none',
              borderRadius: 'var(--m-r-full)',
              fontFamily: 'inherit',
              fontWeight: 500,
              textDecoration: 'none',
            }}
          >
            Request a new reset link
          </Link>
          <div
            style={{
              fontSize: 12,
              color: 'var(--m-slate)',
              textAlign: 'center',
            }}
          >
            Remembered your password?{' '}
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

  return (
    <main style={mainStyle}>
      <div style={cardStyle}>
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
            Choose a{' '}
            <em style={{ fontStyle: 'italic', color: 'var(--m-blush-deep)' }}>
              new password.
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
            Minimum 8 characters. For safety, every other device gets signed
            out once your new password is saved.
          </p>
        </div>

        {errorMessage ? (
          <p
            role="alert"
            style={{
              margin: 0,
              padding: '10px 12px',
              borderRadius: 'var(--m-r-sm)',
              border: '1px solid var(--m-orange-3)',
              background: 'var(--m-orange-4)',
              color: 'var(--m-orange-2)',
              fontSize: 13,
            }}
          >
            {errorMessage}
          </p>
        ) : null}

        <form action={completePasswordReset} style={{ display: 'grid', gap: 12 }}>
          <div>
            <label htmlFor="new_password" className="m-mono" style={labelStyle}>
              New password
            </label>
            <input
              id="new_password"
              name="new_password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              placeholder="••••••••"
              style={inputStyle}
            />
          </div>
          <div>
            <label
              htmlFor="confirm_password"
              className="m-mono"
              style={labelStyle}
            >
              Confirm new password
            </label>
            <input
              id="confirm_password"
              name="confirm_password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              placeholder="••••••••"
              style={inputStyle}
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
              borderRadius: 'var(--m-r-full)',
              fontFamily: 'inherit',
              cursor: 'pointer',
              fontWeight: 500,
            }}
            pendingLabel="Saving…"
          >
            Save new password
          </SubmitButton>
        </form>
      </div>
    </main>
  );
}
