/**
 * Client-side OAuth visibility — the shell gate, resolved in the browser.
 *
 * EXTRACTED from HomeOverlays.tsx (2026-08-13, the seam) so the marketing nav
 * and the in-place sign-in cannot drift apart on WHO SEES GOOGLE. There is one
 * copy; a second would be two hand-typed things pretending to be a rule.
 *
 * The SAME function as the server's gate (lib/oauth-shell-gate.ts `oauthGate`),
 * fed from the browser: `SetnayanApp/desktop` UA → desktop; any other
 * SetnayanApp UA or a capacitor/tauri client-type cookie or a live Capacitor
 * bridge → mobile, which shows the NATIVE buttons only in a build carrying
 * `SetnayanSignIn/1` (Google refuses OAuth in an embedded view, so the web row
 * never shows there); else web. Safe before mount (returns hidden).
 */
import { OAUTH_FLAGS } from '@/app/_components/oauth-button-row';
import { classifyShell, oauthGate, type OAuthGate } from '@/lib/oauth-shell-gate';

export type SignInOAuth = OAuthGate;

export function detectSignInOAuth(): SignInOAuth {
  if (typeof navigator === 'undefined' || typeof document === 'undefined') {
    return { show: false, desktop: false, native: false };
  }
  const ua = navigator.userAgent || '';
  const clientType =
    document.cookie
      .split('; ')
      .find((c) => c.startsWith('setnayan-client-type='))
      ?.split('=')[1] ?? '';
  const capacitor = Boolean(
    (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
      ?.isNativePlatform?.(),
  );
  return oauthGate(classifyShell(ua, clientType, capacitor), ua, OAUTH_FLAGS);
}
