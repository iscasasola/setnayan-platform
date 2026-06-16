/**
 * Customer menu — the SINGLE canonical hierarchy for the couple's nav.
 *
 * Owner direction 2026-06-17: *"sub nav are child menus of the 6 menus … we are
 * redesigning how the customer menu is."* There are SIX top menus (Home · Guests
 * · Explore · Studio · Design · Budget); each owns its CHILD MENUS, which surface
 * as the docked section sub-nav (mobile) and — in later phases — the desktop
 * sidebar groups. This module is that one tree, so the bottom nav, the docked
 * sub-nav, and the sidebar can never describe three different structures.
 *
 * Neutral module (no `'use client'`) — a Server Component (sidebar/bottom-nav,
 * later PRs) and the Client docked sub-nav can both import it; lucide icon refs
 * render in both contexts (the boundary issue was only ever the `'use client'`
 * wrapper, not the icons). Same pattern as `lib/guest-journey.ts`.
 *
 * Rollout (plan `adaptive-forging-lobster.md`): PR1 (this) builds the tree + the
 * generalized docked sub-nav for the two menus that already have children
 * (Guests, Explore). PR2/PR3 add children to Design/Budget then Home/Studio; PR4
 * points the desktop sidebar at this tree; PR5 folds phase-awareness in; PR6
 * links parent→child in the nav registry. So in PR1 only Guests + Explore carry
 * `children`; the other four are parents-without-children (the dock shows nothing
 * for them, exactly as today).
 *
 * TWO CHILD FLAVORS (the dock dispatches each differently):
 *   - `route`: a separate page. onSelect → router.push; active ← longest-prefix
 *     of the pathname over the child `match`. (Guests journey.)
 *   - `tab`:   an in-page panel on the parent's single route. onSelect →
 *     replaceState(?tab=) + the `BB_TAB_EVENT` bus; active ← `?tab=`. (Explore
 *     "Build" takeover.)
 *
 * MATCH vs SECTION-MATCH. `activeMatch` is the BROAD set that lights the bottom-nav
 * TAB (e.g. Guests also covers /event-qr + /hosts) — used by the bottom nav (PR4).
 * `sectionMatch` is the NARROWER set where the docked sub-nav SHOWS (the journey
 * proper: /guests* + /seating*; the takeover ROOT only: exactly /vendors). They
 * differ on purpose, so the dock keeps today's exact visibility.
 */

import {
  Home, Users, Compass, Sparkles, Palette, Wallet,
  // Studio children:
  Gem, Globe, Camera,
  // Budget children:
  Gauge, PieChart, Receipt,
  type LucideIcon,
} from 'lucide-react';
import { buildGuestJourney } from './guest-journey';
import { BUDGET_BUILD_TABS, TAB_META } from './budget-build';

export type CustomerMenuKey = 'home' | 'guests' | 'explore' | 'studio' | 'design' | 'budget';

export type MenuChildKind = 'route' | 'tab' | 'anchor';

export type CustomerMenuChild = {
  key: string;
  label: string;
  icon: LucideIcon;
  kind: MenuChildKind;
  /** kind='route' — destination + its active-state prefix (longest wins). */
  href?: string;
  match?: string;
  /** kind='tab' — the `?tab=` value driven over the BB_TAB_EVENT bus. */
  tab?: string;
  /** kind='anchor' — the id of an on-page section the dock scrolls to (and a
   *  scroll-spy lights as it enters view). For single-page menus whose children
   *  are scroll sections, not separate routes (e.g. Budget). */
  hash?: string;
  /** Rendered dimmed-but-tappable ("not yet", e.g. Day-of before its window). */
  muted?: boolean;
  /** Nav-registry slot key. When set, the docked sub-nav overlays the admin
   *  override (label · icon · hidden) from `/admin/menus` on top of these code
   *  defaults — so every sub-nav child is editable from the registry SSOT. */
  slotKey?: string;
};

export type CustomerMenu = {
  key: CustomerMenuKey;
  /** Fallback label/icon for surfaces that don't overlay the nav registry.
   *  The bottom nav + sidebar resolve label/icon from the registry (navSlots);
   *  these are the code defaults that mirror `customer-bottom-nav.tsx`. */
  label: string;
  icon: LucideIcon;
  href: string;
  /** BROAD active match — lights the bottom-nav TAB (consumed in PR4). Mirrors
   *  the specs in `customer-bottom-nav.tsx` verbatim. */
  activeMatch: string | string[];
  activeMatchExact?: boolean;
  /** NARROW match — where the docked sub-nav SHOWS. Omitted when the menu has no
   *  children (the dock then never shows for it). */
  sectionMatch?: string | string[];
  /** Exact-equal section match (no startsWith) — the takeover root only. */
  sectionMatchExact?: boolean;
  /** aria-label for the docked <SubNav>. */
  subnavLabel?: string;
  children?: CustomerMenuChild[];
};

export type CustomerMenuCtx = {
  /** Un-mutes the Guests "Day-of" stage once the live window is open. */
  dayOfOpen?: boolean;
};

/**
 * The canonical customer-menu tree for an event — now **5 top menus** (owner
 * 2026-06-17 folded Design INTO Studio): Home · Guests · Explore · Studio ·
 * Budget. Children: Guests (routed, from `guest-journey.ts`) · Explore (tabs,
 * from `budget-build.ts`) · Studio (anchor sections — Setnayan AI · Website ·
 * Capture · Branding, scrolling the regrouped /add-ons hub) · Budget (anchor
 * scroll-sections). Home is the only childless menu. (The `design` key remains
 * in CustomerMenuKey but no longer renders a menu — /design redirects to Studio.)
 */
export function buildCustomerMenuTree(
  eventId: string,
  ctx: CustomerMenuCtx = {},
): CustomerMenu[] {
  const base = `/dashboard/${eventId}`;
  const guestStages = buildGuestJourney(eventId, { dayOfOpen: ctx.dayOfOpen });

  return [
    {
      key: 'home',
      label: 'Home',
      icon: Home,
      href: base,
      activeMatch: base,
      activeMatchExact: true,
    },
    {
      key: 'guests',
      label: 'Guests',
      icon: Users,
      href: `${base}/guests`,
      activeMatch: [`${base}/guests`, `${base}/seating`, `${base}/event-qr`, `${base}/hosts`],
      // The dock shows across the journey proper only (matches isGuestJourneyPath):
      sectionMatch: [`${base}/guests`, `${base}/seating`],
      subnavLabel: 'Guest journey',
      children: guestStages.map((s) => ({
        key: s.key,
        label: s.label,
        icon: s.icon,
        kind: 'route' as const,
        href: s.href,
        match: s.match,
        muted: s.muted,
        slotKey: `customer.guest-journey.${s.key}`,
      })),
    },
    {
      key: 'explore',
      label: 'Explore',
      icon: Compass,
      href: `${base}/vendors`,
      activeMatch: `${base}/vendors`,
      // The takeover sub-nav shows on the ROOT only (matches the old isTakeoverRoot
      // exact check) — /vendors/categories, /packages, vendor detail are their own
      // pages and must NOT dock the takeover tabs.
      sectionMatch: `${base}/vendors`,
      sectionMatchExact: true,
      subnavLabel: 'Services sections',
      children: BUDGET_BUILD_TABS.map((t) => ({
        key: t,
        label: TAB_META[t].label,
        icon: TAB_META[t].icon,
        kind: 'tab' as const,
        tab: t,
        // Legacy area name `budget-subnav` = the Explore takeover tabs (the
        // feature shipped as "Budget Build"); the slots already exist.
        slotKey: `customer.budget-subnav.${t}`,
      })),
    },
    {
      key: 'studio',
      label: 'Studio',
      icon: Sparkles,
      href: `${base}/add-ons`,
      // Studio ABSORBED Design (owner 2026-06-17 customer-menu redesign → 5 menus,
      // no standalone Design tab; /design redirects here). activeMatch covers the
      // former Design routes too so the Studio tab lights across them.
      activeMatch: [`${base}/add-ons`, `${base}/design`, `/site-editor/${eventId}`, `${base}/monogram`],
      // The 4 Studio sections are the docked sub-nav — anchor children scrolling to
      // the regrouped /add-ons hub (lib/add-ons-catalog.ts studioGroup + the
      // SECTIONS ids). Exact /add-ons only: the anchors live on the hub; add-on
      // detail pages (/add-ons/papic …) are their own surfaces.
      sectionMatch: `${base}/add-ons`,
      sectionMatchExact: true,
      subnavLabel: 'Studio sections',
      children: [
        { key: 'setnayan-ai', label: 'Setnayan AI', icon: Gem, kind: 'anchor' as const, hash: 'studio-ai', slotKey: 'customer.studio-subnav.setnayan-ai' },
        { key: 'website', label: 'Website', icon: Globe, kind: 'anchor' as const, hash: 'studio-website', slotKey: 'customer.studio-subnav.website' },
        { key: 'capture', label: 'Capture', icon: Camera, kind: 'anchor' as const, hash: 'studio-capture', slotKey: 'customer.studio-subnav.capture' },
        { key: 'branding', label: 'Branding', icon: Palette, kind: 'anchor' as const, hash: 'studio-branding', slotKey: 'customer.studio-subnav.branding' },
      ],
    },
    {
      key: 'budget',
      label: 'Budget',
      icon: Wallet,
      href: `${base}/budget`,
      activeMatch: [`${base}/budget`, `${base}/disputes`],
      // Single scrolling page — children are on-page sections the dock scrolls to
      // (scroll-spy lights the one in view). Exact /budget only (the takeover-style
      // exact match): /disputes is its own post-event surface, not a budget section,
      // so it's intentionally NOT a child here.
      sectionMatch: `${base}/budget`,
      sectionMatchExact: true,
      subnavLabel: 'Budget',
      children: [
        { key: 'overview', label: 'Overview', icon: Gauge, kind: 'anchor' as const, hash: 'budget-overview', slotKey: 'customer.budget-anchors.overview' },
        { key: 'allocate', label: 'Allocate', icon: PieChart, kind: 'anchor' as const, hash: 'budget-allocate', slotKey: 'customer.budget-anchors.allocate' },
        { key: 'payments', label: 'Payments', icon: Receipt, kind: 'anchor' as const, hash: 'budget-payments', slotKey: 'customer.budget-anchors.payments' },
      ],
    },
  ];
}

/** True when the pathname sits inside a menu's docked-sub-nav SECTION (narrow
 *  match). Exact-equal when `sectionMatchExact`, else prefix (== or startsWith
 *  `${m}/`). Menus with no `sectionMatch` (no children) never match. */
export function matchesMenuSection(pathname: string, menu: CustomerMenu): boolean {
  if (!menu.sectionMatch) return false;
  const ms = Array.isArray(menu.sectionMatch) ? menu.sectionMatch : [menu.sectionMatch];
  return ms.some((m) =>
    menu.sectionMatchExact ? pathname === m : pathname === m || pathname.startsWith(`${m}/`),
  );
}

/** The route-child whose `match` prefix best (longest) covers the pathname, or
 *  null. Mirrors `activeJourneyKey` but generalized over any route children. */
export function activeRouteChildKey(
  pathname: string,
  children: CustomerMenuChild[],
): string | null {
  let best: CustomerMenuChild | null = null;
  for (const c of children) {
    if (c.kind !== 'route' || !c.match) continue;
    if (pathname === c.match || pathname.startsWith(`${c.match}/`)) {
      if (!best || (c.match.length > (best.match?.length ?? 0))) best = c;
    }
  }
  return best?.key ?? null;
}
