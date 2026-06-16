'use client';

/**
 * AdminSidebar — admin doorway desktop nav (NavGroup[] source of truth).
 *
 * WHY: CLAUDE.md 2026-05-23 row 2 locks the admin console. Originally 8
 * categories (0023 § 1), remapped 2026-06-04 to 6 topic-groups, and re-cut
 * 2026-06-08 by the ops-shaped nav redesign
 * (Admin_Console_Nav_Redesign_2026-06-08.md · owner conditionally signed
 * off 2026-06-08). The console is now grouped by the VERB an admin performs
 * — act / find / tune — instead of by topic, because admin is a work-queue
 * ops console (≈95% of sessions are "clear a queue").
 *
 * This file owns the NavGroup[] array consumed by SidebarShell +
 * SidebarSection + SidebarItem from @/app/_components/nav/*. It is the
 * single source of truth for admin nav structure on desktop. The 4-item
 * mobile BottomNav lives in admin-bottom-nav.tsx alongside this file.
 *
 * 6 GROUPS — a 3-item spine (Home · Work · Directory) + 3 collapsible
 * tune-groups (Insights · Money & Catalog · Platform). Group KEYS are
 * deliberately preserved across the relabel so localStorage open-state
 * survives: key 'queues' now renders label "Work"; key 'money' renders
 * "Money & Catalog"; key 'funnels' renders "Insights"; key 'content'
 * renders "Platform".
 *   1. Home  (key 'home')      — Overview (/admin)
 *   2. Work  (key 'queues')    — every act-now queue: Verify · Payments ·
 *                   Payouts · Token sales · Payment options · Disputes ·
 *                   Force majeure · Reviews · AI abuse · Help. (Payouts +
 *                   Token sales pulled in from the dissolved Money group.)
 *   3. Directory (key 'directory') — Users · Vendors · Demo vendors ·
 *                   Events · Venues. (Wedding types + traditions moved to
 *                   Platform — governance + content, not look-up.)
 *   4. Insights (key 'funnels') — Growth · Funnels · Operations & Hiring ·
 *                   Telemetry · Connection logs · Offline daemon.
 *   5. Money & Catalog (key 'money') — config, NOT the act-now queues:
 *                   Pricing · Add-ons · Discount codes · Token bands ·
 *                   Budget Planner · Receipts · Payment methods. (Payouts +
 *                   Token sales moved to Work.)
 *   6. Platform (key 'content') — Settings · Taxonomy · Website · Ads ·
 *                   AI brain · Moodboard library · Songs · Wedding types ·
 *                   Wedding traditions · Notifications · Demo mode.
 *                   (Notifications gets a nav home — it was an orphan.)
 *
 * REQUIRED FOLLOW-UP (owner sign-off condition): the Work view's Money-lane
 * filter (Payments + Payouts + Token sales surfaced together) ships with the
 * Work master-detail PR, so finance keeps a one-stop money view after the
 * Money group dissolves. RBAC handler-lane scoping is a later, separate build.
 *
 * PAYMENT METHODS: canonical home is Money & Catalog (the data IS money —
 * vendor payouts + customer payment instructions both consume it). Not
 * duplicated into Platform/Settings.
 *
 * BRAND-LAYER RENAME 2026-05-28 V2 CUTOVER: Concierge abuse keeps its route
 * + DB table names (concierge_abuse_flags) for bookmark + audit continuity,
 * but the sidebar entry reads "Setnayan AI abuse" to match the V2 brand.
 */

import {
  Home,
  Banknote,
  Coins,
  BadgeCheck,
  CheckCheck,
  Compass,
  Shield,
  AlertOctagon,
  Star,
  LifeBuoy,
  Flag,
  MessageSquareWarning,
  Landmark,
  RefreshCw,
  UsersRound,
  Users,
  Briefcase,
  TestTube,
  CalendarDays,
  MapPin,
  Church,
  BookOpen,
  DollarSign,
  PiggyBank,
  Tag as TagIcon,
  Sparkles,
  Receipt,
  CreditCard,
  Brain,
  Palette,
  Shapes,
  Tag,
  Globe,
  Megaphone,
  Video,
  Music,
  TrendingUp,
  Bug,
  WifiOff,
  BarChart3,
  CircleUser,
  LineChart,
  Settings,
  Share2,
  Wallet,
  ShoppingBag,
  Bell,
  SlidersHorizontal,
  UserX,
  PartyPopper,
  Newspaper,
  Images,
  Radar,
} from 'lucide-react';
import { usePathname } from 'next/navigation';
import { Wordmark } from '@/app/_components/brand-marks';
import { SidebarSection } from '@/app/_components/nav/sidebar-section';
import { SidebarItem } from '@/app/_components/nav/sidebar-item';
import type { NavGroup } from '@/app/_components/nav/types';

/**
 * Canonical admin NavGroup[] export. Mobile-overflow landing pages at
 * /admin/work + /admin/directory + /admin/more present the same surfaces
 * for the 4-tab BottomNav (Home · Work · Directory · More).
 *
 * Stable group/item `key` values mean label edits (Queues→Work, Money→Money
 * & Catalog, etc.) don't reset the per-section
 * setnayan.nav.section.<key>.open localStorage state.
 */
export const ADMIN_NAV_GROUPS: NavGroup[] = [
  // ── SPINE ─────────────────────────────────────────────────────────────
  {
    key: 'home',
    label: 'Home',
    items: [
      {
        key: 'overview',
        label: 'Overview',
        href: '/admin',
        icon: Home,
      },
    ],
  },
  {
    // WORK (key 'queues' kept for localStorage continuity) — every act-now
    // surface in one group. Absorbs Payouts + Token sales from the dissolved
    // Money group. (Two-admin Approvals + Taxonomy-requests join here once
    // their dedicated surfaces ship — orphan-prevention until then.)
    key: 'queues',
    label: 'Work',
    items: [
      {
        key: 'verify',
        label: 'Verify',
        href: '/admin/verify',
        icon: BadgeCheck,
        matchPrefix: '/admin/verify',
      },
      {
        key: 'payments',
        label: 'Payments',
        href: '/admin/payments',
        icon: Banknote,
        matchPrefix: '/admin/payments',
      },
      {
        // Money queue — vendor payout release (was in Money group).
        key: 'payouts',
        label: 'Payouts',
        href: '/admin/payouts',
        icon: Wallet,
      },
      {
        // Money queue — vendor token-pack purchase reconcile (was in Money).
        key: 'token-purchases',
        label: 'Token sales',
        href: '/admin/token-purchases',
        icon: ShoppingBag,
        matchPrefix: '/admin/token-purchases',
      },
      {
        // Money queue — vendor Pro/Enterprise subscription reconcile (Phase D).
        key: 'subscriptions',
        label: 'Subscriptions',
        href: '/admin/subscriptions',
        icon: RefreshCw,
        matchPrefix: '/admin/subscriptions',
      },
      {
        key: 'payment-options',
        label: 'Payment options',
        href: '/admin/payment-options',
        icon: CreditCard,
        matchPrefix: '/admin/payment-options',
      },
      {
        key: 'disputes',
        label: 'Disputes',
        href: '/admin/disputes',
        icon: Shield,
        matchPrefix: '/admin/disputes',
      },
      {
        key: 'pax-changes',
        label: 'Pax changes',
        href: '/admin/pax-changes',
        icon: UsersRound,
        matchPrefix: '/admin/pax-changes',
      },
      {
        key: 'force-majeure',
        label: 'Force majeure',
        href: '/admin/force-majeure',
        icon: AlertOctagon,
        matchPrefix: '/admin/force-majeure',
      },
      {
        key: 'reviews',
        label: 'Reviews',
        href: '/admin/reviews',
        icon: Star,
      },
      {
        key: 'concierge-abuse',
        label: "Setnayan AI abuse",
        href: '/admin/concierge-abuse',
        icon: Flag,
      },
      {
        // Self-serve account-deletion request queue (App Store 5.1.1(v) /
        // Google Play data-deletion). Couples + vendors file deletion requests
        // from Profile → Privacy & data; an admin approves (runs the existing
        // hard-delete / blacklist) or rejects within 24h.
        key: 'account-deletions',
        label: 'Account deletions',
        href: '/admin/account-deletions',
        icon: UserX,
        matchPrefix: '/admin/account-deletions',
      },
      {
        // UGC report queue (Apple 1.2 / Google Play UGC). Reports filed against
        // Papic guest gallery content land here for moderator review.
        key: 'user-reports',
        label: 'User reports',
        href: '/admin/user-reports',
        icon: MessageSquareWarning,
        matchPrefix: '/admin/user-reports',
      },
      {
        // Two-admin (four-eyes) approval queue — §9.1. A different admin
        // approves a major decision before it executes.
        key: 'approvals',
        label: 'Approvals',
        href: '/admin/approvals',
        icon: CheckCheck,
      },
      {
        // Social Sharing & Featuring Program queue (2026-06-12) — ready-to-
        // post couple creations + vendor verification features + take-downs.
        key: 'social-queue',
        label: 'Social queue',
        href: '/admin/social-queue',
        icon: Share2,
        matchPrefix: '/admin/social-queue',
      },
      {
        // Pakanta songwriting queue — each couple's custom-song brief, auto-
        // composed from their onboarding love story + Pakanta music prefs
        // (lib/pakanta-brief.ts). The music team writes the song from it.
        key: 'pakanta',
        label: 'Pakanta queue',
        href: '/admin/pakanta',
        icon: Music,
        matchPrefix: '/admin/pakanta',
      },
      {
        key: 'help',
        label: 'Help',
        href: '/admin/help',
        icon: LifeBuoy,
      },
    ],
  },
  {
    // DIRECTORY — pure record-lookup. Wedding types + traditions moved out to
    // Platform (governance + content, not look-up) per the redesign A.4.
    key: 'directory',
    label: 'Directory',
    items: [
      {
        key: 'users',
        label: 'Users',
        href: '/admin/users',
        icon: Users,
      },
      {
        key: 'vendors',
        label: 'Vendors',
        href: '/admin/vendors',
        icon: Briefcase,
        matchPrefix: '/admin/vendors',
      },
      {
        key: 'demo-vendors',
        label: 'Demo vendors',
        href: '/admin/demo-vendors',
        icon: TestTube,
        matchPrefix: '/admin/demo-vendors',
      },
      {
        key: 'events',
        label: 'Events',
        href: '/admin/events',
        icon: CalendarDays,
        matchPrefix: '/admin/events',
      },
      {
        key: 'venues',
        label: 'Venues',
        href: '/admin/venues',
        icon: MapPin,
        matchPrefix: '/admin/venues',
      },
    ],
  },
  // ── TUNE GROUPS (collapsible) ─────────────────────────────────────────
  {
    key: 'funnels',
    label: 'Insights',
    defaultOpen: false,
    items: [
      {
        key: 'growth',
        label: 'Growth',
        href: '/admin/growth',
        icon: LineChart,
        matchPrefix: '/admin/growth',
      },
      {
        key: 'intelligence',
        label: 'Intelligence',
        href: '/admin/intelligence',
        icon: Radar,
        matchPrefix: '/admin/intelligence',
      },
      {
        key: 'funnels',
        label: 'Funnels',
        href: '/admin/funnels',
        icon: BarChart3,
      },
      {
        key: 'operations-hiring',
        label: 'Operations & Hiring',
        href: '/admin/operations-hiring',
        icon: TrendingUp,
      },
      {
        key: 'connection-logs',
        label: 'Connection logs',
        href: '/admin/connection-logs',
        icon: Bug,
      },
      {
        key: 'offline',
        label: 'Offline daemon',
        href: '/admin/offline',
        icon: WifiOff,
      },
    ],
  },
  {
    // MONEY & CATALOG (key 'money') — config + records, NOT the act-now money
    // queues (Payments/Payouts/Token sales moved to Work). The Work Money-lane
    // filter reunites them in one view per the sign-off condition.
    key: 'money',
    label: 'Money & Catalog',
    defaultOpen: false,
    items: [
      {
        key: 'pricing',
        label: 'Pricing',
        href: '/admin/pricing',
        icon: DollarSign,
      },
      {
        key: 'addons',
        label: 'Add-ons',
        href: '/admin/addons',
        icon: Sparkles,
      },
      {
        key: 'discount-codes',
        label: 'Discount codes',
        href: '/admin/discount-codes',
        icon: TagIcon,
        matchPrefix: '/admin/discount-codes',
      },
      {
        key: 'token-bands',
        label: 'Token bands',
        href: '/admin/token-bands',
        icon: Coins,
      },
      {
        key: 'budget-planner',
        label: 'Budget Planner',
        href: '/admin/budget-planner',
        icon: PiggyBank,
      },
      {
        key: 'receipts',
        label: 'Receipts',
        href: '/admin/receipts',
        icon: Receipt,
      },
      {
        key: 'payment-methods',
        label: 'Payment methods',
        href: '/admin/settings/payment-methods',
        icon: Landmark,
      },
    ],
  },
  {
    // PLATFORM (key 'content') — config, content & security. Absorbs Wedding
    // types + traditions (governance + content) and gives Notifications a nav
    // home (it was an orphan — no nav entry on origin/main).
    key: 'content',
    label: 'Platform',
    defaultOpen: false,
    items: [
      {
        key: 'settings',
        label: 'Settings',
        href: '/admin/settings',
        icon: Settings,
        // /admin/settings/payment-methods lives under Money & Catalog —
        // exclude it so that entry stays lit when viewing payment methods.
        matchPrefix: '/admin/settings',
      },
      {
        // Nav/icon/menu registry — the single source for the name + icon of
        // every menu across all account types (foundation 2026-06-16).
        key: 'menus',
        label: 'Menus & icons',
        href: '/admin/menus',
        icon: Shapes,
      },
      {
        // Onboarding-flow config (background music + future per-flow knobs),
        // grouped by onboarding type. Scales as new event-type onboardings ship.
        key: 'onboarding',
        label: 'Onboarding',
        href: '/admin/onboarding',
        icon: Compass,
      },
      {
        key: 'taxonomy',
        label: 'Taxonomy',
        href: '/admin/taxonomy',
        icon: Tag,
      },
      {
        // Event-type roster CRUD (2026-06-13 cutover) — create/launch/retire
        // event types; pickers + vendor checkboxes + filters follow live.
        key: 'event-types',
        label: 'Event Types',
        href: '/admin/event-types',
        icon: PartyPopper,
      },
      {
        key: 'refinements',
        label: 'Refinements',
        href: '/admin/refinements',
        icon: SlidersHorizontal,
      },
      {
        key: 'website',
        label: 'Website',
        href: '/admin/website',
        icon: Globe,
      },
      {
        key: 'hero-video',
        label: 'Hero video',
        href: '/admin/hero-video',
        icon: Video,
      },
      {
        // Real Stories featuring (PR D) — pin + order which consented wedding
        // editorials surface (and which is the hero) on the public /realstories
        // index. Curation on top of the RA 10173 consent gate.
        key: 'real-stories',
        label: 'Real Stories',
        href: '/admin/real-stories',
        icon: Newspaper,
        matchPrefix: '/admin/real-stories',
      },
      {
        // Auto-Recap oversight — every couple-published "living recap" (a
        // public page of guest photos + words) + the RA 10173 takedown lever.
        key: 'recaps',
        label: 'Recaps',
        href: '/admin/recaps',
        icon: Images,
        matchPrefix: '/admin/recaps',
      },
      {
        key: 'ads',
        label: 'Ads',
        href: '/admin/ads',
        icon: Megaphone,
      },
      {
        key: 'brain',
        label: "Setnayan AI brain",
        href: '/admin/brain',
        icon: Brain,
      },
      {
        key: 'moodboard-library',
        label: 'Moodboard library',
        href: '/admin/moodboard-library',
        icon: Palette,
      },
      {
        key: 'songs',
        label: 'Songs',
        href: '/admin/songs',
        icon: Music,
        matchPrefix: '/admin/songs',
      },
      {
        key: 'wedding-types',
        label: 'Wedding types',
        href: '/admin/wedding-types',
        icon: Church,
      },
      {
        key: 'wedding-traditions',
        label: 'Wedding traditions',
        href: '/admin/wedding-traditions',
        icon: BookOpen,
      },
      {
        key: 'notifications',
        label: 'Notifications',
        href: '/admin/notifications',
        icon: Bell,
      },
      {
        key: 'demo-mode',
        label: 'Demo mode',
        href: '/admin/settings/demo-mode',
        icon: Settings,
      },
      {
        // Personal account security — admins use the shared /dashboard/profile
        // surface (the /dashboard layout only redirects vendors). Without this
        // entry the admin doorway had NO path to change-password / sign-out-
        // other-devices except detouring through the customer role pill.
        // Account-security suite 2026-06-11.
        key: 'my-account',
        label: 'My account',
        href: '/dashboard/profile',
        icon: CircleUser,
      },
    ],
  },
];

/**
 * AdminSidebar — renders the 6 admin nav groups using the shared
 * SidebarSection + SidebarItem primitives. Wraps with a brand header
 * (Wordmark) so the admin doorway reads as a separate context from
 * customer + vendor doorways.
 */
export function AdminSidebar() {
  const pathname = usePathname() ?? '/admin';

  return (
    <>
      {/* Brand header — sits inside the sidebar's scrollable section so it
          scrolls with the nav rather than being pinned. Matches the v2.1
          editorial register: Wordmark + 'Setnayan HQ' eyebrow in m-label-mono. */}
      <header className="px-4 pb-4 pt-2 [[data-sidebar-collapsed='1']_&]:hidden">
        <Wordmark className="text-ink" />
        <p
          className="m-label-mono mt-2"
          style={{ color: 'var(--m-slate-2)' }}
        >
          Setnayan HQ
        </p>
      </header>

      {ADMIN_NAV_GROUPS.map((group) => (
        <SidebarSection key={group.key} group={group} pathname={pathname}>
          {group.items.map((item) => (
            <SidebarItem key={item.key} item={item} pathname={pathname} />
          ))}
        </SidebarSection>
      ))}
    </>
  );
}
