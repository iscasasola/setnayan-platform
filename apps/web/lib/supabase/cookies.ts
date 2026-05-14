import type { CookieOptions } from '@supabase/ssr';

const ONE_YEAR_S = 60 * 60 * 24 * 365;
const TEN_YEARS_S = ONE_YEAR_S * 10;

export type CookieClientHint = {
  // Treat as the desktop app (Tauri) or an installed PWA — both get the
  // extended 10-year cookie maxAge and a more aggressive proactive-refresh
  // window in the session-refresh middleware. Plain browser visits don't.
  isNativeLike?: boolean;
};

// Persistent-by-default cookie options. Supabase's SSR helper normally sets
// `path: '/'` and `sameSite: 'lax'`, but it may omit `maxAge` for refresh
// tokens — which makes them session cookies that die on browser close. This
// helper fills in any fields Supabase didn't specify, so sessions survive
// browser restarts and PWA / desktop-app relaunches.
//
// Supabase-provided options always win via spread order — we only backstop.
export function applyPersistentCookieDefaults(
  options?: CookieOptions,
  hint: CookieClientHint = {},
): CookieOptions {
  const maxAge = hint.isNativeLike ? TEN_YEARS_S : ONE_YEAR_S;
  return {
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge,
    ...options,
  };
}

export function readClientType(cookieValue: string | undefined): CookieClientHint {
  return {
    isNativeLike: cookieValue === 'pwa' || cookieValue === 'tauri',
  };
}
