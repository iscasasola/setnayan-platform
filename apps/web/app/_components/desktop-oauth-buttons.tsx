'use client';

/**
 * Desktop (Tauri) OAuth buttons — the system-browser + localhost-loopback variant
 * of OAuthButtonRow, rendered ONLY when the server detected the desktop shell
 * (SetnayanApp/desktop UA). Visually identical to the web row; on click it runs
 * the loopback flow (lib/desktop-oauth) instead of the server-action redirect that
 * Google refuses inside the WebView. Same NEXT_PUBLIC_OAUTH_* gates as the web row.
 */

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { GoogleGIcon, AppleIcon } from '@/app/_components/oauth-icons';
import { signInWithProviderDesktop, type DesktopOAuthProvider } from '@/lib/desktop-oauth';

const GOOGLE_ENABLED = process.env.NEXT_PUBLIC_OAUTH_GOOGLE_ENABLED === 'true';
const APPLE_ENABLED = process.env.NEXT_PUBLIC_OAUTH_APPLE_ENABLED === 'true';

const BTN_LIGHT =
  'flex w-full items-center justify-center gap-3 rounded-md border border-ink/20 bg-white px-4 py-2.5 text-sm font-medium text-ink/90 transition-colors hover:border-ink/40 hover:bg-ink/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta/40 disabled:cursor-not-allowed disabled:opacity-60';

export function DesktopOAuthButtons({ next }: { next: string }) {
  const [pending, setPending] = useState<DesktopOAuthProvider | null>(null);
  if (!GOOGLE_ENABLED && !APPLE_ENABLED) return null;
  const BTN = BTN_LIGHT;
  const appleFill = '#000000';

  const run = (provider: DesktopOAuthProvider) => {
    setPending(provider);
    // On success the helper navigates away; on any failure it routes to
    // /login?error. Either way, clear pending if it rejects synchronously.
    signInWithProviderDesktop(provider, next).catch(() => setPending(null));
  };

  return (
    <div className="space-y-2.5">
      {GOOGLE_ENABLED ? (
        <button
          type="button"
          className={BTN}
          disabled={pending !== null}
          onClick={() => run('google')}
        >
          {pending === 'google' ? (
            <Loader2 className="h-[18px] w-[18px] animate-spin" aria-hidden />
          ) : (
            <GoogleGIcon />
          )}
          {pending === 'google' ? 'Opening your browser…' : 'Continue with Google'}
        </button>
      ) : null}
      {APPLE_ENABLED ? (
        <button
          type="button"
          className={BTN}
          disabled={pending !== null}
          onClick={() => run('apple')}
        >
          {pending === 'apple' ? (
            <Loader2 className="h-[18px] w-[18px] animate-spin" aria-hidden />
          ) : (
            <AppleIcon fill={appleFill} />
          )}
          {pending === 'apple' ? 'Opening your browser…' : 'Continue with Apple'}
        </button>
      ) : null}
    </div>
  );
}
