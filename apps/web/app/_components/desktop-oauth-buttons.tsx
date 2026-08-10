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
import { GoogleGIcon, AppleIcon, FacebookIcon } from '@/app/_components/oauth-icons';
import { signInWithProviderDesktop, type DesktopOAuthProvider } from '@/lib/desktop-oauth';
import { envFlagEnabled } from '@/lib/env-flag';

const GOOGLE_ENABLED = envFlagEnabled(process.env.NEXT_PUBLIC_OAUTH_GOOGLE_ENABLED);
const APPLE_ENABLED = envFlagEnabled(process.env.NEXT_PUBLIC_OAUTH_APPLE_ENABLED);
/**
 * 🔴 FACEBOOK IS HARD-OFF — MEASURED BROKEN ON THE LIVE SIGN-IN PAGE 2026-08-10.
 *
 * The flag alone is not enough, and the docblock above ("ships OFF") is stale
 * against production: the environment has it ON, so all three buttons render at
 * https://www.setnayan.com/login today. Probed directly against the auth server:
 *
 *   provider=google   → 302 (configured)
 *   provider=apple    → 302 (configured)
 *   provider=facebook → 400  ← a first-time visitor fails at the FIRST screen
 *
 * Nobody had configured the Meta credentials in Supabase, so the flag was
 * offering a door with no room behind it. Owner 2026-08-10: *"we will add this
 * but after all is built."*
 *
 * 🔑 A FLAG SAYS "SHOW IT"; IT CANNOT SAY "IT WORKS." That is why this is a
 * separate constant rather than a flag flip — the flag's job is the owner's
 * intent, and this one's job is whether the provider exists. Both must be true.
 *
 * TO RE-ENABLE: paste the Meta app credentials into Supabase Studio, confirm
 * `…/auth/v1/authorize?provider=facebook` answers 302, then set this to `true`
 * in the SAME change. Do not flip it on the strength of the env flag alone —
 * that is exactly how it got here.
 */
const FACEBOOK_PROVIDER_CONFIGURED = false;

const FACEBOOK_ENABLED =
  FACEBOOK_PROVIDER_CONFIGURED &&
  envFlagEnabled(process.env.NEXT_PUBLIC_OAUTH_FACEBOOK_ENABLED);

const BTN_LIGHT =
  'flex w-full items-center justify-center gap-3 rounded-md border border-ink/20 bg-white px-4 py-2.5 text-sm font-medium text-ink/90 transition-colors hover:border-ink/40 hover:bg-ink/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta/40 disabled:cursor-not-allowed disabled:opacity-60';

export function DesktopOAuthButtons({ next }: { next: string }) {
  const [pending, setPending] = useState<DesktopOAuthProvider | null>(null);
  if (!GOOGLE_ENABLED && !APPLE_ENABLED && !FACEBOOK_ENABLED) return null;
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
      {FACEBOOK_ENABLED ? (
        <button
          type="button"
          className={BTN}
          disabled={pending !== null}
          onClick={() => run('facebook')}
        >
          {pending === 'facebook' ? (
            <Loader2 className="h-[18px] w-[18px] animate-spin" aria-hidden />
          ) : (
            <FacebookIcon />
          )}
          {pending === 'facebook' ? 'Opening your browser…' : 'Continue with Facebook'}
        </button>
      ) : null}
    </div>
  );
}
