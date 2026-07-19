/**
 * Customer NavGroup[] builder — TWO LABELLED SECTIONS (design:
 * setnayan-overview-energy.html · 2026-07-10).
 *
 * The desktop sidebar is organised into two labelled sections matching the
 * couple energy prototype:
 *   PLAN    → Overview · Guests · Merkado · Studio
 *   GO LIVE → Launch (the couple's live personal website)
 * EVERY top-level item is a PLAIN LEAF (owner 2026-07-15: "solid menu with no
 * submenus" — extends the vendor 5-page IA + the 2026-07-10 Overview/Guests
 * plain-leaf decision to the whole couple rail). No item expands children in the
 * rail; sub-navigation lives INSIDE each page (the Merkado tab strip, the Studio
 * hub body). The PLAN / GO LIVE strings are flat SECTION HEADINGS, not
 * expandable parents. The mobile bottom nav (lib/customer-menu.ts) carries the
 * same top-level destinations + labels (Overview · Guests · Merkado · Studio).
 *
 * PLAN items (all plain leaves):
 *   1. Overview → /dashboard/[id]         (its old checklist/schedule/messages/
 *      contracts children were flattened #3004; those surfaces live in the
 *      dashboard body + topbar). Renamed from "Home"; route + exact-match
 *      sentinel unchanged.
 *   2. Guests   → /dashboard/[id]/guests  (the guest-journey stages are
 *      integrated into the single Guests page) · guest-count badge.
 *   3. Merkado  → /dashboard/[id]/vendors (the Build/Budget/Compare tabs live in
 *      the page's own tab strip) — renamed from "Explore"; key + route unchanged.
 *   4. Studio   → /dashboard/[id]/studio  (Event page · Website · Mood Board ·
 *      Monogram · Live Wall · E-Gifts all live in the Studio hub body — the App
 *      Store catalog rows + the hub's "Set up & manage" doorway block, NOT the
 *      rail — owner 2026-07-15 "no submenus")
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
  Rocket,
  CalendarDays,
  Armchair,
  Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { NavGroup, NavItem } from '@/app/_components/nav/types';
import { SetnayanMark } from '@/app/_components/setnayan-mark-icon';

/**
 * Suite nav doorway (owner 2026-07-19: surface name locked = "Suite"; the nav
 * slot REPLACES Studio, flag-gated via NEXT_PUBLIC_SUITE — same flag that
 * un-404s /dashboard/[eventId]/suite). Flag ON → the Studio rail item renders
 * as Suite → `${base}/suite`; flag OFF → Studio exactly as today. The /studio
 * routes stay reachable either way (deep links + buy pages untouched) — only
 * the doorway swaps. Item KEY stays 'studio' (stable: hideKeys gating + the
 * customer.sidebar.studio registry slot key off it). NEXT_PUBLIC_* is inlined
 * into the client bundle at build time, so this neutral module reads the same
 * value on server + client (no hydration split). Mirror: lib/customer-menu.ts
 * (mobile SSOT) + lib/nav-registry-defaults.ts (registry label default).
 */
const SUITE_NAV_ON = process.env.NEXT_PUBLIC_SUITE === 'true';

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
          // 3 · Merkado — vendor marketplace. PLAIN LEAF (owner 2026-07-15:
          // "solid menu with no submenus"). The 5 Build tabs (Summary ·
          // Shortlist · Build · Compare · Lock) that used to expand here as
          // sidebar children now live ONLY as the page's own tab strip inside
          // /vendors (the docked <SubNav> pill / BB_TAB_EVENT bus is unchanged),
          // so tapping this row lands on /vendors and the in-page strip covers
          // the tabs. The single matchPrefix (${base}/vendors) keeps the item lit
          // on every ?tab= state (query-less prefix match).
          key: 'explore',
          // Renamed Explore → Merkado (owner-approved product naming; matches
          // the design prototype). Key + route (/vendors) + match unchanged.
          label: 'Merkado',
          href: `${base}/vendors`,
          icon: Compass,
          matchPrefix: `${base}/vendors`,
        },
        {
          // 4 · Studio — add-ons hub. PLAIN LEAF (owner 2026-07-15: "solid menu
          // with no submenus"). The design surfaces that used to expand here as
          // sidebar children (Event page · Website · Mood Board · Monogram · Live
          // Wall · E-Gifts) now live ONLY inside the Studio hub body: Mood Board
          // / Monogram / Website are App Store rows in "Browse everything"
          // (lib/add-ons-catalog.ts), and Event page / Live Wall / E-Gifts get an
          // explicit "Set up & manage" doorway block on the hub page
          // (studio/page.tsx) — added there because they aren't catalog SKUs, so
          // nothing orphans. matchPrefix (${base}/studio) keeps this lit on the
          // hub + /studio/* (mood-board, add-on detail); the disjoint surfaces
          // (/monogram, /live, /event-page, /pabuya, /site-editor) are their own
          // destinations reached from the hub body, same as the vendor 5-page IA.
          // SUITE SWAP (flag-gated, see SUITE_NAV_ON above): when on, this slot
          // is the Suite doorway → `${base}/suite`; matchPrefix follows the href
          // (a deep-linked /studio page then lights no rail item — matchPrefix is
          // a single prefix; the mobile tab still lights via its activeMatch
          // array in lib/customer-menu.ts).
          key: 'studio',
          label: SUITE_NAV_ON ? 'Suite' : 'Studio',
          href: SUITE_NAV_ON ? `${base}/suite` : `${base}/studio`,
          icon: Sparkles,
          matchPrefix: SUITE_NAV_ON ? `${base}/suite` : `${base}/studio`,
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
  // "ALSO IN THIS EVENT" — the off-nav destinations the proto keeps as quiet
  // flat links (design: event_dashboard_v2_2026-07-15.html · the rail's "also
  // in this event" block). These are NOT top-level tabs (Schedule lives off the
  // rail by design; Seat plan + Budget live inside Guests / Merkado), but they
  // are real routes couples reach often, so the rail surfaces them as plain
  // links — flat, never a submenu (the whole-rail plain-leaf rule holds). Each
  // matchPrefix lights the row on its own route. Budget carries key 'budget' so
  // the Simple-Event `budget` hideKey drops it (same gate as the mobile SSOT).
  const alsoItems: NavItem[] = [
    {
      key: 'schedule',
      label: 'Schedule',
      href: `${base}/schedule`,
      icon: CalendarDays,
      matchPrefix: `${base}/schedule`,
    },
    {
      key: 'seat',
      label: 'Seat plan',
      href: `${base}/seating`,
      icon: Armchair,
      matchPrefix: `${base}/seating`,
    },
    {
      key: 'budget',
      label: 'Budget',
      href: `${base}/budget`,
      icon: Wallet,
      matchPrefix: `${base}/budget`,
    },
  ];

  // Two labelled sidebar sections (design: setnayan-overview-energy.html):
  //   PLAN    → Overview · Guests · Merkado · Studio
  //   GO LIVE → Launch (the couple's live personal website)
  //   ALSO IN THIS EVENT → Schedule · Seat plan · Budget (flat off-nav links)
  const groups: NavGroup[] = [
    { key: 'plan', label: 'Plan', defaultOpen: true, items: planItems },
    ...(launchItem
      ? [{ key: 'golive', label: 'Go live', defaultOpen: true, items: [launchItem] } as NavGroup]
      : []),
    { key: 'also', label: 'Also in this event', defaultOpen: true, items: alsoItems },
  ];

  // Per-event-type gating (e.g. a vendor-free Simple Event drops 'explore').
  // Empty/undefined hideKeys → unchanged for wedding + all existing types.
  // ('budget' is no longer a top-level item, so a 'budget' hideKey is a harmless
  // no-op — kept accepted for parity with the mobile tree, lib/customer-menu.ts.)
  if (!opts?.hideKeys?.length) return groups;
  const hide = new Set(opts.hideKeys);
  return groups.map((g) => ({ ...g, items: g.items.filter((i) => !hide.has(i.key)) }));
}
