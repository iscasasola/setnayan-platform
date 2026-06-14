'use client';

/**
 * CustomerBottomNav — customer mobile primary nav.
 *
 * SIX FIXED MENUS · ACCORDION (0021 ADDENDUM · owner-locked 2026-06-15):
 *   1. Home    — navigates to the event hub (no children).
 *   2. Guests  — Summary · Search · Add · Customize · Journey
 *   3. Vendors — Explore · Messages · Contracts · Disputes
 *   4. Studio  — Website · Mood Board · Monogram
 *   5. Budget  — navigates (no children).
 *   6. Wedding — Find date · Schedule · Seating · Event QR · Live Wall
 *
 * A menu WITH children extracts an inline accordion on tap (the menu glides
 * to the far-left corner = back-hinge, its children cascade out); a menu
 * WITHOUT children navigates straight. NO "More" overflow, NO horizontal
 * scroll. Account/settings live under the profile avatar (top-right
 * ProfileMenu → Profile / Settings / Sign out · front door to iteration
 * 0025) — the nav no longer carries a Settings group.
 *
 * The shared <BottomNav> renders the accordion when given the `menus` prop
 * (this builder). The four locked motion knobs + the traveling pill +
 * press-light + icon-grow are reused verbatim from the canonical primitive
 * (project_setnayan_bottom_nav_canonical). Vendor + admin doorways keep the
 * flat `items` path unchanged (customer-first rollout · spec §8).
 *
 * ROUTE MAPPING (real routes vs. parent-route fallbacks):
 *   Home      → /dashboard/{id}                              (real · navigates)
 *   Guests    → /dashboard/{id}/guests                       (real · expands)
 *     · Summary   → /guests                                  (real · parent page)
 *     · Search    → /guests?gpanel=search                    (fallback · parent + query)
 *     · Add       → /guests/new                              (real)
 *     · Customize → /guests?gpanel=customize                 (fallback · parent + query)
 *     · Journey   → /guests?gview=map                        (real · page reads gview)
 *   Vendors   → /dashboard/{id}/vendors                      (real · expands)
 *     · Explore   → /vendors                                 (real)
 *     · Messages  → /messages                                (real)
 *     · Contracts → /contracts                               (real)
 *     · Disputes  → /disputes                                (real)
 *   Studio    → /dashboard/{id}/add-ons                      (real · expands)
 *     · Website   → /site-editor/{id}                        (real)
 *     · Mood Board→ /add-ons/mood-board                      (real)
 *     · Monogram  → /monogram                                (real)
 *   Budget    → /dashboard/{id}/budget                       (real · navigates)
 *   Wedding   → (no own route · anchors the accordion)       (expands)
 *     · Find date → /find-date                               (real)
 *     · Schedule  → /schedule                                (real)
 *     · Seating   → /seating                                 (real)
 *     · Event QR  → /event-qr                                (real)
 *     · Live Wall → /live                                    (real)
 *
 * The Guests Search/Customize children resolve to the /guests page with a
 * `?gpanel=` query (the MobileGuestCarousel's panels are local state today,
 * so the query is an accepted fallback — the link is valid + never 404s; a
 * follow-up can teach the carousel to read it). Every other child is a real
 * first-class route.
 *
 * CLIENT BOUNDARY: 'use client' required because BottomNavMenu[] carries
 * LucideIcon refs (forwardRef objects) — passing them from a Server Component
 * to the Client BottomNav trips Next.js serialization.
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
import { BottomNav } from '@/app/_components/nav/bottom-nav';
import type { BottomNavMenu } from '@/app/_components/nav/types';

/**
 * Builds the 6-menu accordion config for the given eventId. The single source
 * of truth for the customer mobile bar; the desktop sidebar consumes the same
 * destination model via buildCustomerNavGroups (customer-nav-config.ts).
 */
export function buildCustomerNavMenus(eventId: string): BottomNavMenu[] {
  const base = `/dashboard/${eventId}`;

  return [
    {
      // 1 · Home — navigates. Exact-match so every other event route (all
      // share the `${base}/` prefix) doesn't keep Home perpetually lit.
      key: 'home',
      label: 'Home',
      href: base,
      icon: Home,
      activeMatch: base,
      activeMatchExact: true,
    },
    {
      // 2 · Guests — extracts the lifecycle accordion. The menu's own route
      // (/guests) is the Summary landing.
      key: 'guests',
      label: 'Guests',
      href: `${base}/guests`,
      icon: Users,
      activeMatch: [`${base}/guests`, `${base}/sponsors`, `${base}/hosts`],
      children: [
        {
          key: 'guests-summary',
          label: 'Summary',
          href: `${base}/guests`,
          icon: LayoutDashboard,
          // Exact — every other guests sub-route shares the /guests prefix.
          activeMatch: `${base}/guests`,
          activeMatchExact: true,
        },
        {
          key: 'guests-search',
          label: 'Search',
          href: `${base}/guests?gpanel=search`,
          icon: Search,
          activeMatch: `${base}/guests`,
          activeMatchExact: true,
        },
        {
          key: 'guests-add',
          label: 'Add',
          href: `${base}/guests/new`,
          icon: UserPlus,
          activeMatch: `${base}/guests/new`,
        },
        {
          key: 'guests-customize',
          label: 'Customize',
          href: `${base}/guests?gpanel=customize`,
          icon: SlidersHorizontal,
          activeMatch: `${base}/guests`,
          activeMatchExact: true,
        },
        {
          key: 'guests-journey',
          label: 'Journey',
          href: `${base}/guests?gview=map`,
          icon: Route,
          activeMatch: `${base}/guests`,
          activeMatchExact: true,
        },
      ],
    },
    {
      // 3 · Vendors — find → talk → sign → resolve. The menu's own route is
      // the marketplace (Explore).
      key: 'vendors',
      label: 'Vendors',
      href: `${base}/vendors`,
      icon: Compass,
      activeMatch: [
        `${base}/vendors`,
        `${base}/messages`,
        `${base}/contracts`,
        `${base}/disputes`,
      ],
      children: [
        {
          key: 'vendors-explore',
          label: 'Explore',
          href: `${base}/vendors`,
          icon: Compass,
          activeMatch: `${base}/vendors`,
        },
        {
          key: 'vendors-messages',
          label: 'Messages',
          href: `${base}/messages`,
          icon: MessageSquare,
          activeMatch: `${base}/messages`,
        },
        {
          key: 'vendors-contracts',
          label: 'Contracts',
          href: `${base}/contracts`,
          icon: FileText,
          activeMatch: `${base}/contracts`,
        },
        {
          key: 'vendors-disputes',
          label: 'Disputes',
          href: `${base}/disputes`,
          icon: AlertTriangle,
          activeMatch: `${base}/disputes`,
        },
      ],
    },
    {
      // 4 · Studio — the in-app services hub; the design tools are its
      // children. The menu's own route (/add-ons) is the services grid.
      key: 'add-ons',
      label: 'Studio',
      href: `${base}/add-ons`,
      icon: Sparkles,
      activeMatch: [
        `${base}/add-ons`,
        `/site-editor/${eventId}`,
        `${base}/website`,
        `${base}/invitation`,
        `${base}/monogram`,
      ],
      children: [
        {
          key: 'studio-website',
          label: 'Website',
          href: `/site-editor/${eventId}`,
          icon: Globe,
          activeMatch: [
            `/site-editor/${eventId}`,
            `${base}/website`,
            `${base}/invitation`,
          ],
        },
        {
          key: 'studio-moodboard',
          label: 'Mood Board',
          href: `${base}/add-ons/mood-board`,
          icon: Palette,
          activeMatch: `${base}/add-ons/mood-board`,
        },
        {
          key: 'studio-monogram',
          label: 'Monogram',
          href: `${base}/monogram`,
          icon: Type,
          activeMatch: `${base}/monogram`,
        },
      ],
    },
    {
      // 5 · Budget — navigates (no children).
      key: 'budget',
      label: 'Budget',
      href: `${base}/budget`,
      icon: Wallet,
      activeMatch: [`${base}/budget`, `${base}/orders`, '/receipts'],
    },
    {
      // 6 · Wedding — the event-day / logistics bucket. No own route — tapping
      // extracts the accordion; the active highlight is driven by the children.
      key: 'wedding',
      label: 'Wedding',
      // href is a fallback only (a menu with children opens the section). Point
      // it at the first child so a non-JS / keyboard fallback still resolves.
      href: `${base}/find-date`,
      icon: Heart,
      activeMatch: [
        `${base}/find-date`,
        `${base}/schedule`,
        `${base}/seating`,
        `${base}/event-qr`,
        `${base}/live`,
      ],
      children: [
        {
          key: 'wedding-finddate',
          label: 'Find date',
          href: `${base}/find-date`,
          icon: CalendarSearch,
          activeMatch: `${base}/find-date`,
        },
        {
          key: 'wedding-schedule',
          label: 'Schedule',
          href: `${base}/schedule`,
          icon: CalendarClock,
          activeMatch: `${base}/schedule`,
        },
        {
          key: 'wedding-seating',
          label: 'Seating',
          href: `${base}/seating`,
          icon: LayoutGrid,
          activeMatch: `${base}/seating`,
        },
        {
          key: 'wedding-eventqr',
          label: 'Event QR',
          href: `${base}/event-qr`,
          icon: QrCode,
          activeMatch: `${base}/event-qr`,
        },
        {
          key: 'wedding-livewall',
          label: 'Live Wall',
          href: `${base}/live`,
          icon: MonitorPlay,
          activeMatch: `${base}/live`,
        },
      ],
    },
  ];
}

/**
 * CustomerBottomNav — wraps the shared BottomNav primitive with the
 * customer-doorway 6-menu accordion config. Renders nothing on lg+ (the
 * sidebar takes over). Per [[feedback_setnayan_orphan_prevention]] every
 * menu/child destination route exists (or resolves to a valid parent route
 * with a query fallback — see the builder header).
 *
 * The global nav shows on EVERY customer surface (owner directive
 * 2026-06-13 "global nav everywhere").
 */
export function CustomerBottomNav({ eventId }: { eventId: string }) {
  return <BottomNav menus={buildCustomerNavMenus(eventId)} />;
}
