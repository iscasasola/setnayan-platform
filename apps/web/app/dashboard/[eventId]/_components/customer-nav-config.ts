/**
 * Customer NavGroup[] builder — the 5-MENU sidebar (customer-menu redesign,
 * owner-locked 2026-06-17). Supersedes the 6 journey-phase groups.
 *
 * The desktop sidebar mirrors the mobile bottom nav's FIVE menus as a flat list
 * of EXPANDABLE ITEMS (owner picked "5 expandable items" over section groups):
 *   Home · Guests · Explore · Studio · Budget
 * Each item auto-expands to its children when active (the `SidebarItem.children`
 * pattern from #1595 — the desktop home of the mobile <SubNav> pill). They're
 * returned inside ONE header-less NavGroup (label ''), so <SidebarSection> draws
 * no section eyebrow — just the five rows.
 *
 * Children are REAL PAGES (the sidebar is richer than the minimal mobile dock;
 * they unify at the top level, not child-for-child):
 *   Home   → Checklist · Schedule · Activity      (tap Home → event overview)
 *   Guests → Build · Invite · Confirm · Seat · Day-of · Event QR  (journey SSOT)
 *   Explore→ (leaf → the vendor marketplace; its in-page takeover tabs live there)
 *   Studio → Website · Mood Board · Monogram · Live Wall  (tap Studio → the hub)
 *   Budget → Disputes                              (tap Budget → the budget page)
 *
 * MESSAGES + CONTRACTS are NOT in the sidebar — they're upper-right TOPBAR icons
 * (owner 2026-06-17): Messages = the existing <UnreadMessagesBadge>, Contracts =
 * a sibling icon-link (both in `[eventId]/layout.tsx` topBar).
 *
 * Server-Component safety (unchanged): NEUTRAL (non-'use client') module so both
 * the client sidebar and any Server Component can import + call the builder;
 * lucide icon refs render in both contexts.
 *
 * Stable item `key`s (home · guests · explore · studio · budget for the five
 * menus; guest-journey + checklist/schedule/activity/website/mood-board/monogram/
 * live/event-qr/disputes for children) — registry overlay keys live in
 * customer-sidebar.tsx's SIDEBAR_SLOT_KEYS (top-level items only).
 *
 * NavGroup / NavItem types come from the neutral types module.
 */

import {
  Home,
  ListChecks,
  Palette,
  Sparkles,
  Compass,
  Users,
  CalendarClock,
  Wallet,
  Globe,
  Type,
  MonitorPlay,
  QrCode,
  Activity,
  Shield,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { NavGroup, NavItem } from '@/app/_components/nav/types';
import { SetnayanMark } from '@/app/_components/setnayan-mark-icon';
import { buildGuestJourney } from '@/lib/guest-journey';

/**
 * Builds the customer sidebar's single NavGroup — five expandable menu items.
 * `opts.dayOfOpen` un-mutes the time-gated Guests "Day-of" stage once the live
 * window is open (the client sidebar computes it from the event date and passes
 * it in). Defaults to false (Day-of muted) — safe for any caller.
 */
export function buildCustomerNavGroups(
  eventId: string,
  opts?: { dayOfOpen?: boolean },
): NavGroup[] {
  const base = `/dashboard/${eventId}`;

  // The guest-journey stages, mapped from the lib/guest-journey SSOT into the
  // sidebar NavItem shape (its `match` becomes our `matchPrefix`). One source of
  // truth so the sidebar journey and the mobile <SubNav> can never drift.
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
      // ONE header-less group (label '') → <SidebarSection> renders no eyebrow;
      // its five items are the customer menus, each auto-expanding to children.
      key: 'menus',
      label: '',
      icon: SetnayanMark as unknown as LucideIcon,
      defaultOpen: true,
      items: [
        {
          key: 'home',
          label: 'Home',
          href: base,
          icon: Home,
          // Sentinel matchPrefix so the strict-prefix branch never fires (every
          // other event route shares `${base}/`); the parent matches on exact base.
          matchPrefix: '__home__',
          children: [
            { key: 'checklist', label: 'Checklist', href: `${base}/checklist`, icon: ListChecks, matchPrefix: `${base}/checklist` },
            { key: 'schedule', label: 'Schedule', href: `${base}/schedule`, icon: CalendarClock, matchPrefix: `${base}/schedule` },
            { key: 'activity', label: 'Activity', href: `${base}/activity`, icon: Activity, matchPrefix: `${base}/activity` },
          ],
        },
        {
          key: 'guests',
          label: 'Guests',
          href: `${base}/guests`,
          icon: Users,
          matchPrefix: `${base}/guests`,
          children: [
            ...guestJourneyChildren,
            { key: 'event-qr', label: 'Event QR', href: `${base}/event-qr`, icon: QrCode, matchPrefix: `${base}/event-qr` },
          ],
        },
        {
          // Explore is a LEAF → the vendor marketplace. Its in-page takeover tabs
          // (Summary/Shortlist/Build/Compare/Lock) live on the page itself.
          key: 'explore',
          label: 'Explore',
          href: `${base}/vendors`,
          icon: Compass,
          matchPrefix: `${base}/vendors`,
        },
        {
          key: 'studio',
          label: 'Studio',
          href: `${base}/add-ons`,
          icon: Sparkles,
          matchPrefix: `${base}/add-ons`,
          children: [
            { key: 'website', label: 'Website', href: `/site-editor/${eventId}`, icon: Globe, matchPrefix: `/site-editor/${eventId}` },
            { key: 'mood-board', label: 'Mood Board', href: `${base}/add-ons/mood-board`, icon: Palette, matchPrefix: `${base}/add-ons/mood-board` },
            { key: 'monogram', label: 'Monogram', href: `${base}/monogram`, icon: Type, matchPrefix: `${base}/monogram` },
            { key: 'live', label: 'Live Wall', href: `${base}/live`, icon: MonitorPlay, matchPrefix: `${base}/live` },
          ],
        },
        {
          key: 'budget',
          label: 'Budget',
          href: `${base}/budget`,
          icon: Wallet,
          matchPrefix: `${base}/budget`,
          children: [
            { key: 'disputes', label: 'Disputes', href: `${base}/disputes`, icon: Shield, matchPrefix: `${base}/disputes` },
          ],
        },
      ],
    },
  ];
}
