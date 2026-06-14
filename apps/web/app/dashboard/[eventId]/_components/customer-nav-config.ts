/**
 * Customer NavGroup[] builder — JOURNEY-GROUP NAV (0021 ADDENDUM · accordion
 * bottom nav + side nav · owner-locked · re-pointed from the destination-menu
 * structure shipped in PR #1465 back to the journey-group IA the owner wants).
 *
 * ONE config, two renderings. The mobile bottom nav (accordion) and the
 * desktop side nav are driven by the SAME six JOURNEY groups. Every top-level
 * menu is a journey PHASE that EXPANDS to its children — NONE navigate
 * directly (there is no childless "navigates straight" menu anymore):
 *   1. Setnayan — Home · Studio · Explore
 *   2. Plan     — Guests · Seating · Schedule · Budget
 *   3. Book     — Messages · Contracts
 *   4. Design   — Website · Mood Board · Monogram
 *   5. Day-of   — Live Wall · Event QR
 *   6. After    — Activity · Disputes
 *
 * The bottom nav consumes these SAME groups via buildCustomerNavMenus
 * (customer-bottom-nav.tsx), which maps each NavGroup → a BottomNavMenu
 * { key, label, icon: group.icon, children: group.items }. Because every menu
 * has children, every menu EXPANDS on tap (the accordion machinery in
 * bottom-nav.tsx already lights a parent when any child matches the route and
 * never navigates a parent that has children — no special-casing needed).
 * Home is a CHILD of Setnayan (tap Setnayan → Home), by design.
 *
 * This file is the single source of truth; customer-sidebar.tsx renders each
 * group as a collapsible sidebar SECTION (the group = the section heading, its
 * items = the section's rows). "Same model, platform skin" (spec §7).
 *
 * NO "More" overflow (the /more landing is retired → redirect). NO Settings
 * group — Personalization (`/details`) · Hosts (`/hosts`) · Profile · all
 * account settings live under the profile avatar (top-right ProfileMenu →
 * Profile / Settings / Sign out · front door to iteration 0025). The
 * Personalization + Hosts ROUTES still exist and are reachable directly /
 * via the Profile/Settings page; they're just off the primary nav bar.
 *
 * The per-group `icon` field (added to the NavGroup type) carries the
 * bottom-nav menu glyph. The desktop sidebar renders section headings as text
 * and ignores it.
 *
 * Server-Component safety (unchanged): this is a NEUTRAL (non-'use client')
 * module so both the client sidebar (customer-sidebar.tsx) and any Server
 * Component can import + call the builder. Lucide icon refs render in both
 * server + client contexts.
 *
 * Stable group/item `key` values are PRESERVED (main · plan · book · design ·
 * dayof · after for the groups; home · add-ons · vendors · guests · seating ·
 * schedule · budget · messages · contracts · website · mood-board · monogram
 * · live · event-qr · activity · disputes for the items) so the per-section
 * `setnayan.nav.section.<key>.open` localStorage state survives the regroup.
 *
 * NavGroup type is imported from the neutral types module.
 */

import {
  Home,
  ClipboardList,
  Handshake,
  Palette,
  PartyPopper,
  Heart,
  Sparkles,
  Compass,
  Users,
  LayoutGrid,
  CalendarClock,
  Wallet,
  MessageSquare,
  FileText,
  Globe,
  Type,
  MonitorPlay,
  QrCode,
  Activity,
  Shield,
} from 'lucide-react';
import type { NavGroup } from '@/app/_components/nav/types';

/**
 * Builds the canonical customer NavGroup[] for the given eventId — the six
 * journey groups. Each group carries an `icon` (the bottom-nav menu glyph)
 * and its `items` (the children that expand). Single source of truth for both
 * the desktop sidebar (collapsible sections) and the mobile accordion bottom
 * nav (via buildCustomerNavMenus, which mirrors this roster 1:1).
 */
export function buildCustomerNavGroups(eventId: string): NavGroup[] {
  const base = `/dashboard/${eventId}`;

  return [
    {
      // 1 · Setnayan — the home/services/explore cluster. Home is a CHILD
      // (tap Setnayan → Home), per the journey-group model.
      key: 'main',
      label: 'Setnayan',
      icon: Home,
      defaultOpen: true,
      items: [
        {
          key: 'home',
          label: 'Home',
          href: base,
          icon: Home,
          // Sentinel matchPrefix so the strict-prefix branch never fires —
          // every other event route shares the `${base}/` prefix.
          matchPrefix: '__home__',
        },
        {
          key: 'add-ons',
          label: 'Studio',
          href: `${base}/add-ons`,
          icon: Sparkles,
          matchPrefix: `${base}/add-ons`,
        },
        {
          key: 'vendors',
          label: 'Explore',
          href: `${base}/vendors`,
          icon: Compass,
          matchPrefix: `${base}/vendors`,
        },
      ],
    },
    {
      // 2 · Plan — the couple's core planning surfaces.
      key: 'plan',
      label: 'Plan',
      icon: ClipboardList,
      defaultOpen: true,
      items: [
        {
          key: 'guests',
          label: 'Guests',
          href: `${base}/guests`,
          icon: Users,
          matchPrefix: `${base}/guests`,
        },
        {
          key: 'seating',
          label: 'Seating',
          href: `${base}/seating`,
          icon: LayoutGrid,
          matchPrefix: `${base}/seating`,
        },
        {
          key: 'schedule',
          label: 'Schedule',
          href: `${base}/schedule`,
          icon: CalendarClock,
          matchPrefix: `${base}/schedule`,
        },
        {
          key: 'budget',
          label: 'Budget',
          href: `${base}/budget`,
          icon: Wallet,
          matchPrefix: `${base}/budget`,
        },
      ],
    },
    {
      // 3 · Book — talk to vendors and sign with them.
      key: 'book',
      label: 'Book',
      icon: Handshake,
      defaultOpen: false,
      items: [
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
      // 4 · Design — the look & feel of the wedding.
      key: 'design',
      label: 'Design',
      icon: Palette,
      defaultOpen: false,
      items: [
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
      ],
    },
    {
      // 5 · Day-of — the live event-day surfaces.
      key: 'dayof',
      label: 'Day-of',
      icon: PartyPopper,
      defaultOpen: false,
      items: [
        {
          key: 'live',
          label: 'Live Wall',
          href: `${base}/live`,
          icon: MonitorPlay,
          matchPrefix: `${base}/live`,
        },
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
      // 6 · After — post-event activity + dispute resolution.
      key: 'after',
      label: 'After',
      icon: Heart,
      defaultOpen: false,
      items: [
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
  ];
}
