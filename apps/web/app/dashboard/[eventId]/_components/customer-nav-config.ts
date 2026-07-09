/**
 * Customer NavGroup[] builder — UNIFIED 5-TAB NAV (sidebar mirrors mobile).
 *
 * Owner 2026-06-17: the desktop sidebar now mirrors the mobile 5-tab bar
 * (Home · Guests · Explore · Studio · Budget). ONE header-less group, five
 * top-level items, each auto-expanding on the desktop sidebar to reveal their
 * sub-pages. This makes the desktop and mobile primary nav structurally
 * identical at the top level while the sidebar reveals deeper sub-pages.
 *
 * Five tabs (same as the mobile bottom nav — sourced from lib/customer-menu.ts):
 *   1. Home    → /dashboard/[id]         (checklist · schedule · messages · contracts)
 *   2. Guests  → /dashboard/[id]/guests  (five journey stages + event-qr)
 *   3. Explore → /dashboard/[id]/vendors (marketplace — leaf, no sub-pages)
 *   4. Studio  → /dashboard/[id]/add-ons (website · mood-board · monogram · live wall)
 *   5. Budget  → /dashboard/[id]/budget  (activity · disputes)
 *
 * The `group.label === ''` convention signals to SidebarSection that no
 * heading button should be rendered — just the items list. The group key
 * 'root' is stable so no localStorage section-state is lost.
 *
 * GUEST JOURNEY — the Guests item carries `children` = the five guest-journey
 * stages from lib/guest-journey (Build · Invite · Confirm · Seat · Day-of),
 * same SSOT as the mobile <SubNav> pill. `opts.dayOfOpen` un-mutes the
 * time-gated Day-of stage once the live window opens; defaults to false.
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
  ListChecks,
  Route,
  Users,
  CalendarClock,
  MessageSquare,
  FileText,
  Compass,
  Sparkles,
  Globe,
  Palette,
  Type,
  MonitorPlay,
  QrCode,
  Wallet,
  Activity,
  Shield,
  Eye,
  Rocket,
  Gift,
} from 'lucide-react';
import { BUDGET_BUILD_TABS, TAB_META } from '@/lib/budget-build';
import type { LucideIcon } from 'lucide-react';
import type { NavGroup, NavItem } from '@/app/_components/nav/types';
import { SetnayanMark } from '@/app/_components/setnayan-mark-icon';
import { buildGuestJourney } from '@/lib/guest-journey';

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
  },
): NavGroup[] {
  const base = `/dashboard/${eventId}`;

  // Guest-journey children — mapped from the lib/guest-journey SSOT so the
  // sidebar journey and the mobile <SubNav> can never drift.
  const guestJourneyChildren: NavItem[] = buildGuestJourney(eventId, {
    dayOfOpen: opts?.dayOfOpen ?? false,
  }).map((stage) => ({
    key: stage.key,
    label: stage.label,
    href: stage.href,
    icon: stage.icon,
    matchPrefix: stage.match,
    muted: stage.muted,
  }));

  const groups: NavGroup[] = [
    {
      key: 'root',
      label: '', // header-less — SidebarSection skips the heading button
      defaultOpen: true,
      items: [
        {
          // 1 · Home — event dashboard. Sentinel matchPrefix so the strict-
          // prefix branch never fires (every other route shares ${base}/).
          key: 'home',
          label: 'Home',
          href: base,
          icon: SetnayanMark as unknown as LucideIcon,
          matchPrefix: '__home__',
          children: [
            {
              key: 'checklist',
              label: 'Checklist',
              href: `${base}/checklist`,
              icon: ListChecks,
              matchPrefix: `${base}/checklist`,
            },
            {
              // Decisions & Progress — journey rail + decisions board
              // (production port of the 2026-07-09 session prototype).
              key: 'progress',
              label: 'Progress',
              href: `${base}/progress`,
              icon: Route,
              matchPrefix: `${base}/progress`,
            },
            {
              key: 'schedule',
              label: 'Schedule',
              href: `${base}/schedule`,
              icon: CalendarClock,
              matchPrefix: `${base}/schedule`,
            },
            {
              key: 'messages',
              label: 'Messages',
              href: `${base}/messages`,
              icon: MessageSquare,
              matchPrefix: `${base}/messages`,
            },
            {
              key: 'contracts',
              label: 'Contracts',
              href: `${base}/contracts`,
              icon: FileText,
              matchPrefix: `${base}/contracts`,
            },
            {
              // Couple referral rewards — share your link; both sides get a
              // perk when a referred couple books their first service.
              key: 'refer',
              label: 'Refer a couple',
              href: `${base}/refer`,
              icon: Gift,
              matchPrefix: `${base}/refer`,
            },
          ],
        },
        {
          // 2 · Guests — full guest hub. Expands to the five journey stages +
          // Event QR. matchPrefix on /guests so /seating (the Seat stage) also
          // keeps the parent lit via its own matchPrefix in the child.
          key: 'guests',
          label: 'Guests',
          href: `${base}/guests`,
          icon: Users,
          matchPrefix: `${base}/guests`,
          children: [
            ...guestJourneyChildren,
            {
              key: 'event-qr',
              label: 'Event QR',
              href: `${base}/event-qr`,
              icon: QrCode,
              matchPrefix: `${base}/event-qr`,
            },
          ],
        },
        {
          // 3 · Explore — vendor marketplace. Sub-items are the 5 Build tabs
          // (Summary · Shortlist · Build · Compare · Lock); clicking them fires
          // the BB_TAB_EVENT bus (no server round-trip) via SidebarItem's tab
          // child handler, mirroring what the mobile <SubNav> pill does.
          key: 'explore',
          label: 'Explore',
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
        // "Launch" (owner 2026-06-28; repointed 2026-07-02) — a TOP-LEVEL,
        // always-visible sidebar entry that OPENS THE COUPLE'S LIVE PERSONAL
        // WEBSITE (`/[slug]`) directly (owner: "launch on customer event is
        // their personal website"). A signed-in host always sees their own page
        // even while it's still private (app/[slug]/page.tsx host-gate), so this
        // is safe pre-publish. Before a slug exists we fall back to the
        // go-live/setup surface (`/website/launch`) so they can publish. NOT a
        // Studio child: the sidebar collapses a parent's children unless the
        // active route is inside that section, so as a Studio child it was
        // invisible from Home/Guests/etc. Gated on the 'website' surface
        // (websiteEnabled). Not added to the locked 5-tab mobile bottom nav;
        // mobile reaches it via the Studio section sub-nav.
        ...(opts?.websiteEnabled
          ? [
              {
                key: 'launch',
                label: 'Launch',
                href: opts?.slug ? `/${opts.slug}` : `${base}/website/launch`,
                icon: Rocket,
                matchPrefix: opts?.slug ? `/${opts.slug}` : `${base}/website/launch`,
              } as NavItem,
            ]
          : []),
        {
          // 5 · Budget — financial planning. Activity + Disputes are secondary
          // financial views surfaced only on the desktop sidebar.
          key: 'budget',
          label: 'Budget',
          href: `${base}/budget`,
          icon: Wallet,
          matchPrefix: `${base}/budget`,
          children: [
            {
              key: 'activity',
              label: 'Activity',
              href: `${base}/activity`,
              icon: Activity,
              matchPrefix: `${base}/activity`,
            },
            {
              key: 'disputes',
              label: 'Disputes',
              href: `${base}/disputes`,
              icon: Shield,
              matchPrefix: `${base}/disputes`,
            },
          ],
        },
      ],
    },
  ];

  // Per-event-type gating (e.g. a vendor-free Simple Event drops 'explore' +
  // 'budget'). Empty/undefined hideKeys → unchanged for wedding + all existing
  // types. Mirrors the same filter on the mobile tree (lib/customer-menu.ts).
  if (!opts?.hideKeys?.length) return groups;
  const hide = new Set(opts.hideKeys);
  return groups.map((g) => ({ ...g, items: g.items.filter((i) => !hide.has(i.key)) }));
}
