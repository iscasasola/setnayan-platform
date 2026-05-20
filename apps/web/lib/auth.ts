import 'server-only';
import { cache } from 'react';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

// Per-request memoization of `supabase.auth.getUser()`. Each dashboard
// navigation used to call `getUser()` from middleware, the outer layout,
// the event layout, and the page — four sequential auth-server round-trips
// in a row. With this helper they all resolve to the same Promise so the
// auth check fires exactly once per request.
//
// Cache key is the empty argument list (cache() is identity-stable for
// no-arg calls in the same render pass), so user A and user B in concurrent
// requests get separate caches automatically.
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

// Sanitize a user-controlled "next" / "redirect-after-login" string.
// Only same-site relative paths are accepted. Protocol-relative URLs
// (`//evil.com`) are rejected because the browser treats them as
// off-domain. Anything else falls back to `/`.
//
// Centralized so /login, /signup, /auth/callback, and every page-level
// `redirect('/login?next=...')` builder use the same definition.
export function safeNext(raw: unknown): string {
  if (typeof raw !== 'string') return '/';
  if (!raw.startsWith('/')) return '/';
  if (raw.startsWith('//')) return '/';
  return raw;
}

// Build a `/login?next=<safe>` URL for use with `redirect()` from a
// page-level auth gate. Preserves the user's destination through the
// re-auth round trip — without this, a vendor hitting an authed deep
// link gets dropped on the couple dashboard after re-login.
export function loginRedirectPath(currentPath: string): string {
  const next = safeNext(currentPath);
  if (next === '/') return '/login';
  return `/login?next=${encodeURIComponent(next)}`;
}
