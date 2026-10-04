'use client';

/**
 * Phone-app (Capacitor) Google + Apple buttons — the native twin of
 * OAuthButtonRow, rendered ONLY when the server's gate says `native`
 * (lib/oauth-shell-gate.ts: a phone build carrying the `SetnayanSignIn/1`
 * marker). Visually identical to the web row; on tap it runs the native flow
 * (lib/native-oauth.ts) — the Sign in with Apple sheet on iOS, Google in the
 * SYSTEM browser — instead of the server-action redirect Google refuses inside
 * the app's web view. Same NEXT_PUBLIC_OAUTH_* gates as the web row. Facebook
 * is not offered in the app.
 *
 * Apple sits FIRST here: Apple guideline 4.8 requires Sign in with Apple
 * wherever Google is offered, and its HIG asks for it to be at least as
 * prominent as the others.
 */

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { GoogleGIcon, AppleIcon } from '@/app/_components/oauth-icons';
import type { NativeOAuthProvider } from '@/lib/native-oauth-plan';
import { envFlagEnabled } from '@/lib/env-flag';

const GOOGLE_ENABLED = envFlagEnabled(process.env.NEXT_PUBLIC_OAUTH_GOOGLE_ENABLED);
const APPLE_ENABLED = envFlagEnabled(process.env.NEXT_PUBLIC_OAUTH_APPLE_ENABLED);

const BTN =
  'flex min-h-[44px] w-full items-center justify-center gap-3 rounded-md border border-ink/20 bg-white px-4 py-2.5 text-sm font-medium text-ink/90 transition-colors hover:border-ink/40 hover:bg-ink/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta/40 disabled:cursor-not-allowed disabled:opacity-60';

export function NativeOAuthButtons({
  next,
  verb = 'Continue with',
  accountType = 'customer',
}: {
  next: string;
  verb?: string;
  /** /signup and /open-shop carry the vendor intent, as the web row does. */
  accountType?: 'customer' | 'vendor';
}) {
  const [pending, setPending] = useState<NativeOAuthProvider | null>(null);
  // Apple's sheet is required next to Google (4.8): no Google button without
  // it. The gate (oauthGate) already hides the whole row then; this is the floor.
  if (!APPLE_ENABLED) return null;

  const run = (provider: NativeOAuthProvider) => {
    setPending(provider);
    // Resolves false when the person closed the sheet / browser → buttons back.
    // On success the page navigates away; on failure the helper routes to /login?error.
    // Loaded on tap, not with the page: this row only renders inside the phone
    // app, yet a static import put the whole native flow (bridge, Turnstile,
    // callback plan) into the first load of /, /login, /signup, /open-shop for
    // every web visitor (+3 kB on /, train 2026-10-04 e). Same call, same order.
    import('@/lib/native-oauth')
      .then(({ signInWithProviderNative }) => signInWithProviderNative(provider, next, accountType))
      .then((left) => {
        if (!left) setPending(null);
      })
      .catch(() => setPending(null));
  };

  return (
    <div className="space-y-2.5">
      <button type="button" className={BTN} disabled={pending !== null} onClick={() => run('apple')}>
        {pending === 'apple' ? (
          <Loader2 className="h-[18px] w-[18px] animate-spin" aria-hidden />
        ) : (
          <AppleIcon fill="#000000" />
        )}
        {`${verb} Apple`}
      </button>
      {GOOGLE_ENABLED ? (
        <button type="button" className={BTN} disabled={pending !== null} onClick={() => run('google')}>
          {pending === 'google' ? (
            <Loader2 className="h-[18px] w-[18px] animate-spin" aria-hidden />
          ) : (
            <GoogleGIcon />
          )}
          {`${verb} Google`}
        </button>
      ) : null}
    </div>
  );
}
