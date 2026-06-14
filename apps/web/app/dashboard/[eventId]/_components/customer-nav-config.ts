/**
 * Customer NavGroup[] builder — UNIFIED NAV (0021 ADDENDUM · accordion bottom
 * nav + side nav · owner-locked 2026-06-15).
 *
 * ONE config, two renderings. The bottom nav (mobile) and the side nav
 * (desktop) are driven by the SAME six-destination model:
 *   1. Home    — navigates (no children)
 *   2. Guests  — Summary · Search · Add · Customize · Journey
 *   3. Vendors — Explore · Messages · Contracts · Disputes
 *   4. Studio  — Website · Mood Board · Monogram
 *   5. Budget  — navigates (no children)
 *   6. Wedding — Find date · Schedule · Seating · Event QR · Live Wall
 *
 * The bottom nav consumes the accordion shape directly via
 * buildCustomerNavMenus (customer-bottom-nav.tsx · BottomNavMenu[]). This
 * file is the DESKTOP-SIDEBAR projection of that same model into NavGroup[]:
 * each of the six menus becomes a sidebar SECTION (the menu = the section
 * heading), with its children as the section's items. Childless menus (Home,
 * Budget) render as a single-item section so they stay one tap away. "Same
 * model, platform skin" (spec §7).
 *
 * NO "More" overflow (the /more landing is retired → redirect). NO Settings
 * group — Profile · Appearance · Notifications · URL & Slug · Payment Methods
 * · Privacy & Data · Hosts all live under the profile avatar (top-right
 * ProfileMenu → Profile / Settings · front door to iteration 0025).
 * Owner-approved re-homings (spec §2): Disputes → Vendors · Find your date →
 * Wedding · Activity → folded into Home (Home's event hub surfaces the
 * activity feed). Hosts is reachable via the avatar/Settings (omitted from
 * the bar).
 *
 * Server-Component safety (unchanged): this is a NEUTRAL (non-'use client')
 * module so both the client sidebar (customer-sidebar.tsx) and any Server
 * Component can import + call the builder. Lucide icon refs render in both
 * server + client contexts. See PR #614 lineage in the prior header.
 *
 * Stable group/item `key` values are PRESERVED where they previously existed
 * (home · guests · vendors · add-ons · budget · messages · contracts ·
 * disputes · website · mood-board · monogram · schedule · seating · event-qr
 * · live · find-date) so the per-section `setnayan.nav.section.<key>.open`
 * localStorage state survives the regroup.
 *
 * NavGroup type is imported from the neutral types module.
 */

import {
  Home,
  Users,
  Compass,
  Sparkles,
  Wallet,
  Heart,
  LayoutDashboard,
  Search,
  UserPlus,
  SlidersHorizontal,
  Route,
  MessageSquare,
  FileText,
  AlertTriangle,
  Globe,
  Palette,
  Type,
  CalendarSearch,
  CalendarClock,
  LayoutGrid,
  QrCode,
  MonitorPlay,
} from 'lucide-react';
import type { NavGroup } from '@/app/_components/nav/types';

/**
 * Builds the canonical customer NavGroup[] for the given eventId — the desktop
 * sidebar projection of the six-destination accordion model. Single source of
 * truth on desktop; the mobile bottom nav uses the sibling
 * buildCustomerNavMenus (BottomNavMenu[]) which carries the identical roster.
 */
export function buildCustomerNavGroups(eventId: string): NavGroup[] {
  const base = `/dashboard/${eventId}`;

  return [
    {
      // 1 · Home — navigates (no children). Single-item section.
      key: 'home',
      label: 'Home',
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
      ],
    },
    {
      // 2 · Guests — lifecycle accordion.
      key: 'guests',
      label: 'Guests',
      defaultOpen: true,
      items: [
        {
          key: 'guests',
          label: 'Summary',
          href: `${base}/guests`,
          icon: LayoutDashboard,
          // Exact home for /guests — sub-routes (new, import, [id]) light their
          // own entries / fall under the umbrella below.
          matchPrefix: '__guests-summary__',
        },
        {
          key: 'guests-search',
          label: 'Search',
          href: `${base}/guests?gpanel=search`,
          icon: Search,
          matchPrefix: '__guests-search__',
        },
        {
          key: 'guests-add',
          label: 'Add',
          href: `${base}/guests/new`,
          icon: UserPlus,
          matchPrefix: `${base}/guests/new`,
        },
        {
          key: 'guests-customize',
          label: 'Customize',
          href: `${base}/guests?gpanel=customize`,
          icon: SlidersHorizontal,
          matchPrefix: '__guests-customize__',
        },
        {
          key: 'guests-journey',
          label: 'Journey',
          href: `${base}/guests?gview=map`,
          icon: Route,
          matchPrefix: '__guests-journey__',
        },
      ],
    },
    {
      // 3 · Vendors — find → talk → sign → resolve. Disputes re-homed here.
      key: 'vendors',
      label: 'Vendors',
      defaultOpen: false,
      items: [
        {
          key: 'vendors',
          label: 'Explore',
          href: `${base}/vendors`,
          icon: Compass,
          matchPrefix: `${base}/vendors`,
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
          key: 'disputes',
          label: 'Disputes',
          href: `${base}/disputes`,
          icon: AlertTriangle,
          matchPrefix: `${base}/disputes`,
        },
      ],
    },
    {
      // 4 · Studio — the in-app services hub; design tools are its children.
      key: 'add-ons',
      label: 'Studio',
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
      // 5 · Budget — navigates (no children). Single-item section.
      key: 'budget',
      label: 'Budget',
      defaultOpen: false,
      items: [
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
      // 6 · Wedding — the event-day / logistics bucket. Find your date re-homed
      // here from the retired Settings group.
      key: 'wedding',
      label: 'Wedding',
      defaultOpen: false,
      items: [
        {
          key: 'find-date',
          label: 'Find your date',
          href: `${base}/find-date`,
          icon: CalendarSearch,
          matchPrefix: `${base}/find-date`,
        },
        {
          key: 'schedule',
          label: 'Schedule',
          href: `${base}/schedule`,
          icon: CalendarClock,
          matchPrefix: `${base}/schedule`,
        },
        {
          key: 'seating',
          label: 'Seating',
          href: `${base}/seating`,
          icon: LayoutGrid,
          matchPrefix: `${base}/seating`,
        },
        {
          key: 'event-qr',
          label: 'Event QR',
          href: `${base}/event-qr`,
          icon: QrCode,
          matchPrefix: `${base}/event-qr`,
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
  ];
}
