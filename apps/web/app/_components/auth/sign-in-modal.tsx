'use client';

/**
 * Marketing-chrome Sign-in popup — the shared `Nav` (site-nav.tsx) + the legacy
 * `SiteHeader` (site-header.tsx, still on /download + /waitlist) used to hard-
 * navigate "Sign in" to /login. Owner 2026-06-30: *"login should be like the
 * rest of the upper menu. a popup."* (Same directive already applied to the
 * homepage glass nav via HomeOverlays' SignInOverlay; this is the non-homepage
 * marketing equivalent, styled to the --m-* Clean Editorial chrome instead of
 * the home-reskin greige overlay.)
 *
 * REAL login, not a mockup: renders the SAME OAuth row (OAuthButtonRow / the
 * desktop DesktopOAuthButtons loopback) + email/password form as the /login
 * page, wired to the SAME server action (signInWithPassword). The happy path
 * (correct credentials or OAuth) completes from the popup; a credential error
 * redirects to the full /login page with its error banner (the action's
 * existing redirect contract) so the popup degrades gracefully. /login stays
 * the canonical full-page auth surface (deep links, OAuth callbacks, reset).
 *
 * `SignInButton` is the drop-in for an existing "Sign in" link: it renders a
 * <button> carrying the caller's className + the portaled modal, manages its
 * own open state, and self-detects the client shell for OAuth gating (so the
 * root layout never has to read cookies/headers and force marketing pages
 * dynamic — see useClientSignInOAuth). `onOpen` lets a caller (e.g. the mobile
 * hamburger sheet) close itself as the modal opens.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useModalA11y } from '@/lib/use-modal-a11y';
import { SubmitButton } from '@/app/_components/submit-button';
import { ANY_OAUTH_ENABLED, OAuthButtonRow } from '@/app/_components/oauth-button-row';
import { DesktopOAuthButtons } from '@/app/_components/desktop-oauth-buttons';
import { signInWithPassword } from '@/app/login/actions';
import { TurnstileField } from '@/app/_components/auth/turnstile-field';

/**
 * Shell-gated OAuth visibility. `show` mirrors /login's `showOAuth` (a provider
 * is enabled AND this isn't the mobile WebView shell, where Google refuses
 * embedded OAuth); `desktop` picks the Tauri loopback variant over the web
 * server-action row.
 */
export type SignInOAuth = { show: boolean; desktop: boolean };

/**
 * Client-side mirror of lib/request-platform.ts `getClientShell` — used so the
 * marketing nav can gate OAuth WITHOUT making the root layout read
 * cookies()/headers() (which would opt static marketing pages out of static
 * rendering). Runs on mount; until it resolves it assumes `web` (the common
 * case → OAuth shows without flash on browsers). Because the trigger button is
 * mounted long before the user opens the modal, the shell is already correct by
 * the time the popup appears, so the mobile shell never flashes a dead OAuth
 * button.
 */
function useClientSignInOAuth(): SignInOAuth {
  const [shell, setShell] = useState<'web' | 'desktop' | 'mobile'>('web');
  useEffect(() => {
    const ua = navigator.userAgent || '';
    const clientType =
      document.cookie
        .split('; ')
        .find((c) => c.startsWith('setnayan-client-type='))
        ?.split('=')[1] ?? '';
    if (/SetnayanApp\/desktop/i.test(ua)) setShell('desktop');
    else if (/SetnayanApp/i.test(ua) || clientType === 'capacitor' || clientType === 'tauri')
      setShell('mobile');
    else setShell('web');
  }, []);
  return {
    show: ANY_OAUTH_ENABLED && shell !== 'mobile',
    desktop: ANY_OAUTH_ENABLED && shell === 'desktop',
  };
}

export function SignInModal({
  open,
  onClose,
  oauth,
}: {
  open: boolean;
  onClose: () => void;
  oauth: SignInOAuth;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useModalA11y({ open, onClose, containerRef: ref });
  // No explicit `next`: '/' lets signInWithPassword route to the account home
  // by account_type — same default the /login page passes without a ?next.
  const next = '/';
  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-labelledby="sign-in-modal-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: 'max(6vh, 32px) 16px',
        overflowY: 'auto',
        background: 'rgba(38,38,36,0.42)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        fontFamily: 'var(--font-sans-marketing, Geist), system-ui, sans-serif',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 420,
          margin: 'auto',
          background: 'var(--m-paper)',
          border: '1px solid var(--m-line)',
          borderRadius: 'var(--m-r-lg)',
          boxShadow: '0 30px 80px -25px rgba(45,48,56,0.3)',
          padding: '28px 26px 24px',
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            position: 'absolute',
            top: 14,
            right: 14,
            width: 34,
            height: 34,
            borderRadius: '50%',
            border: '1px solid var(--m-line)',
            background: 'var(--m-paper)',
            color: 'var(--m-ink)',
            cursor: 'pointer',
            fontSize: 14,
            lineHeight: 1,
          }}
        >
          ✕
        </button>

        <div
          className="m-mono"
          style={{
            fontSize: 10,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: 'var(--m-slate-2)',
          }}
        >
          Welcome back
        </div>
        <h2
          id="sign-in-modal-title"
          style={{
            margin: '6px 0 4px',
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: '-0.01em',
            color: 'var(--m-ink)',
          }}
        >
          Sign in to Setnayan
        </h2>
        <p style={{ margin: '0 0 18px', fontSize: 13, lineHeight: 1.5, color: 'var(--m-slate)' }}>
          One account for couples and vendors. Pick up right where you left off.
        </p>

        {/* OAuth above the email form — same placement + components as /login.
            Shell-gated server-side; desktop gets the loopback variant. */}
        {oauth.show ? (
          oauth.desktop ? <DesktopOAuthButtons next={next} /> : <OAuthButtonRow next={next} />
        ) : null}

        {oauth.show ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              margin: '14px 0',
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
          <TurnstileField action="login" />
          <ModalField
            label="Email"
            id="sign-in-modal-email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="you@setnayan.com"
          />
          <ModalField
            label="Password"
            id="sign-in-modal-password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
          />
          {/* "Stay signed in" defaults CHECKED — explicit opt-out only (matches
              /login; the server action downgrades sb-* cookies to session-only
              when unchecked). */}
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
              htmlFor="sign-in-modal-remember"
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
                id="sign-in-modal-remember"
                name="remember"
                type="checkbox"
                defaultChecked
                style={{ width: 14, height: 14, accentColor: 'var(--m-orange)', cursor: 'pointer' }}
              />
              <span>Stay signed in</span>
            </label>
            <Link
              href="/forgot-password"
              onClick={onClose}
              style={{ color: 'var(--m-orange-2)', textDecoration: 'none', fontWeight: 500 }}
            >
              Forgot password?
            </Link>
          </div>
          <SubmitButton
            className="m-btn m-btn-orange"
            style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}
            pendingLabel="Signing in…"
          >
            Continue
          </SubmitButton>
        </form>

        <div style={{ marginTop: 16, textAlign: 'center', fontSize: 12, color: 'var(--m-slate)' }}>
          No account yet?{' '}
          <Link
            href="/signup"
            onClick={onClose}
            style={{ color: 'var(--m-orange-2)', textDecoration: 'none', fontWeight: 500 }}
          >
            Create one — free
          </Link>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * Drop-in replacement for an existing "Sign in" link: a <button> carrying the
 * caller's className + the portaled modal, managing its own open state.
 */
export function SignInButton({
  className,
  children = 'Sign in',
  onOpen,
}: {
  className?: string;
  children?: ReactNode;
  onOpen?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const oauth = useClientSignInOAuth();
  return (
    <>
      <button
        type="button"
        className={className}
        onClick={() => {
          onOpen?.();
          setOpen(true);
        }}
      >
        {children}
      </button>
      <SignInModal open={open} onClose={() => setOpen(false)} oauth={oauth} />
    </>
  );
}

function ModalField({
  label,
  id,
  name,
  type = 'text',
  placeholder,
  autoComplete,
  inputMode,
}: {
  label: string;
  id: string;
  name: string;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  inputMode?: 'email' | 'text' | 'tel' | 'numeric' | 'search' | 'url';
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
        required
        autoComplete={autoComplete}
        inputMode={inputMode}
        style={{
          width: '100%',
          padding: '10px 12px',
          background: 'var(--m-paper-2)',
          border: '1px solid var(--m-line)',
          borderRadius: 'var(--m-r-sm)',
          fontSize: 14,
          fontFamily: 'inherit',
          color: 'var(--m-ink)',
          outline: 'none',
          boxSizing: 'border-box',
        }}
      />
    </div>
  );
}
