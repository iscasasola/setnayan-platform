import type { CookieOptions } from '@supabase/ssr';

// Persistent-by-default cookie options. Supabase's SSR helper normally sets
// `path: '/'` and `sameSite: 'lax'`, but it may omit `maxAge` for refresh
// tokens — which makes them session cookies that die on browser close. This
// helper fills in any fields Supabase didn't specify, so sessions survive
// browser restarts and PWA relaunches.
//
// Supabase-provided options always win via spread order — we only backstop.
export function applyPersistentCookieDefaults(
  options?: CookieOptions,
): CookieOptions {
  return {
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 365,
    ...options,
  };
}
