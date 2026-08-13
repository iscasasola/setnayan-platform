/**
 * Client-side OAuth visibility — the shell gate, resolved in the browser.
 *
 * EXTRACTED from HomeOverlays.tsx (2026-08-13, the seam) so the marketing nav
 * and the in-place sign-in cannot drift apart on WHO SEES GOOGLE. There is one
 * copy; a second would be two hand-typed things pretending to be a rule.
 *
 * Mirror of lib/request-platform.ts#getClientShell → OAuth gate. Same rules:
 * `SetnayanApp/desktop` UA → desktop; any other SetnayanApp UA or a
 * capacitor/tauri client-type cookie or a live Capacitor bridge → mobile
 * (WebView — Google refuses OAuth in an embedded view, so it stays hidden);
 * else web. Safe before mount (returns hidden).
 */
import { ANY_OAUTH_ENABLED } from '@/app/_components/oauth-button-row';

export type SignInOAuth = { show: boolean; desktop: boolean };

export function detectSignInOAuth(): SignInOAuth {
  if (typeof navigator === 'undefined' || typeof document === 'undefined') {
    return { show: false, desktop: false };
  }
  const ua = navigator.userAgent || '';
  let shell: 'web' | 'desktop' | 'mobile';
  if (/SetnayanApp\/desktop/i.test(ua)) {
    shell = 'desktop';
  } else {
    const clientType =
      document.cookie
        .split('; ')
        .find((c) => c.startsWith('setnayan-client-type='))
        ?.split('=')[1] ?? '';
    const capacitor = Boolean(
      (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
        ?.isNativePlatform?.(),
    );
    shell =
      /SetnayanApp/i.test(ua) || clientType === 'capacitor' || clientType === 'tauri' || capacitor
        ? 'mobile'
        : 'web';
  }
  const show = ANY_OAUTH_ENABLED && shell !== 'mobile';
  return { show, desktop: show && shell === 'desktop' };
}
