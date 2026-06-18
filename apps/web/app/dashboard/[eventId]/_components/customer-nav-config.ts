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
} from 'lucide-react';
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
  opts?: { dayOfOpen?: boolean },
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

  return [
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
          // 3 · Explore — vendor marketplace. Leaf node (no sub-pages).
          key: 'explore',
          label: 'Explore',
          href: `${base}/vendors`,
          icon: Compass,
          matchPrefix: `${base}/vendors`,
        },
        {
          // 4 · Studio — add-ons hub. Expands to design surfaces that all
          // light the Studio tab on mobile (site-editor + /monogram).
          key: 'studio',
          label: 'Studio',
          href: `${base}/add-ons`,
          icon: Sparkles,
          matchPrefix: `${base}/add-ons`,
          children: [
            {
              key: 'website',
              label: 'Website',
              href: `/site-editor/${eventId}`,
              icon: Globe,
              matchPrefix: `/site-editor/${eventId}`,
            },
            {
              key: 'mood-board',
              label: 'Mood Board',
              href: `${base}/add-ons/mood-board`,
              icon: Palette,
              matchPrefix: `${base}/add-ons/mood-board`,
            },
            {
              key: 'monogram',
              label: 'Monogram',
              href: `${base}/monogram`,
              icon: Type,
              matchPrefix: `${base}/monogram`,
            },
            {
              key: 'live',
              label: 'Live Wall',
              href: `${base}/live`,
              icon: MonitorPlay,
              matchPrefix: `${base}/live`,
            },
          ],
        },
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
}
