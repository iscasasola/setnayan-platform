import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { updateSession } from '@/lib/supabase/middleware';
import {
  DEMO_MODE_COOKIE_NAME,
  DEMO_MODE_COOKIE_MAX_AGE_S,
  detectDemoModeUrlFlag,
  isAdminProfile,
  stripDemoModeQueryParam,
} from '@/lib/demo-mode';

// Matches a v4-style UUID exactly. Slugs are capped at 32 chars
// (`[a-z0-9-]+`), so a UUID — 36 chars including hyphens — cannot
// collide with any user-chosen slug. Safe to treat as a dashboard
// shortcut.
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// `/dashboard/<eventId>/services` and `/dashboard/<eventId>/services/<rest>`
// were renamed to `/add-ons` 2026-05-14. Keep the old paths working as a
// permanent redirect so bookmarks, deep links from older emails, and any
// indexed URLs survive.
const LEGACY_SERVICES_RE =
  /^\/dashboard\/([^/]+)\/services(\/.*)?$/;

// /vendors/compare orphan guard (Task #12 · CLAUDE.md 2026-05-22).
// PR #231 (2026-05-20) shipped the compare surface but left its entry-points
// for V1.2 wiring, which leaves the route reachable only by hand-typed URL —
// a shipped orphan per the `feedback_setnayan_orphan_prevention` rule locked
// 2026-05-22. Until V1.2 wires a real entry point on /vendors or
// /dashboard/[eventId]/vendors, every hit is redirected to /vendors with a
// notice banner. 307 (temporary + method-preserving) — the page itself is
// preserved on disk, not deleted, so the redirect lifts cleanly when V1.2
// removes this match. Matches GET requests with or without query params.
const COMPARE_ORPHAN_PATH = '/vendors/compare';

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // /vendors/compare → /vendors?notice=compare_v1_2 (Task #12). Strip the
  // visitor-supplied query string — the compare page never wired its `ids`
  // param to anything actionable, so preserving it would only leak intent
  // the receiving page cannot honor. The banner explains the gap politely.
  if (pathname === COMPARE_ORPHAN_PATH) {
    return NextResponse.redirect(
      new URL('/vendors?notice=compare_v1_2', request.url),
      307,
    );
  }

  // Legacy /services → /add-ons. 308 (permanent + method-preserving) since
  // the rename is intentional and not coming back.
  const legacyMatch = pathname.match(LEGACY_SERVICES_RE);
  if (legacyMatch) {
    const eventId = legacyMatch[1];
    const rest = legacyMatch[2] ?? '';
    return NextResponse.redirect(
      new URL(`/dashboard/${eventId}/add-ons${rest}${search}`, request.url),
      308,
    );
  }

  // Convenience: `setnayan.com/<event-uuid>/...` redirects to
  // `setnayan.com/dashboard/<event-uuid>/...`. Lets couples bookmark
  // short URLs and skip the /dashboard/ prefix when typing by hand.
  if (!pathname.startsWith('/dashboard/')) {
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length > 0 && UUID_RE.test(segments[0]!)) {
      const redirectUrl = new URL(
        `/dashboard${pathname}${search}`,
        request.url,
      );
      return NextResponse.redirect(redirectUrl);
    }
  }

  const { response, user } = await updateSession(request);

  // Demo-mode URL flag bootstrap (PR brief 2026-05-22 · CLAUDE.md row
  // 458 follow-on). `?demo=1` from any admin page sets the cookie and
  // redirects without the param so the URL doesn't stay noisy. `?demo=0`
  // clears the cookie. Non-admin sessions silently ignore the enable
  // signal — the cookie never gets set — but anyone can clear via
  // `?demo=0` (no harm if it wasn't set).
  //
  // The admin check requires a Supabase profile lookup. To avoid paying
  // for that on every request, we only run it when the query param is
  // actually present.
  const demoFlag = detectDemoModeUrlFlag(request);
  if (demoFlag) {
    const cleanUrl = stripDemoModeQueryParam(request.nextUrl);
    const redirect = NextResponse.redirect(cleanUrl, 302);

    if (demoFlag === 'enable') {
      // Only honor the enable signal if the request carries an
      // authenticated admin session. The profile lookup runs at most
      // once per URL-flag toggle — not on every request — so the
      // amortized cost is essentially zero.
      if (!user) {
        // Anonymous visitor hit `?demo=1`. Strip the param and move
        // on; cookie stays unset.
        return redirect;
      }
      // Build a short-lived Supabase client that doesn't mutate
      // session cookies (we already updated them via updateSession
      // above). We only need a read of the `users` row.
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() {
              return request.cookies.getAll();
            },
            setAll() {
              // No-op: we don't want to overwrite the session cookies
              // the parent `updateSession` already set. Required by
              // the createServerClient API contract.
            },
          },
        },
      );
      const { data: profile } = await supabase
        .from('users')
        .select('account_type, is_internal, is_team_member')
        .eq('user_id', user.id)
        .maybeSingle();

      if (isAdminProfile(profile)) {
        redirect.cookies.set({
          name: DEMO_MODE_COOKIE_NAME,
          value: '1',
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: DEMO_MODE_COOKIE_MAX_AGE_S,
        });
      }
      // Non-admin? Silently strip the param without setting the
      // cookie. No telemetry, no error response — keeps demo-mode
      // existence non-discoverable.
      return redirect;
    }

    // demoFlag === 'disable' — anyone can clear. Belt-and-suspenders:
    // even an anonymous visitor sending `?demo=0` shouldn't see a
    // demo cookie linger from a previous admin session.
    redirect.cookies.set({
      name: DEMO_MODE_COOKIE_NAME,
      value: '',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });
    return redirect;
  }

  // Signed-in visitors landing on the marketing homepage get bounced to
  // the app shell. Doing the redirect here — instead of inside the page
  // component — lets `/` stay fully static, which drops home-page TTFB
  // from ~300 ms (SSR + auth roundtrip on every request) to edge-cache
  // speed. Other auth-sensitive routes (`/login`, `/signup`) keep their
  // existing page-level logic since those flows may have intentional
  // signed-in render paths (e.g., account switching).
  if (user && pathname === '/') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return response;
}

export const config = {
  // Skip middleware on static assets, PWA assets, and the health probe.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|icon-.*\\.svg|health|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
