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
import {
  isSetnayanHost,
  isLocalOrPreviewHost,
  resolveCustomDomainPath,
  resolveEventSubdomainPath,
} from '@/lib/custom-domain-resolve';
import { userNestingRewritePath } from '@/lib/u-nesting';
import {
  isStoreShellSignals,
  isStoreShellWebOnlyPath,
  STORE_SHELL_CLIENT_TYPE_COOKIE,
  STORE_SHELL_WEB_ONLY_PATH,
} from '@/lib/store-shell';

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
// 2026-06-10). The native shells — Capacitor (iOS/Android) and the Tauri
// desktop wrapper (macOS/Windows) — omit the marketing brochure: someone
// who installed the app has already converted. App-originated requests to
// any bucket-① marketing route bounce to /login (or /dashboard when a
// session exists) so the app boots straight into the product. Bucket-③
// shareable surfaces (guest invites, day-of, /vendors browse, /v/[slug],
// /realstories showcase, /help) stay reachable in-app; legal pages (/privacy,
// /terms) stay reachable because store review requires them.
const APP_EXCLUDED_MARKETING_PATHS = new Set([
  '/',
  '/features',
  '/vendors',
  '/creators',
  '/pricing',
  '/how-it-works',
  '/waitlist',
  '/download',
]);

// Two detection signals, either suffices:
//   1. `setnayan-client-type=capacitor` cookie — set by ClientTypeDetector
//      after the first render inside the shell's WebView.
//   2. `SetnayanApp` user-agent marker — set by the Capacitor shell via
//      `appendUserAgent` in apps/mobile/capacitor.config.ts and by the Tauri
//      desktop shell via `app.windows[].userAgent` in src-tauri/tauri.conf.json.
//      Covers the very first request of a fresh install, before the cookie
//      exists (desktop relies on this marker; it sets no client-type cookie).
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

  // Subdomain rewrite · `slug.setnayan.com/<rest>` → the couple's event page.
  // Fires BEFORE any other middleware logic because the rewrite changes the
  // pathname downstream consumers see. Subdomains are an EVENT-ONLY feature
  // (owner 2026-07-10: "no x.setnayan.com for vendors. only for events."). A label
  // resolves ONLY when a COUPLE owns an active paid EVENT_SUBDOMAIN order (₱999/yr)
  // → their event page at bare `/{slug}`. Any other label (a vendor's, an unowned
  // one) is NOT rewritten and falls through to normal routing. One edge RPC per
  // subdomain request, fail-open (miss/error → no rewrite → normal routing);
  // the primary www host pays nothing. (Vendors keep BYO custom domains — the
  // separate resolve_custom_domain path below — but no *.setnayan.com subdomain.)
  const subLabel = detectVendorSubdomain(hostname);
  if (subLabel) {
    const eventPath = await resolveEventSubdomainPath(subLabel); // '/{slug}' | null
    if (eventPath) {
      const rewrite = request.nextUrl.clone();
      rewrite.pathname = pathname === '/' ? eventPath : `${eventPath}${pathname}`;
      // Mirror the `/u/` nesting loop-break so the (flag-gated) `/u/` cutover
      // redirect in app/[slug]/page.tsx never bounces a paid vanity host into
      // `/u/{owner}/{slug}` and strands the couple's URL.
      const headers = new Headers(request.headers);
      headers.set('x-sn-u-nesting', '1');
      return NextResponse.rewrite(rewrite, { request: { headers } });
    }
    // Not a paid event subdomain → no rewrite (vendors get no *.setnayan.com host).
  }

  // Custom BYO domain · e.g. `sny.theirshop.com/<rest>` → internal rewrite to the
  // owner's `/v/{slug}` (vendor) or `/u/{slug}` (user) page. Only fires for
  // hosts that are NEITHER a setnayan.com/.ph host NOR a localhost/vercel.app
  // preview host — so the primary domain + previews + dev pay ZERO cost (two
  // cheap string checks, no DB call). For an actual custom domain (its DNS
  // points here), resolution goes through the staleness-free
  // resolve_custom_domain RPC. Fail-open: an unknown/unverified host or any
  // error returns null and falls through to normal routing. Inert until a
  // verified custom_domains row exists.
  if (hostname && !isSetnayanHost(hostname) && !isLocalOrPreviewHost(hostname)) {
    const target = await resolveCustomDomainPath(hostname); // '/v/{slug}' | '/u/{slug}' | null
    if (target) {
      const rewrite = request.nextUrl.clone();
      if (pathname === '/') {
        // Root → the owner's page (vendor shop, or user profile which itself
        // redirects into their single event / shows a picker).
        rewrite.pathname = target;
        return NextResponse.rewrite(rewrite);
      }
      if (target.startsWith('/v/')) {
        // Vendor sub-path → under the vendor route (vendors have no subroutes,
        // so this simply 404s for unknown paths — expected).
        rewrite.pathname = `${target}${pathname}`;
        return NextResponse.rewrite(rewrite);
      }
      // User sub-path → the event subtree lives at the bare root (this mirrors
      // the /u/{user}/{event} → /{event} strip, which a rewrite can't re-trigger).
      // Leave pathname as-is and fall through to normal routing so
      // e.g. sny.maria.com/aira-boy/welcome resolves at app/[slug]/welcome.
    }
  }

  // User-profile event nesting · `/u/{userSlug}/{eventSlug}[/rest]` → internal
  // rewrite to `/{eventSlug}[/rest]` so the existing event route SUBTREE (the
  // landing page + its 12 subroutes: hub, recap, welcome, venue, invite,
  // find-my-table, find-seat, seat, seat/claim, redeem, live-wall, sign-out)
  // renders under the pretty nested URL WITHOUT duplicating any of those routes.
  // This mirrors the vendor-subdomain rewrite pattern directly above.
  //
  // Bare `/u/{userSlug}` (no event segment) is NOT rewritten — it falls through
  // to the real profile page at app/u/[userSlug]/page.tsx.
  //
  // Additive: the bare-root event URLs (`/{eventSlug}[/rest]`, still on printed
  // QR codes) keep resolving in parallel. The QR/link cutover to `/u/` and the
  // bare-root→`/u/` permanent redirect land in a later PR, behind a flag.
  // ⚠ NOT every 3-segment /u/ path is a nested event. This used to rewrite on
  // segment COUNT alone, which ate the chapter route (`/u/{slug}/c/{id}`) and
  // made a storyteller's own story page 404 — it had NEVER been reachable in
  // prod. `userNestingRewritePath` owns the decision and returns null for a real
  // /u subtree; see lib/u-nesting.ts.
  if (pathname.startsWith('/u/')) {
    const nested = userNestingRewritePath(pathname);
    if (nested) {
      const rewrite = request.nextUrl.clone();
      rewrite.pathname = nested;
      // PR6 loop-break: mark that this render arrived via the nested /u/ URL so
      // the event dispatcher (app/[slug]/page.tsx) does NOT re-redirect it back
      // to /u/ under the cutover flag — that would loop /u/a/b → /b → /u/a/b.
      // This is a REQUEST header (forwarded to the render), invisible to the
      // browser; a spoofed value only opts the request out of the canonical
      // redirect (renders at bare root — the safe default), so it's harmless.
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set('x-sn-u-nesting', '1');
      return NextResponse.rewrite(rewrite, { request: { headers: requestHeaders } });
    }
  }

  // /vendors/* → /explore rename (permanent · owner directive 2026-06-14). The
  // public marketplace moved from /vendors/* to /explore; redirect the old
  // marketplace SUBPATHS (with query strings) so bookmarks, shared links, and
  // search equity carry over. 308 = permanent + method-preserving, matching the
  // legacy /services → /add-ons precedent below. Runs AFTER the vendor-
  // subdomain rewrite so slug.setnayan.com still resolves to /v/{slug}; the
  // /v/[slug] vendor PROFILE route is a different prefix and is untouched.
  //
  // ⚠ EXACT `/vendors` is DELIBERATELY EXCLUDED (2026-07-05): the vendor
  // BENEFITS page moved from /for-vendors → /vendors, so bare `/vendors` must
  // render that page — only the legacy marketplace subpaths still redirect to
  // /explore. `/for-vendors` → `/vendors` is a permanent redirect in
  // next.config.ts redirects().
  if (pathname.startsWith('/vendors/')) {
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

  // 🔒 STORE SHELL SHOWS NO PAID DIGITAL FEATURE. App Review 2026-06-30
  // rejected build 1.0 (1) under Guideline 3.1.1 / 3.1.3(b) even though the
  // in-app checkout was already hidden on native: a feature bought on the web
  // still WORKED in the app, and Apple requires such content to be purchasable
  // by IAP too. Until IAP ships (v1.1), the Capacitor shell — and ONLY the
  // Capacitor shell; the desktop .dmg is not store-distributed and is excluded
  // by the predicate — is sent to a plain "not in the app" page whenever it
  // reaches a paid feature's home or a purchase route. The Studio hub filters
  // its own grid; this catches deep links, notifications and dashboard tiles.
  // 307, same reasoning as the marketing bounce above. Held by
  // lib/store-shell.test.ts.
  if (
    isStoreShellWebOnlyPath(pathname) &&
    isStoreShellSignals(
      request.headers.get('user-agent'),
      request.cookies.get(STORE_SHELL_CLIENT_TYPE_COOKIE)?.value,
    )
  ) {
    return NextResponse.redirect(new URL(STORE_SHELL_WEB_ONLY_PATH, request.url), 307);
  }

  /*
    A SIGNED-IN VISITOR MAY SEE THE FRONT DOOR. The bounce that stood here —
    `if (user && pathname === '/') redirect('/dashboard')` — is removed.

    Owner 2026-08-13, after the login fix still did not do it: "still directed
    here". It could not have. #4424 fixed where a SIGN-IN sends you, and this
    line sent you away again on the very next request — and on every later
    visit to `/` for as long as you stayed signed in. A member could never see
    the front door at all.

    ⚠ IT ALSO MADE FINISHED WORK UNREACHABLE. front-door-shell.tsx carries four
    `account.signedIn` branches — My Home with Events + Alaala, the Marketplace
    group, the account cluster. None of them could ever render.

    🔑 AND ITS OWN JUSTIFICATION HAD ALREADY EXPIRED. It existed to keep `/`
    "fully static … edge-cache speed" while `/` was the marketing homepage that
    "does not read the session at all". The front door reads the session by
    construction — app/page.tsx says so itself: `cookies()` is reached inside
    <FrontDoor>, "with the flag on, this route renders per-request". The flag is
    on and the front door is live, so the redirect was protecting a static
    render that no longer exists. It cost the seam and bought nothing.

    ⏭ The performance follow-up app/page.tsx already names stands, and is now
    the real lever: if per-request rendering proves expensive under traffic,
    cache the feed reads behind `unstable_cache` so only the session lookup is
    per-request. That is a caching decision, not a reason to eject members from
    the page.

    Other auth-sensitive routes (`/login`, `/signup`) keep their page-level
    logic — those flows have intentional signed-in render paths.
  */

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
