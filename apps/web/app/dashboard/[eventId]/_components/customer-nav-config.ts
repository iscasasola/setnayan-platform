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
  Home,
  Users,
  LayoutGrid,
  CalendarClock,
  Compass,
  CalendarSearch,
  Wallet,
  MessageSquare,
  FileText,
  Globe,
  MonitorPlay,
  Sparkles,
  Palette,
  Type,
  Activity,
  Shield,
  QrCode,
  UserPlus,
  User,
  SlidersHorizontal,
  Aperture,
} from 'lucide-react';
import type { NavGroup } from '@/app/_components/nav/types';

/**
 * Builds the canonical customer NavGroup[] for the given eventId. Single source
 * of truth across:
 *   - Desktop sidebar (`customer-sidebar.tsx` · client · for active-state highlight)
 *   - Mobile /more landing (`more/page.tsx` · server · for the overflow grid)
 *
 * JOURNEY-GROUP IA (owner-locked REDESIGN_PLAN · 2026-06-14): the groups now
 * read as the couple's planning JOURNEY rather than verb buckets, and every
 * group past the top + Plan collapses by default so the long tail
 * (Book · Design · Day-of · After · Settings) stays out of the way until
 * the couple reaches that phase:
 *   0. (top · headerless-feeling "Setnayan") — Home · Studio · Alaala · Explore
 *   1. Plan      — Guests · Seating · Schedule · Budget
 *   2. Book      — Messages · Contracts                      (collapsed)
 *   3. Design    — Website · Mood Board · Monogram           (collapsed)
 *   4. Day-of    — Live Wall · Event QR                      (collapsed)
 *   5. After     — Activity · Disputes                       (collapsed)
 *   6. Settings  — Personalization · Hosts · Profile · Find your date (collapsed)
 *
 * Stable item `key` values are PRESERVED across the relabel/regroup so the
 * per-section `setnayan.nav.section.<key>.open` localStorage state and any
 * per-item state survive. Only labels, group membership, two icons
 * (Explore→Compass), and one matchPrefix (Activity) changed. Routes are
 * UNCHANGED — Services→Explore and Add-ons→Studio are pure relabels.
 */
export function buildCustomerNavGroups(eventId: string): NavGroup[] {
  const base = `/dashboard/${eventId}`;

  return [
    {
      // Top group — the three always-relevant anchors. Short "Setnayan"
      // heading (SidebarSection always renders a heading row, so an empty
      // label would leave a bare clickable chevron bar — a brand label
      // reads cleaner than an empty one).
      key: 'main',
      label: 'Setnayan',
      defaultOpen: true,
      items: [
        {
          // Home — the event hub. Sentinel matchPrefix so the strict-prefix
          // branch never fires — only the exact-equality branch keeps Home
          // lit (every other event route shares the `${base}/` prefix;
          // CLAUDE.md 2026-05-22 PR #311 documents the prefix-vs-exact trap).
          key: 'home',
          label: 'Home',
          href: base,
          icon: Home,
          matchPrefix: '__home__',
        },
        {
          // Studio — the in-app Setnayan services hub (Papic · Panood ·
          // Save-the-Date · etc.). Relabeled from "Add-ons" 2026-06-14;
          // key + route (/add-ons) unchanged. /add-ons/mood-board has its
          // own Design entry — accepted dual-highlight (Studio's prefix is
          // also a prefix of mood-board's path), mirrors the admin Payment
          // methods dual-bucket precedent.
          key: 'add-ons',
          label: 'Studio',
          href: `${base}/add-ons`,
          icon: Sparkles,
          matchPrefix: `${base}/add-ons`,
        },
        {
          // Alaala — the living-memory hub (Lane 2 of the Alaala embed,
          // owner 2026-06-15). The narrative "story" view of the memory pillar
          // that the Studio "store" sells into (the arc of the day: opening →
          // moment → people → stories → look & sound → kept forever). Placed in
          // the top anchor group for prominence per the "winning piece"
          // directive — surfaced for owner review (top group was 3 anchors).
          key: 'alaala',
          label: 'Alaala',
          href: `${base}/alaala`,
          icon: Aperture,
          matchPrefix: `${base}/alaala`,
        },
        {
          // Explore — the vendor marketplace. Relabeled from "Services"
          // 2026-06-14 (the couple browses + discovers vendors here);
          // key 'vendors' + route /vendors unchanged. Icon swapped
          // Briefcase→Compass to read as discovery, not management.
          key: 'vendors',
          label: 'Explore',
          href: `${base}/vendors`,
          icon: Compass,
          matchPrefix: `${base}/vendors`,
        },
      ],
    },
    {
      key: 'plan',
      label: 'Plan',
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
          // Budget — moved into Plan from the retired "Spend" group
          // 2026-06-14 (the couple budgets as part of planning). key + href
          // + icon unchanged. Orders + Receipts stay retired-from-sidebar
          // (reachable via order-confirmation emails + Studio + Budget).
          key: 'budget',
          label: 'Budget',
          href: `${base}/budget`,
          icon: Wallet,
        },
      ],
    },
    {
      key: 'book',
      label: 'Book',
      // Collapse-by-default: the couple reaches booking after they've
      // shortlisted in Explore — keep it tidy until then.
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
      key: 'design',
      label: 'Design',
      defaultOpen: false,
      items: [
        {
          key: 'website',
          // The "Website" doorway opens the full-screen Reels editor
          // (/site-editor) directly. The journey scroll at /website is
          // retired (redirects to the editor).
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
          // Standalone Monogram Maker — a returnable home to craft the
          // wedding monogram. Reachable here + via the Studio "Monogram
          // Creator" card; mobile surfaces it under the More tab.
          key: 'monogram',
          label: 'Monogram',
          href: `${base}/monogram`,
          icon: Type,
          matchPrefix: `${base}/monogram`,
        },
      ],
    },
    {
      key: 'dayof',
      label: 'Day-of',
      defaultOpen: false,
      items: [
        {
          // Salamisim day-of console (0012 P3) — wall mode override, screen
          // codes, tile kill switch, FaceBlock posture, Kwento approvals.
          // Renders an add-on doorway when LIVE_WALL isn't owned, so it's
          // safe to show for every event.
          key: 'live',
          label: 'Live Wall',
          href: `${base}/live`,
          icon: MonitorPlay,
          matchPrefix: `${base}/live`,
        },
        {
          // Event QR — moved here from "After" 2026-06-14: crew scans the
          // master QR on arrival day-of to register their capture device.
          // key + href unchanged.
          key: 'event-qr',
          label: 'Event QR',
          href: `${base}/event-qr`,
          icon: QrCode,
        },
      ],
    },
    {
      key: 'after',
      label: 'After',
      defaultOpen: false,
      items: [
        {
          key: 'activity',
          label: 'Activity',
          href: `${base}/activity`,
          icon: Activity,
          // Correctness fix 2026-06-14: without a matchPrefix the default
          // would be the bare href and sub-routes like /activity/[id] would
          // still light it (href IS a prefix), BUT making the umbrella
          // explicit documents the intent + keeps it consistent with every
          // other umbrella item. /activity and /activity/* both light up.
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
    {
      key: 'settings',
      label: 'Settings',
      // Low-traffic — collapse by default.
      defaultOpen: false,
      items: [
        {
          // Personalization — the curated onboarding record + match criteria.
          // Route stays /details (relabel-not-rename). Reached here in the
          // sidebar/More AND from the Home "Personalized" block.
          key: 'personalization',
          label: 'Personalization',
          href: `${base}/details`,
          icon: SlidersHorizontal,
          matchPrefix: `${base}/details`,
        },
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
        {
          // Find your date — demoted from Plan to Settings 2026-06-14 so it
          // stays reachable (NOT deleted). Its proper home is a future Home
          // card (out of scope here). key + href + icon unchanged.
          key: 'find-date',
          label: 'Find your date',
          href: `${base}/find-date`,
          icon: CalendarSearch,
          matchPrefix: `${base}/find-date`,
        },
      ],
    },
  ];
}
