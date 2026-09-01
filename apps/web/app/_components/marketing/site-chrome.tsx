'use client';

/**
 * SiteChrome — the ONE persistent marketing top nav for the whole public site.
 *
 * WHY (owner 2026-06-15): *"why is it when we press a menu on the top nav of
 * the website, the top nav also resets? we already said the top nav stays and
 * the body should only change."* A nav rendered in a LAYOUT is preserved
 * across navigations; only the page body re-renders. This component is mounted
 * once in the root layout (inside <Providers>, as a sibling of {children}), so
 * a single Nav instance survives every navigation and only the body swaps.
 *
 * RESKINNED 2026-07-03 (owner: "pull the old-site pages onto the new
 * website"): the chrome now renders the ELN-reskin floating glass nav
 * (site-nav.tsx) + the SAME four overlays the homepage ships (Prices /
 * Download / Vendors / Sign in via HomeOverlays), so every marketing page
 * wears the new website's chrome instead of the old link-row nav. The Prices
 * overlay is catalog-driven; since this chrome is client-side and mounted for
 * ALL routes, pricing is fetched lazily from /api/home-pricing only once a
 * marketing route is actually active (never on dashboards).
 *
 * GATING: the public site is flat under `app/` (no route group), so the root
 * layout — the only shared ancestor — wraps EVERY surface, including the authed
 * dashboards / admin / vendor consoles / guest landing pages that own their own
 * chrome. So we render the marketing chrome only on the explicit set of public
 * marketing routes. `isMarketingRoute` is shared with SiteFooterChrome (the
 * persistent reskin footer mounted after {children}) so nav + footer always
 * agree on where the marketing shell applies.
 *
 * Canonical post-redirect paths: `/vendors`→`/explore` (middleware) and
 * `/weddings`→`/realstories` (next.config) — so the marketplace + showcase are
 * keyed by their real landed pathnames.
 */

import { useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Nav } from './site-nav';
import type { NavSlotLite } from '@/lib/nav-registry-types';
import type { OverlayId } from '@/app/_components/home/HomeOverlays';
import type { PricingData } from '@/app/_components/home/pricing-data';
import { subscribeDemoOverlay } from '@/lib/demo-overlay-bus';
import '@/app/_components/home/home-reskin.css';

// The overlays chunk (pricing tables, vendor tier catalog, auth forms) stays
// out of every marketing page's first-load JS — same ssr:false split the
// homepage uses.
const HomeOverlays = dynamic(
  () => import('@/app/_components/home/HomeOverlays').then((m) => m.HomeOverlays),
  { ssr: false },
);

/*
  🔑 THE SEVEN PRODUCT DOORWAYS LEFT THIS SET ON 2026-08-15, and that is what
  stops them wearing two chromes at once. They now mount the shared shell from
  `_doorway.tsx` — the same rail, bar and search as `/` — so the glass nav here
  would sit ON TOP of it: `fixed; top:22px; z:60` over a `sticky; top:0; z:20`
  bar, two Home links, two Sign-ins, ~39px of overlap, and no guard firing.
  Owner 2026-08-15: *"still jumps out of the shell when the links on studio are
  pressed."*

  ⚠ THEY ARE NOT MOVED TO `FOOTER_ONLY_PREFIXES` EITHER. That list is
  PREFIX-matched, so `/papic` there would hand the reskin footer to
  `/papic/seat/[token]` — the paparazzo's camera, which is documented
  "LOGIN-FREE … no dashboard chrome". The doorways now match `/`: shell, no
  footer.

  🪤 `lint-no-stacked-pinned-bars.mjs` ITERATES THIS SET, so removing seven
  entries makes it go quiet on them WITHOUT SAYING SO — its non-vacuity floor is
  `size < 10` against ~31 remaining. It was already blind here (it skips
  underscore segments, so `_doorway.tsx` is unreachable to it, and the pin is a
  CSS rule rather than a Tailwind string). `doorway-shell.test.ts` is the
  replacement that actually watches this.
*/
const NAV_ROUTES = new Set<string>([
  // NOTE: '/' is intentionally OMITTED. The homepage (ELN reskin · 2026-06-29)
  // renders its OWN nav instance (HomeReskin), which carries the cinematic
  // gate state (white glass on the closed gate → ink glass once opened).
  // Mounting this chrome on top of it would double the nav.
  '/vendors',
  // /creators — the public storyteller marketing page (2026-07-16); joins the
  // marketing shell alongside its /vendors sibling.
  '/creators',
  '/our-story',
  '/blog',
  /* 2026-09-01 — /features ABSORBED /how-it-works, /why-setnayan and
     /tl/how-it-works. Those three left this set with their routes: a chrome
     entry for a path that no longer renders is dead config, and this set is
     watched by `doorway-shell.test.ts`. /features and /tl/features stay. */
  '/features',
  '/monogram',
  // "Pa-" feature landing pages (owner-approved 2026-06-27; Pa- naming LOCKED).
  '/tl/about',
  // /tl/features shares FeaturesPageBody with /features (whose old in-body
  // SiteFooter was removed), so it must join the shell to keep a footer + gain
  // the glass nav its EN twin already has.
  '/tl/features',
  // Added 2026-07-03 with the reskin chrome: the legal + support + download +
  // waitlist pages the homepage footer links to previously wore the legacy
  // SiteHeader, a page-local footer, or no chrome at all — they join the one
  // marketing shell so no footer link lands back on the old website.
  // ⚠ THIS PARAGRAPH USED TO EXPLAIN WHY /privacy/google-access WAS LISTED
  // HERE. That page left this set on 2026-08-15 when it joined the shared
  // shell, and the reasoning survives in a different form: it is still never a
  // bare page — the shell gives it chrome the OAuth reviewer reads as a live
  // URL. /explore, /help and /alaala left the same way on the same day. A
  // comment describing a member that is gone is how a reader concludes the set
  // is bigger than it is.
  '/download',
  '/waitlist',
]);

// FOOTER-ONLY surfaces — the article/reading DETAIL pages (`/blog/[slug]`,
// `/help/[slug]`, and the `/tour` sample walkthrough). They get the shared
// ReskinFooter (so the OLD `_SiteFooter` is fully retired site-wide) but KEEP
// their own bespoke reading masthead / sample ribbon, so the floating glass
// nav never doubles their header. `/realstories/[slug]` is excluded entirely:
// its immersive edition design ships zero old-site chrome already.
const FOOTER_ONLY_PREFIXES = ['/blog/', '/help/', '/tour'];

// Routes whose OWN sticky header owns the viewport top: the glass nav renders
// in-flow there (scrolls away with the page) instead of fixed, so two pinned
// bars never stack — preserves the prior `sticky={false}` intent.
//
// 🔴 /features and /tl/features were MISSING here (reported by the owner from a
// phone, 2026-08-06 — the only way it was ever going to be found). Both render
// <FeaturesPageBody>, whose <AnchorNav> is `sticky top-0 z-30`, so the floating
// glass nav sat directly ON TOP of the section tabs: "Vendors & budget" and
// "Outsourcing & pacing" were unreadable behind Prices / Download / Vendors /
// Sign in, and the page's own h1 was sliced in half.
//
// ⚠ AnchorNav's own line 46 comment says "Top margin allows for the sticky
// header + this anchor nav (~120px combined)" — the author KNEW a pinned header
// sat above and still pinned to top-0. Two components each correct about
// themselves, wrong about each other. This set is the only place that knows.
//
// 🛡 A guard now enforces it: scripts/lint-no-stacked-pinned-bars.mjs fails the
// build if a NAV_ROUTE's page tree pins anything to the viewport top without
// being listed here.
/*
  ⚠ '/explore' WAS REMOVED HERE 2026-08-15, NOT OVERLOOKED. This set is read
  well after the early return for a non-NAV route, so the moment /explore left
  NAV_ROUTES its entry became unreachable — and a dead entry in a safety set
  reads as live protection. Its two pinned strips are now parked under the
  shared bar at `top: var(--fd-bar)` (the same mechanism `.fd-rail` and
  `.fd-chipbar` use), and `lint-no-stacked-pinned-bars.mjs` checks the shelled
  routes for exactly that instead.
*/
const UNFIXED_ROUTES = new Set<string>(['/features', '/tl/features']);

/** Routes that render the floating glass NAV (+ overlays + footer). */
export function isNavRoute(pathname: string | null): pathname is string {
  return !!pathname && NAV_ROUTES.has(pathname);
}

/**
 * Routes that render the shared ReskinFOOTER — the nav routes PLUS the
 * footer-only detail pages. Broader than isNavRoute so article/reading pages
 * keep their own header but still retire the old `_SiteFooter`.
 */
export function isMarketingRoute(pathname: string | null): pathname is string {
  if (!pathname) return false;
  if (NAV_ROUTES.has(pathname)) return true;
  return FOOTER_ONLY_PREFIXES.some(
    (pre) => pathname === pre || pathname.startsWith(pre.endsWith('/') ? pre : pre + '/'),
  );
}

/**
 * `navSlots` is the nav/icon/menu-registry slot map (label overrides) resolved
 * once server-side in the root layout and threaded down here. The marketing nav
 * is label-only, so the public.site-nav.* labels are the only thing overlaid;
 * href + order stay in code. Optional + fails open — without it the Nav renders
 * its code-default labels.
 */
export function SiteChrome({
  navSlots,
}: {
  navSlots?: Record<string, NavSlotLite>;
}) {
  const pathname = usePathname();
  // The glass NAV renders only on nav routes; the footer-only detail pages keep
  // their own header (SiteFooterChrome supplies just the footer there).
  const active = isNavRoute(pathname);

  const [overlay, setOverlay] = useState<OverlayId>(null);
  const closeOverlay = useCallback(() => setOverlay(null), []);

  // Any navigation closes an open overlay (e.g. the Vendors overlay's
  // "Register your business" link) — the destination page owns the screen.
  useEffect(() => {
    setOverlay(null);
  }, [pathname]);

  // Live catalog pricing for the Prices / Setnayan-AI / Vendors overlays —
  // fetched lazily once a marketing route is visited. The pricing-free overlays
  // (Download / Sign in / demos) never wait on this. `attempt` bumps to force a
  // retry: on becoming active, and whenever a pricing-dependent overlay is
  // opened while pricing is still null (so one transient fetch blip doesn't
  // leave Prices/Vendors inert for the rest of the session).
  const [pricing, setPricing] = useState<PricingData | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!active || pricing) return;
    let cancelled = false;
    fetch('/api/home-pricing')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: PricingData | null) => {
        if (!cancelled && data) setPricing(data);
      })
      .catch(() => {
        // Fails soft: the nav still works; a later open (attempt bump) retries.
      });
    return () => {
      cancelled = true;
    };
  }, [active, pricing, attempt]);

  // Opening a pricing overlay while pricing hasn't loaded (slow/failed first
  // fetch) kicks a retry so it fills in rather than staying blank.
  useEffect(() => {
    if (!pricing && (overlay === 'prices' || overlay === 'vendors' || overlay === 'setnayan-ai')) {
      setAttempt((a) => a + 1);
    }
  }, [overlay, pricing]);

  /*
    ─── THE DEMOS GET THEIR HANDLE BACK (2026-08-14) ────────────────────────
    `HomeReskin.tsx` was deleted on 2026-08-13 and it held the ONLY five
    `setOverlay(...)` call sites in the repo. `HomeOverlays` has been mounted
    here on every marketing route ever since with nothing able to open the
    Papic, Live Studio, 3D Plan or Alaala-editions overlays. This subscription
    is the handle: a product page presses a button, `openDemoOverlay` fires,
    and the overlay this component already mounts opens.

    ⚠ SUBSCRIBED ONLY WHILE `active`, AND THE GATE IS IN THE EFFECT, NOT IN
    THE EARLY RETURN BELOW. A first cut wrote `useEffect(… , [])` above the
    `if (!active) return null` and described it as gated — but hooks run
    regardless of what the render returns, so it subscribed on EVERY route in
    the app, including the dashboards. `demoOverlayAvailable()` would then be
    true where no overlay can render, and the button would come back as the
    dead control this whole file is repairing. The dependency is `active`.
  */
  useEffect(() => {
    if (!active) return;
    return subscribeDemoOverlay(setOverlay);
  }, [active]);

  if (!active) return null;

  return (
    <>
      <Nav
        navSlots={navSlots}
        onOpenOverlay={setOverlay}
        unfixed={UNFIXED_ROUTES.has(pathname)}
      />
      {/* Mounted unconditionally: Download / Sign in / demos work immediately;
          HomeOverlays internally gates the pricing-dependent overlays on a
          non-null `pricing`. */}
      <HomeOverlays current={overlay} onClose={closeOverlay} pricing={pricing} />
    </>
  );
}
