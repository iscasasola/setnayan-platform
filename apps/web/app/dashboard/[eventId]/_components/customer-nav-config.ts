/**
 * Customer NavGroup[] builder — TWO LABELLED SECTIONS (design:
 * setnayan-overview-energy.html · 2026-07-10).
 *
 * The desktop sidebar is organised into two labelled sections matching the
 * couple energy prototype:
 *   PLAN    → Overview · Guests · Merkado · Studio
 *   GO LIVE → Launch (the couple's live personal website)
 * Each top-level item auto-expands on the desktop sidebar to reveal its
 * sub-pages. The mobile bottom nav (lib/customer-menu.ts) carries the same
 * top-level destinations + labels (Overview · Guests · Merkado · Studio) — the
 * two are now at parity (no desktop-only Budget menu).
 *
 * PLAN items (same destinations as before — only regrouped + relabelled):
 *   1. Overview → /dashboard/[id]         (plain leaf — its old checklist/
 *      schedule/messages/contracts children were flattened #3004; those surfaces
 *      live in the dashboard body + topbar). Renamed from "Home"; route +
 *      exact-match sentinel unchanged.
 *   2. Guests   → /dashboard/[id]/guests  (plain leaf — the guest-journey stages
 *      are integrated into the single Guests page) · guest-count badge.
 *   3. Merkado  → /dashboard/[id]/vendors (marketplace + Build tabs)
 *      — renamed from "Explore"; key + route unchanged.
 *   4. Studio   → /dashboard/[id]/studio  (website · mood-board · monogram · live wall)
 * GO LIVE items:
 *   5. Launch   → /[slug] (or /website/launch pre-slug) — gated on websiteEnabled.
 *
 * BUDGET removed 2026-07-10 (owner) — the standalone top-level Budget menu (and
 * its Activity + Disputes children) is GONE, matching the mobile SSOT
 * (lib/customer-menu.ts), which dropped it when the budget moved into the
 * Merkado (Vendors → Build · Budget · Compare). Reachability after removal:
 *   • /budget    → Merkado's Budget tab ("Open budget & payments" lens link).
 *   • /disputes  → the vendor booking cancel flow (cancel-booking-button → the
 *                  0023 § 3.6 dispute filing page at /disputes).
 *   • /activity  → the "See all recent activity →" link at the foot of the
 *                  dashboard body's "Around your event" section
 *                  (event-dashboard.tsx); the customer.sidebar.activity/disputes
 *                  registry slots are kept so a re-surfaced link stays
 *                  admin-editable.
 *
 * A non-empty `group.label` makes SidebarSection render a collapsible heading.
 * The 'plan'/'golive' group keys are stable (localStorage section-state).
 *
 * GUEST JOURNEY — the Guests item is a plain leaf (the five guest-journey stages
 * from lib/guest-journey — Build · Invite · Confirm · Seat · Day-of — now live
 * inside the single Guests page, not as sidebar children). `opts.dayOfOpen` is
 * retained as the day-of gating hook; defaults to false.
 *
 * HOME sentinel matchPrefix — `__home__` prevents the strict-prefix branch
 * from firing (every other /dashboard/[id]/... route shares the base prefix),
 * so only the exact pathname === href branch keeps Home lit.
 *
 * BOTTOM NAV: customer-bottom-nav.tsx reads from buildCustomerMenuTree
 * (lib/customer-menu.ts) — the SSOT for both the bottom nav and the docked
 * sub-nav. This sidebar builder and the bottom nav share the same five
 * destinations; active-match logic lives in customer-menu.ts.
 *
 * Server-Component safety (unchanged): neutral (non-'use client') module —
 * both the client sidebar and any Server Component can import + call this.
 */

import {
  Home,
  Users,
  Compass,
  Sparkles,
  Globe,
  Palette,
  Type,
  MonitorPlay,
  Eye,
  Rocket,
} from 'lucide-react';
import { BUDGET_BUILD_TABS, TAB_META } from '@/lib/budget-build';
import type { LucideIcon } from 'lucide-react';
import type { NavGroup, NavItem } from '@/app/_components/nav/types';
import { SetnayanMark } from '@/app/_components/setnayan-mark-icon';

/**
 * Builds the canonical customer NavGroup[] for the given eventId — one
 * header-less group ('root', label: '') containing the 5 destinations that
 * match the mobile bottom-nav tabs. Each top-level item auto-expands on the
 * desktop sidebar to reveal its sub-pages.
 */
export function buildCustomerNavGroups(
  eventId: string,
  opts?: {
    dayOfOpen?: boolean;
    hideKeys?: string[];
    websiteEnabled?: boolean;
    monogramEnabled?: boolean;
    /** The event's public slug. When present, the top-level "Launch" entry
     *  points AT the couple's live personal website (`/[slug]`); when absent
     *  (no slug yet) it falls back to the go-live/setup surface. */
    slug?: string | null;
    /** Live guest count → the Guests item's badge (neutral tone). Resolved
     *  server-side in layout.tsx; omit/0 → no badge (never fabricated). */
    guestCount?: number | null;
  },
): NavGroup[] {
  const base = `/dashboard/${eventId}`;

  // Launch = the couple's live personal website. It lives in its OWN "Go live"
  // section (design: setnayan-overview-energy.html), not among the Plan items.
  // OPENS THE COUPLE'S LIVE PERSONAL WEBSITE (`/[slug]`) directly (owner
  // 2026-07-02 "launch on customer event is their personal website"). A
  // signed-in host always sees their own page even while it's private
  // (app/[slug]/page.tsx host-gate), so this is safe pre-publish; before a slug
  // exists we fall back to the go-live/setup surface (`/website/launch`) so they
  // can publish. Gated on the 'website' surface (websiteEnabled).
  const launchItem: NavItem | null = opts?.websiteEnabled
    ? {
        key: 'launch',
        label: 'Launch',
        href: opts?.slug ? `/${opts.slug}` : `${base}/website/launch`,
        icon: Rocket,
        matchPrefix: opts?.slug ? `/${opts.slug}` : `${base}/website/launch`,
      }
    : null;

  // PLAN section items — Overview · Guests · Merkado · Studio · Budget. (Was the
  // single header-less 'root' group; split into labelled sections below.)
  const planItems: NavItem[] = [
        {
          // 1 · Home — event dashboard. Sentinel matchPrefix so the strict-
          // prefix branch never fires (every other route shares ${base}/).
          key: 'home',
          // Renamed Home → Overview (owner-approved product naming; matches the
          // design prototype). Route + exact-match sentinel unchanged.
          label: 'Overview',
          href: base,
          icon: SetnayanMark as unknown as LucideIcon,
          matchPrefix: '__home__',
          // Overview is a plain leaf — no sub-items (owner 2026-07-10: "the menu
          // does not need checklist, schedule, messages and contracts"). Those
          // surfaces stay reachable from the dashboard body + topbar: Schedule
          // from the dashboard's Schedule section, Checklist from its task cards,
          // Messages from the Conversations card + vendor cards + the topbar bell,
          // Contracts from the vendor itemization cards. "Refer a couple" (the
          // lone remaining child) came out too so the item reads as a clean leaf;
          // its /refer route is unchanged (reachable via direct link / account).
        },
        {
          // 2 · Guests — full guest hub, now a PLAIN LEAF (owner 2026-07-10:
          // the guest-journey stages Build·Invite·Confirm·Seat·Day-of·Event-QR
          // are integrated into the single Guests page — no sidebar submenu).
          // Mirrors the Overview leaf above. Seat (/seating) still opens from
          // within the Guests page; it stays in the mobile SSOT's activeMatch
          // (lib/customer-menu.ts) though the sidebar's single matchPrefix lights
          // only on /guests.
          key: 'guests',
          label: 'Guests',
          href: `${base}/guests`,
          icon: Users,
          matchPrefix: `${base}/guests`,
          // Guest-count badge — real head-count resolved in layout.tsx. 0/absent
          // → no badge (never fabricated).
          ...(opts?.guestCount && opts.guestCount > 0
            ? { badge: { count: opts.guestCount, tone: 'neutral' as const } }
            : {}),
        },
        {
          // 3 · Explore — vendor marketplace. Sub-items are the 5 Build tabs
          // (Summary · Shortlist · Build · Compare · Lock); clicking them fires
          // the BB_TAB_EVENT bus (no server round-trip) via SidebarItem's tab
          // child handler, mirroring what the mobile <SubNav> pill does.
          key: 'explore',
          // Renamed Explore → Merkado (owner-approved product naming; matches
          // the design prototype). Key + route (/vendors) + match unchanged.
          label: 'Merkado',
          href: `${base}/vendors`,
          icon: Compass,
          matchPrefix: `${base}/vendors`,
          children: BUDGET_BUILD_TABS.map((t) => ({
            key: `explore-${t}`,
            label: TAB_META[t].label,
            href: `${base}/vendors?tab=${t}`,
            icon: TAB_META[t].icon,
            matchPrefix: `${base}/vendors`,
            tab: t,
          })),
        },
        {
          // 4 · Studio — add-ons hub. Expands to design surfaces that all
          // light the Studio tab on mobile (site-editor + /monogram).
          key: 'studio',
          label: 'Studio',
          href: `${base}/studio`,
          icon: Sparkles,
          matchPrefix: `${base}/studio`,
          children: [
            // Website surface — Event page (the host's doorway to the live guest
            // page), the site editor, and Launch (preview + go-live). Shown ONLY
            // for event types whose profile enables 'website' (weddings today;
            // resolved in layout.tsx → websiteEnabled). A birthday with no website
            // surface never sees these. Wedding enables it → byte-identical.
            ...(opts?.websiteEnabled
              ? [
                  {
                    key: 'event-page',
                    label: 'Event page',
                    href: `${base}/event-page`,
                    icon: Eye,
                    matchPrefix: `${base}/event-page`,
                  },
                  {
                    key: 'website',
                    label: 'Website',
                    href: `/site-editor/${eventId}`,
                    icon: Globe,
                    matchPrefix: `/site-editor/${eventId}`,
                  },
                ]
              : []),
            {
              key: 'mood-board',
              label: 'Mood Board',
              href: `${base}/studio/mood-board`,
              icon: Palette,
              matchPrefix: `${base}/studio/mood-board`,
            },
            // Monogram surface — gated per event type (weddings today). A
            // non-wedding event whose profile omits 'monogram' never sees it.
            ...(opts?.monogramEnabled
              ? [
                  {
                    key: 'monogram',
                    label: 'Monogram',
                    href: `${base}/monogram`,
                    icon: Type,
                    matchPrefix: `${base}/monogram`,
                  },
                ]
              : []),
            {
              key: 'live',
              label: 'Live Wall',
              href: `${base}/live`,
              icon: MonitorPlay,
              matchPrefix: `${base}/live`,
            },
          ],
        },
        // (Launch moved OUT of the Plan items into its own "Go live" section —
        // see `launchItem` above + the two-group composition below.)
        // Budget top-level item REMOVED 2026-07-10 (owner) to match the mobile
        // SSOT (lib/customer-menu.ts): the budget now lives inside the Merkado
        // (Vendors → Build · Budget · Compare). /budget stays reachable from the
        // Merkado's Budget tab; /activity + /disputes from the dashboard body +
        // the vendor booking cancel→dispute flow. See the header docstring.
  ];

  // Two labelled sidebar sections (design: setnayan-overview-energy.html):
  //   PLAN    → Overview · Guests · Merkado · Studio
  //   GO LIVE → Launch (the couple's live personal website)
  // Replaces the single header-less 'root' group. The Go-live section only
  // exists when Launch does (websiteEnabled) — an empty section would render a
  // heading with no rows.
  const groups: NavGroup[] = [
    { key: 'plan', label: 'Plan', defaultOpen: true, items: planItems },
    ...(launchItem
      ? [{ key: 'golive', label: 'Go live', defaultOpen: true, items: [launchItem] } as NavGroup]
      : []),
  ];

  // Per-event-type gating (e.g. a vendor-free Simple Event drops 'explore').
  // Empty/undefined hideKeys → unchanged for wedding + all existing types.
  // ('budget' is no longer a top-level item, so a 'budget' hideKey is a harmless
  // no-op — kept accepted for parity with the mobile tree, lib/customer-menu.ts.)
  if (!opts?.hideKeys?.length) return groups;
  const hide = new Set(opts.hideKeys);
  return groups.map((g) => ({ ...g, items: g.items.filter((i) => !hide.has(i.key)) }));
}
