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
// were renamed to `/studio` 2026-05-14. Keep the old paths working as a
// permanent redirect so bookmarks, deep links from older emails, and any
// indexed URLs survive.
const LEGACY_SERVICES_RE =
  /^\/dashboard\/([^/]+)\/services(\/.*)?$/;

// `/dashboard/<eventId>/add-ons[/<rest>]` was renamed to `/studio` 2026-06-19
// so the URL matches the "Studio" branding. Permanent redirect so QR codes,
// bookmarks, older emails, and any indexed deep links survive the rename.
const LEGACY_ADDONS_RE =
  /^\/dashboard\/([^/]+)\/add-ons(\/.*)?$/;


// Wildcard vendor subdomain support · owner directive 2026-05-28.
// `{vendor-slug}.setnayan.com` → internal rewrite to `/v/{slug}` so the
// existing vendor profile page renders. Skips reserved subdomains (www,
// api, admin, status, docs, etc) that may host distinct services. Skips
// in-dev hostnames (localhost · vercel.app preview URLs) so the rewrite
// only fires on the production domain where wildcard DNS routes traffic.
//
// Operational prerequisites (owner-side):
//   1. DNS · *.setnayan.com CNAME → cname.vercel-dns.com (or A-record IP
//      for cname-flat setups). Once configured, Vercel auto-issues TLS
//      via Let's Encrypt for each requested subdomain.
//   2. Vercel · add `*.setnayan.com` as a domain on the production project
//      (Settings → Domains → Add → wildcard).
// Without those, real subdomain requests never reach the app and this
// rewrite is dead code (harmless · matcher just never fires).
const VENDOR_SUBDOMAIN_RE = /^([a-z0-9][a-z0-9-]{0,61}[a-z0-9])\.setnayan\.com$/i;
const RESERVED_SUBDOMAINS = new Set([
  'www',     // canonical app domain · the main marketing + customer surface
  'api',     // reserved for future public API gateway (V2.1 per blueprint)
  'admin',   // reserved
  'status',  // reserved · status page if/when shipped
  'docs',    // reserved · public API docs
  'cdn',     // reserved · static asset CDN
  'mail',    // reserved
  'ftp',     // reserved
  'app',     // reserved
  'demo',    // reserved
  'staging', // reserved
  'preview', // reserved
]);

// Native-app login-first entry (0052 design addition · owner-locked
// 2026-06-10). The Capacitor shell omits the marketing brochure: someone
// who installed the app has already converted. App-originated requests to
// any bucket-① marketing route bounce to /login (or /dashboard when a
// session exists) so the app boots straight into the product. Bucket-③
// shareable surfaces (guest invites, day-of, /vendors browse, /v/[slug],
// /realstories showcase, /help) stay reachable in-app; legal pages (/privacy,
// /terms) stay reachable because store review requires them.
const APP_EXCLUDED_MARKETING_PATHS = new Set([
  '/',
  '/features',
  '/for-vendors',
  '/pricing',
  '/how-it-works',
  '/waitlist',
  '/download',
]);

// Two detection signals, either suffices:
//   1. `setnayan-client-type=capacitor` cookie — set by ClientTypeDetector
//      after the first render inside the shell's WebView.
//   2. `SetnayanApp` user-agent marker — appended by the shell via
//      `appendUserAgent` in apps/mobile/capacitor.config.ts. Covers the very
//      first request of a fresh install, before the cookie exists.
function isCapacitorClient(request: NextRequest): boolean {
  return (
    request.cookies.get('setnayan-client-type')?.value === 'capacitor' ||
    (request.headers.get('user-agent') ?? '').includes('SetnayanApp')
  );
}

function detectVendorSubdomain(hostname: string): string | null {
  const m = hostname.match(VENDOR_SUBDOMAIN_RE);
  if (!m) return null;
  const slug = m[1]!.toLowerCase();
  if (RESERVED_SUBDOMAINS.has(slug)) return null;
  return slug;
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hostname = (request.headers.get('host') ?? '').toLowerCase();

  // Vendor subdomain rewrite · `slug.setnayan.com/<rest>` → `/v/{slug}/<rest>`.
  // Fires BEFORE any other middleware logic because the rewrite changes
  // pathname downstream consumers see.
  const vendorSlug = detectVendorSubdomain(hostname);
  if (vendorSlug) {
    const rewrite = request.nextUrl.clone();
    rewrite.pathname = pathname === '/'
      ? `/v/${vendorSlug}`
      : `/v/${vendorSlug}${pathname}`;
    return NextResponse.rewrite(rewrite);
  }

  // /vendors → /explore rename (permanent · owner directive 2026-06-14). The
  // public marketplace moved from /vendors to /explore; redirect the old paths
  // (with subpaths + query strings) so bookmarks, shared links, and search
  // equity carry over. 308 = permanent + method-preserving, matching the
  // legacy /services → /add-ons precedent below. Runs AFTER the vendor-
  // subdomain rewrite so slug.setnayan.com still resolves to /v/{slug}; the
  // /v/[slug] vendor PROFILE route is a different prefix and is untouched.
  if (pathname === '/vendors' || pathname.startsWith('/vendors/')) {
    // /vendors/compare is still an un-wired orphan (its `ids` param was never
    // honored — Task #12), so it lands on /explore with the explanatory notice
    // banner instead of a bare /explore/compare. Query intentionally dropped.
    if (pathname === '/vendors/compare') {
      return NextResponse.redirect(
        new URL('/explore?notice=compare_v1_2', request.url),
        308,
      );
    }
    const rest = pathname.slice('/vendors'.length); // '' | '/categories' | …
    return NextResponse.redirect(
      new URL(`/explore${rest}${search}`, request.url),
      308,
    );
  }

  // Legacy /services → /add-ons. 308 (permanent + method-preserving) since
  // the rename is intentional and not coming back.
  const legacyMatch = pathname.match(LEGACY_SERVICES_RE);
  if (legacyMatch) {
    const eventId = legacyMatch[1];
    const rest = legacyMatch[2] ?? '';
    return NextResponse.redirect(
      new URL(`/dashboard/${eventId}/studio${rest}${search}`, request.url),
      308,
    );
  }

  // Legacy /add-ons → /studio (the 2026-06-19 Studio-URL rename). 308 permanent
  // + method-preserving; carries subpaths + query so old detail/QR links land.
  const addonsMatch = pathname.match(LEGACY_ADDONS_RE);
  if (addonsMatch) {
    const eventId = addonsMatch[1];
    const rest = addonsMatch[2] ?? '';
    return NextResponse.redirect(
      new URL(`/dashboard/${eventId}/studio${rest}${search}`, request.url),
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

  // Native shell skips the brochure: marketing routes redirect to the
  // product. 307 — the routes themselves stay live on the web, and the
  // redirect target depends on session state, so nothing should cache it
  // as permanent.
  if (isCapacitorClient(request) && APP_EXCLUDED_MARKETING_PATHS.has(pathname)) {
    return NextResponse.redirect(
      new URL(user ? '/dashboard' : '/login', request.url),
      307,
    );
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
  // Skip middleware on static assets, PWA assets, the health probe, and the
  // .well-known deep-link association files (assetlinks.json /
  // apple-app-site-association — must serve as plain 200 application/json with
  // no auth redirect or subdomain rewrite, or App Links / Universal Links
  // verification fails).
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|icon-.*\\.svg|health|\\.well-known|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
