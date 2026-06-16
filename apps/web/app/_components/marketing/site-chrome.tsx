'use client';

/**
 * SiteChrome — the ONE persistent marketing top nav for the whole public site.
 *
 * WHY (owner 2026-06-15): *"why is it when we press a menu on the top nav of
 * the website, the top nav also resets? we already said the top nav stays and
 * the body should only change. we do not need one top nav for each. we want
 * one top nav to navigate the whole website."*
 *
 * THE BUG IT FIXES: every marketing page used to render its OWN `<Nav>` inside
 * its `page.tsx`. In the Next.js App Router a `page` is unmounted and rebuilt
 * on every navigation, so clicking a nav item tore down the old nav and mounted
 * a fresh one — the "reset"/flash. A nav rendered in a LAYOUT is preserved
 * across navigations; only the page body re-renders. This component is mounted
 * once in the root layout (inside <Providers>, as a sibling of {children}), so
 * a single Nav instance survives every navigation and only the body swaps.
 * Its scroll position / hide-on-scroll state no longer resets between pages.
 *
 * GATING: the public site is flat under `app/` (no route group), so the root
 * layout — the only shared ancestor — wraps EVERY surface, including the authed
 * dashboards / admin / vendor consoles / guest landing pages that own their own
 * chrome. So we render the marketing Nav only on the explicit set of marketing
 * routes that showed it before the hoist (exact-match = behavior-preserving:
 * no page silently gains or loses the nav). Add a route here to extend it.
 *
 * Canonical post-redirect paths: `/vendors`→`/explore` (middleware) and
 * `/weddings`→`/realstories` (next.config) — so the marketplace + showcase are
 * keyed by their real landed pathnames.
 */

import { usePathname } from 'next/navigation';
import { Nav } from './site-nav';
import type { NavSlotLite } from '@/lib/nav-registry-types';

const NAV_ROUTES = new Set<string>([
  '/',
  '/about',
  '/how-it-works',
  '/pricing',
  '/for-vendors',
  '/our-story',
  '/blog',
  '/realstories',
  '/features',
  '/explore',
  '/tl/about',
  '/tl/how-it-works',
]);

// Routes whose OWN sticky header owns the viewport top (e.g. the /explore
// marketplace search bar), so the nav scrolls away naturally instead of
// pinning — preserves the prior per-page `<Nav sticky={false} />`.
const NON_STICKY_ROUTES = new Set<string>(['/explore']);

export function SiteChrome({ navSlots }: { navSlots?: Record<string, NavSlotLite> }) {
  const pathname = usePathname();
  if (!pathname || !NAV_ROUTES.has(pathname)) return null;
  return <Nav sticky={!NON_STICKY_ROUTES.has(pathname)} navSlots={navSlots} />;
}
