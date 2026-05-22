/**
 * Admin-only demo-mode flag.
 *
 * Lets admins (and only admins) flip a session-scoped switch that:
 *   1. surfaces `vendors.is_demo = TRUE` rows in the marketplace + on
 *      `/v/[slug]`, which are otherwise hidden,
 *   2. forces those demo vendors to display PHP pricing publicly even
 *      though the 2026-05-16 hide-prices lock (per CLAUDE.md row 458)
 *      keeps real-vendor pricing tucked behind the apply/register flow.
 *
 * Real-vendor public posture (the hide-prices lock + the
 * `is_demo IS NOT TRUE` filter) is INTENTIONALLY unchanged outside
 * demo mode — owner-approved 2026-05-22 evening per the PR brief that
 * follows decision-log row 460+. This module is the gate; everywhere
 * else that needs demo behavior calls one of these helpers.
 *
 * Why admin-only at every layer?
 *   - The flag changes what couples WOULD see if prices went public,
 *     so even an authenticated non-admin user must never see demo
 *     content.
 *   - Non-admin sessions silently ignore the flag (no error, no
 *     redirect) to avoid leaking demo-mode existence to crawlers that
 *     might guess `?demo=1`.
 *
 * Coordinates with two sibling PRs in the marketplace simulation
 * workstream:
 *   - PR 1 adds the `vendors.is_demo BOOLEAN DEFAULT FALSE` column +
 *     `/admin/demo-vendors` cleanup page (Agent 1)
 *   - PR 3 imports `isDemoMode()` from this module to gate the compare
 *     view (Agent 3)
 *
 * Hard cutover deadline: Dec 1, 2026 — demo data must be cleaned out
 * before public V1 launch. The banner reiterates this.
 */

import type { NextRequest } from 'next/server';
import type { NextResponse } from 'next/server';

/**
 * Canonical cookie name. 24h max-age, httpOnly, secure in production,
 * sameSite=lax. Reads same way the supabase auth cookies do.
 */
export const DEMO_MODE_COOKIE_NAME = 'setnayan_demo_mode';

/**
 * Canonical query-param name. When present with value '1' (or 'on'),
 * the URL bootstrap in `apps/web/middleware.ts` writes the cookie and
 * strips the param. `?demo=0` clears the cookie. Anything else is a
 * no-op.
 */
export const DEMO_MODE_QUERY_PARAM = 'demo';

/**
 * 24-hour TTL on the cookie. Long enough to dogfood a flow end-to-end
 * during a session; short enough that an admin who closes their laptop
 * and walks away doesn't leave demo mode armed indefinitely.
 */
export const DEMO_MODE_COOKIE_MAX_AGE_S = 60 * 60 * 24;

/**
 * Demo data must be cleaned out before public V1 launch. Surfaced in
 * the banner and the admin toggle UI as a reminder. Iso string for
 * easy formatting; PHT (+08:00) so the banner reads cleanly.
 */
export const DEMO_MODE_CLEANUP_DEADLINE = '2026-12-01T00:00:00+08:00';

/**
 * Minimal shape of the per-request inputs we read. Modeled as a union
 * so callers can hand us either a `NextRequest` (middleware / route
 * handlers) or a hand-rolled `{ cookies, searchParams }` (server
 * components where we read cookies via `next/headers` and search
 * params via `searchParams` props).
 *
 * The accessor shape `{ get(name): { value: string } | undefined }`
 * intentionally matches both `NextRequest['cookies']` and the iterable
 * `ReadonlyRequestCookies` returned by `cookies()` from `next/headers`.
 */
export type DemoModeRequest =
  | NextRequest
  | {
      cookies: {
        get(name: string): { value: string } | undefined;
      };
      searchParams?: URLSearchParams | { get(name: string): string | null };
    };

/**
 * Shape of the admin claim we accept. Mirrors the `users` table read
 * in `apps/web/app/admin/layout.tsx` — admin = `account_type='admin'`
 * OR `is_internal` OR `is_team_member`. Callers resolve this from
 * Supabase before calling `isDemoMode`.
 */
export type AdminProfileClaim = {
  account_type?: string | null;
  is_internal?: boolean | null;
  is_team_member?: boolean | null;
};

/**
 * Coarse-grained predicate: does this profile have admin grants? The
 * three flags map to the same `isAdmin` derivation used everywhere
 * else (`admin/layout.tsx`, `api/admin/sentry-smoke-test/route.ts`,
 * etc.), kept here so demo-mode callers don't have to redefine it.
 */
export function isAdminProfile(profile: AdminProfileClaim | null | undefined): boolean {
  if (!profile) return false;
  return (
    profile.account_type === 'admin' ||
    profile.is_internal === true ||
    profile.is_team_member === true
  );
}

function readQueryParam(
  request: DemoModeRequest,
  name: string,
): string | null {
  // NextRequest has `.nextUrl.searchParams`. Hand-rolled object may
  // expose `searchParams` directly (URLSearchParams or duck-typed).
  if ('nextUrl' in request && request.nextUrl) {
    return request.nextUrl.searchParams.get(name);
  }
  const sp = (request as { searchParams?: unknown }).searchParams;
  if (!sp) return null;
  if (typeof (sp as URLSearchParams).get === 'function') {
    return (sp as URLSearchParams).get(name);
  }
  return null;
}

function readCookie(request: DemoModeRequest, name: string): string | null {
  const cookie = request.cookies.get(name);
  return cookie?.value ?? null;
}

/**
 * The core predicate. Returns `true` if and only if:
 *   (a) `profile` resolves to admin (per `isAdminProfile`), AND
 *   (b) at least one of:
 *       - the request carries `?demo=1` (or `?demo=on`) as a query
 *         param, OR
 *       - the request carries the `setnayan_demo_mode` cookie set
 *         to '1'.
 *
 * For non-admin sessions: ALWAYS returns false. Silently. No error,
 * no redirect, no telemetry — even if the request includes the flag.
 *
 * Pass the resolved admin profile in — this module deliberately does
 * NOT call Supabase itself so callers can reuse already-resolved
 * profile data (e.g., from `getCurrentUser` + a single `users` read
 * already happening in the page render) without a duplicate roundtrip.
 *
 * Safe to call in middleware, server actions, server components,
 * route handlers. Pure synchronous logic.
 */
export function isDemoMode(
  request: DemoModeRequest,
  profile: AdminProfileClaim | null | undefined,
): boolean {
  if (!isAdminProfile(profile)) return false;

  const queryValue = readQueryParam(request, DEMO_MODE_QUERY_PARAM);
  if (queryValue === '1' || queryValue === 'on') return true;
  // `?demo=0` is explicitly NOT an active signal here — the URL-flag
  // bootstrap in middleware clears the cookie when it sees it, but a
  // hand-rolled query string with `?demo=0` shouldn't keep demo mode
  // armed via the cookie either. Cookie-only check still applies.

  const cookieValue = readCookie(request, DEMO_MODE_COOKIE_NAME);
  if (cookieValue === '1') return true;

  return false;
}

/**
 * Convenience: combines a fresh Supabase profile lookup with the
 * predicate above. Use this when you don't already have the profile
 * in hand (e.g., from a server component that hasn't read `users`
 * yet). Returns `false` for unauthenticated visitors without any
 * roundtrip.
 *
 * Imports lazily — keeps this module free of circular dependencies
 * with `lib/supabase/server.ts`, which is helpful for unit-style
 * smoke testing.
 */
export async function isDemoModeFromRequest(
  request: DemoModeRequest,
): Promise<boolean> {
  // Cheap pre-check: if neither the cookie nor the query param is
  // set, no need to even hit Supabase. Non-admin sessions branching
  // through this fast path stay zero-cost.
  const queryValue = readQueryParam(request, DEMO_MODE_QUERY_PARAM);
  const cookieValue = readCookie(request, DEMO_MODE_COOKIE_NAME);
  const flagPresent =
    queryValue === '1' || queryValue === 'on' || cookieValue === '1';
  if (!flagPresent) return false;

  // Flag is set — resolve admin status to decide whether to honor it.
  // Lazy import keeps this module tree-shakeable from the middleware
  // edge bundle in environments that don't pull Supabase.
  const { createClient } = await import('@/lib/supabase/server');
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data: profile } = await supabase
    .from('users')
    .select('account_type, is_internal, is_team_member')
    .eq('user_id', user.id)
    .maybeSingle();

  return isAdminProfile(profile);
}

/**
 * Set or clear the demo-mode cookie on a response. Use from server
 * actions, route handlers, and middleware redirect responses.
 *
 *   - `on=true`  → sets `setnayan_demo_mode=1`, 24h max-age,
 *                  httpOnly + secure (in prod) + sameSite=lax + path=/
 *   - `on=false` → clears the cookie via `maxAge=0`
 *
 * Caller is responsible for verifying admin status BEFORE calling
 * this helper. The helper itself does not enforce auth — that's
 * intentional so callers can build their own audit log entries
 * around the toggle.
 */
export function setDemoModeCookie(response: NextResponse, on: boolean): void {
  if (on) {
    response.cookies.set({
      name: DEMO_MODE_COOKIE_NAME,
      value: '1',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: DEMO_MODE_COOKIE_MAX_AGE_S,
    });
  } else {
    response.cookies.set({
      name: DEMO_MODE_COOKIE_NAME,
      value: '',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });
  }
}

/**
 * Detect the URL flag in middleware. Returns:
 *   - 'enable'  → caller should set cookie ON and strip the param
 *   - 'disable' → caller should set cookie OFF and strip the param
 *   - null      → no URL flag present
 *
 * Pure parsing; no side effects. The middleware combines this with
 * the admin profile lookup before honoring the result.
 */
export function detectDemoModeUrlFlag(
  request: DemoModeRequest,
): 'enable' | 'disable' | null {
  const value = readQueryParam(request, DEMO_MODE_QUERY_PARAM);
  if (value === '1' || value === 'on') return 'enable';
  if (value === '0' || value === 'off') return 'disable';
  return null;
}

/**
 * Strip the demo flag from a URL while preserving the rest of the
 * query string and the path. Used after the middleware honors a
 * `?demo=1` flip — the cookie is now authoritative, so leaving the
 * param in the URL would be noisy.
 */
export function stripDemoModeQueryParam(url: URL): URL {
  const next = new URL(url.toString());
  next.searchParams.delete(DEMO_MODE_QUERY_PARAM);
  return next;
}
