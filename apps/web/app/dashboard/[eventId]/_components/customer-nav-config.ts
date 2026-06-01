/**
 * Customer NavGroup[] builder — v2.1 Navigation Phase 1 (customer doorway).
 *
 * WHY (canonical, do not collapse): this file extracts ONLY the `buildCustomerNavGroups`
 * function out of `customer-sidebar.tsx` (which has `'use client'` at the top because
 * it uses `usePathname` for active-state highlighting). The mobile overflow landing
 * at `apps/web/app/dashboard/[eventId]/more/page.tsx` is a Server Component (it uses
 * Next.js 15's `await params` + exports `metadata`). When a Server Component imports
 * an exported function from a `'use client'` module, the import becomes a CLIENT
 * REFERENCE — an opaque marker that React serializes through the RSC payload — NOT
 * the actual function. Calling that reference server-side either throws or returns
 * unresolvable client refs that the downstream `<CustomerMobileLanding>` (also a
 * Server Component) cannot render. Result: the page crashes into `error.tsx` with
 * the polite "Something on our end didn't work" surface (Sentry ref 19475950).
 *
 * Fix: extract the pure data builder (which uses zero client APIs — just lucide icon
 * refs + string concatenation + plain object construction) to this neutral module.
 * Both Server (`/more/page.tsx`) and Client (`customer-sidebar.tsx`) safely import
 * from here. Lucide icon refs are React component references — they render correctly
 * in BOTH server and client contexts; the boundary issue was the `'use client'` file
 * wrapping, not the icons themselves.
 *
 * Same class of crash as PR #614 (admin console crash · CLAUDE.md 2026-05-29 row
 * "2 pilot blockers diagnosed"): a wrapper module mixed Server-Component
 * serialization with Lucide forwardRef icons across the RSC boundary. There the fix
 * was adding `'use client'` to the wrapper (admin-bottom-nav.tsx). Here the fix is
 * the opposite direction — the consumer (`/more/page.tsx`) is intentionally a Server
 * Component (so it can read `params` + export `metadata`), so the BUILDER has to be
 * the non-client side.
 *
 * Pattern for future agents extending the nav: any builder function consumed by a
 * Server Component MUST live in a non-`'use client'` file. Builders consumed only
 * by client components can live in `'use client'` files. Builders consumed by both
 * (like this one) live in a neutral file like this one.
 *
 * NavGroup type is imported from `apps/web/app/_components/nav/types.ts` which is
 * already a neutral module (verified — no `'use client'` directive).
 */

import {
  Focus,
  Home,
  Users,
  LayoutGrid,
  CalendarClock,
  Briefcase,
  Wallet,
  ShoppingCart,
  Receipt,
  MessageSquare,
  FileText,
  Globe,
  Sparkles,
  Palette,
  Activity,
  Shield,
  QrCode,
  UserPlus,
  User,
} from 'lucide-react';
import type { NavGroup } from '@/app/_components/nav/types';

/**
 * Builds the canonical customer NavGroup[] for the given eventId. Single source
 * of truth across:
 *   - Desktop sidebar (`customer-sidebar.tsx` · client · for active-state highlight)
 *   - Mobile /more landing (`more/page.tsx` · server · for the overflow grid)
 *
 * Stable group/item `key` values mean future label edits don't reset
 * the per-section `setnayan.nav.section.<key>.open` localStorage state.
 */
export function buildCustomerNavGroups(eventId: string): NavGroup[] {
  const base = `/dashboard/${eventId}`;

  return [
    {
      key: 'today',
      label: 'Today',
      items: [
        {
          key: 'todays-focus',
          label: "Today's Focus",
          href: `${base}/today`,
          icon: Focus,
        },
        {
          key: 'home',
          label: 'Home',
          href: base,
          icon: Home,
          // Sentinel matchPrefix so the strict-prefix branch never fires.
          // Only the exact-equality branch keeps Home lit — same pattern
          // as bottom-nav.tsx Home tab (CLAUDE.md 2026-05-22 PR #311
          // documents the prefix-vs-exact trap).
          matchPrefix: '__home__',
        },
        {
          // For you — the personalized menu (taste + services). Owner
          // directive 2026-06-02 (lean-home + nav lock). Mirrors the
          // mobile bottom-nav "For you" tab so desktop has parity.
          // Sparkles matches the bottom-nav For-you icon.
          key: 'for-you',
          label: 'For you',
          href: `${base}/for-you`,
          icon: Sparkles,
          matchPrefix: `${base}/for-you`,
        },
      ],
    },
    {
      key: 'plan',
      label: 'Plan',
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
          key: 'vendors',
          label: 'Vendors',
          href: `${base}/vendors`,
          icon: Briefcase,
          matchPrefix: `${base}/vendors`,
        },
      ],
    },
    {
      key: 'spend',
      label: 'Spend',
      items: [
        {
          key: 'budget',
          label: 'Budget',
          href: `${base}/budget`,
          icon: Wallet,
        },
        // ORDERS + RECEIPTS retired from sidebar 2026-05-30 per owner
        // directive: "Orders and receipts should be gone?". V2 publisher
        // posture (CLAUDE.md 2026-05-28 V2 cutover) makes both surfaces
        // low-traffic for the 5-20 family-cohort pilot launching
        // 2026-06-01 — pilot couples won't be buying SKUs during the
        // small test window, so the sidebar entries were sitting empty.
        // The routes /dashboard/[eventId]/orders + /receipts STAY
        // reachable via:
        //   - order-confirmation emails (deep-link)
        //   - add-ons surface (per-order flow)
        //   - Budget page (financial overview)
        // Future revisit: post-pilot when SKU purchase volume justifies
        // dedicated nav surfaces, re-add to Spend section.
      ],
    },
    {
      key: 'communicate',
      label: 'Communicate',
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
      key: 'share',
      label: 'Share',
      items: [
        {
          key: 'website',
          label: 'Website',
          href: `${base}/website`,
          icon: Globe,
          matchPrefix: `${base}/website`,
        },
        {
          key: 'add-ons',
          label: 'Add-ons',
          href: `${base}/add-ons`,
          icon: Sparkles,
          // /add-ons/mood-board has its own dedicated sidebar entry so
          // we exclude it from the Add-ons match via matching against
          // the bare /add-ons prefix only. Both will end up lit when
          // viewing /add-ons/mood-board because Mood Board's href IS
          // a prefix of that path AND the Add-ons matchPrefix is too —
          // accepted dual-highlight, mirrors the admin Payment methods
          // dual-bucket precedent (Money + Settings groups).
          matchPrefix: `${base}/add-ons`,
        },
        {
          key: 'mood-board',
          label: 'Mood Board',
          href: `${base}/add-ons/mood-board`,
          icon: Palette,
          matchPrefix: `${base}/add-ons/mood-board`,
        },
      ],
    },
    {
      key: 'after',
      label: 'After',
      items: [
        {
          key: 'activity',
          label: 'Activity',
          href: `${base}/activity`,
          icon: Activity,
        },
        {
          key: 'disputes',
          label: 'Disputes',
          href: `${base}/disputes`,
          icon: Shield,
          matchPrefix: `${base}/disputes`,
        },
        {
          key: 'event-qr',
          label: 'Event QR',
          href: `${base}/event-qr`,
          icon: QrCode,
        },
      ],
    },
    {
      key: 'settings',
      label: 'Settings',
      // Low-traffic — collapse by default to keep the Share + After groups
      // closer to the fold without forcing a scroll on lg-medium viewports.
      defaultOpen: false,
      items: [
        {
          key: 'hosts',
          label: 'Hosts',
          href: `${base}/hosts`,
          icon: UserPlus,
          matchPrefix: `${base}/hosts`,
        },
        {
          key: 'profile',
          label: 'Profile',
          href: `/dashboard/profile`,
          icon: User,
          // Sentinel matchPrefix so the strict-prefix branch never fires;
          // /dashboard/profile/concierge (retired surface) should not
          // auto-light the top-level Profile entry. The Profile page
          // itself surfaces privacy controls inline (no separate route
          // exists in this codebase).
          matchPrefix: '__profile-exact__',
        },
      ],
    },
  ];
}
