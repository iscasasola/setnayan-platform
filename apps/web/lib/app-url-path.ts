import { isSafeNext } from '@/lib/safe-next';

/**
 * A link that opened the phone app → the path the app's web view should show.
 *
 * EXTRACTED from app/_components/native-bridge.tsx (2026-10-04, B3) so the
 * `appUrlOpen` handler and the native sign-in return (lib/native-oauth.ts) read
 * ONE mapping, and so it can be tested without a phone.
 *
 *   https://www.setnayan.com/<path>?q   → /<path>?q
 *   setnayan://<host>/<path>?q          → /<host>/<path>?q
 *     e.g. setnayan://auth/callback?code=…&next=/x → /auth/callback?code=…&next=/x
 *
 * Anything else (another scheme, a malformed URL) → null: ignore it.
 *
 * 🔒 The custom scheme can be opened by ANY app or web page, so the mapped
 * path goes through THE ONE RULE (lib/safe-next.ts) before the web view is sent
 * there: `setnayan:////evil.com` maps to `//evil.com`, which would leave the
 * site inside the app. Unsafe → null.
 */
export function appUrlToPath(url: string | null | undefined): string | null {
  if (!url) return null;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  let mapped: string | null = null;
  if (u.protocol === 'https:') mapped = u.pathname + u.search;
  else if (u.protocol === 'setnayan:') {
    const path = (u.host ? `/${u.host}` : '') + u.pathname;
    mapped = (path || '/') + u.search;
  }
  return isSafeNext(mapped) ? mapped : null;
}
