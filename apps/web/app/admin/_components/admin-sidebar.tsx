'use client';

/**
 * AdminSidebar — admin doorway desktop nav (NavGroup[] source of truth).
 *
 * 2026-06-18 RECLUSTER — reorganised from the prior ops-verb grouping
 * (Home · Work · Directory · Insights · Money & Catalog · Platform) into
 * 6 topic-clusters that match how the admin team mentally organises their
 * work:
 *
 *   1. Accounts     (key 'accounts')    — every record and action scoped to
 *                   an account: directory (users/vendors/events/venues) +
 *                   account-level queues (verify/pax/partnerships/reviews/
 *                   deletions/abuse/reports/completions/papic-sampler).
 *
 *   2. Transactions (key 'transactions') — all money movement and related
 *                   queues: payments · payouts · token sales · subscriptions ·
 *                   payment options · disputes · force majeure · approvals ·
 *                   help · receipts · payment methods.
 *
 *   3. Services     (key 'services')    — what Setnayan sells and how it is
 *                   priced/configured: pricing · add-ons · token bands ·
 *                   discount codes · budget planner · Pakanta queue · ads ·
 *                   AI brain.
 *
 *   4. Content      (key 'content')     — everything the public sees: website ·
 *                   hero video · Reveal Studio · Real Stories · recaps ·
 *                   social queue · songs · moodboard library · notifications.
 *
 *   5. Platform     (key 'platform')    — how the system is configured: settings ·
 *                   menus & icons · taxonomy · event types · wedding types ·
 *                   wedding traditions · refinements · onboarding · demo vendors ·
 *                   demo mode.
 *
 *   6. Intelligence (key 'intelligence') — analytics + ops health: overview ·
 *                   growth · funnels · intelligence · operations & hiring ·
 *                   connection logs · offline daemon · my account.
 *
 * MOBILE vs DESKTOP: the 6 groups map 1-to-1 to the 6 bottom-nav tabs
 * (admin-bottom-nav.tsx). Groups added beyond these 6 in the future will
 * appear in this sidebar only — the mobile bottom nav stays fixed at 6.
 *
 * STABLE KEYS: group + item key values are intentionally new (prior keys
 * like 'queues', 'money', 'funnels', 'content' are retired). localStorage
 * open-state resets once on deploy; that is acceptable for a full recluster.
 *
 * SETTINGS / PAYMENT-METHODS OVERLAP: /admin/settings/payment-methods lives
 * in Transactions (the data is money). Settings in Platform has matchPrefix
 * '/admin/settings' which also matches this sub-path — both items light up
 * simultaneously when viewing payment-methods. Known; acceptable until a
 * dedicated payment-methods route is created.
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
  Handshake,
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
  Camera,
} from 'lucide-react';
import { usePathname } from 'next/navigation';
import { Wordmark } from '@/app/_components/brand-marks';
import { SidebarSection } from '@/app/_components/nav/sidebar-section';
import { SidebarItem } from '@/app/_components/nav/sidebar-item';
import { navIconComponent } from '@/app/_components/nav/nav-icon-component';
import type { NavGroup } from '@/app/_components/nav/types';
import type { NavSlotLite } from '@/lib/nav-registry-types';

export const ADMIN_NAV_GROUPS: NavGroup[] = [
  // ── 1. ACCOUNTS ──────────────────────────────────────────────────────────
  // Directory records + every queue that acts on an account.
  {
    key: 'accounts',
    label: 'Accounts',
    items: [
      { key: 'users',               label: 'Users',               href: '/admin/users',                icon: Users },
      { key: 'vendors',             label: 'Vendors',             href: '/admin/vendors',              icon: Briefcase,          matchPrefix: '/admin/vendors' },
      { key: 'events',              label: 'Events',              href: '/admin/events',               icon: CalendarDays,       matchPrefix: '/admin/events' },
      { key: 'venues',              label: 'Venues',              href: '/admin/venues',               icon: MapPin,             matchPrefix: '/admin/venues' },
      { key: 'verify',              label: 'Verify',              href: '/admin/verify',               icon: BadgeCheck,         matchPrefix: '/admin/verify' },
      { key: 'vendor-partnerships', label: 'Partnerships',        href: '/admin/vendor-partnerships',  icon: Handshake,          matchPrefix: '/admin/vendor-partnerships' },
      { key: 'pax-changes',         label: 'Pax changes',         href: '/admin/pax-changes',          icon: UsersRound,         matchPrefix: '/admin/pax-changes' },
      { key: 'completions',         label: 'Completions',         href: '/admin/completions',          icon: Handshake,          matchPrefix: '/admin/completions' },
      { key: 'reviews',             label: 'Reviews',             href: '/admin/reviews',              icon: Star },
      { key: 'account-deletions',   label: 'Account deletions',   href: '/admin/account-deletions',    icon: UserX,              matchPrefix: '/admin/account-deletions' },
      { key: 'concierge-abuse',     label: 'Setnayan AI abuse',   href: '/admin/concierge-abuse',      icon: Flag },
      { key: 'user-reports',        label: 'User reports',        href: '/admin/user-reports',         icon: MessageSquareWarning, matchPrefix: '/admin/user-reports' },
      { key: 'papic-sampler',       label: 'Papic sampler',       href: '/admin/papic-sampler',        icon: Camera },
    ],
  },

  // ── 2. TRANSACTIONS ──────────────────────────────────────────────────────
  // All money movement (act-now queues) + static financial config.
  {
    key: 'transactions',
    label: 'Transactions',
    items: [
      { key: 'payments',        label: 'Payments',        href: '/admin/payments',                  icon: Banknote,   matchPrefix: '/admin/payments' },
      { key: 'payouts',         label: 'Payouts',         href: '/admin/payouts',                   icon: Wallet },
      { key: 'token-purchases', label: 'Token sales',     href: '/admin/token-purchases',           icon: ShoppingBag, matchPrefix: '/admin/token-purchases' },
      { key: 'subscriptions',   label: 'Subscriptions',   href: '/admin/subscriptions',             icon: RefreshCw,  matchPrefix: '/admin/subscriptions' },
      { key: 'payment-options', label: 'Payment options', href: '/admin/payment-options',           icon: CreditCard, matchPrefix: '/admin/payment-options' },
      { key: 'disputes',        label: 'Disputes',        href: '/admin/disputes',                  icon: Shield,     matchPrefix: '/admin/disputes' },
      { key: 'force-majeure',   label: 'Force majeure',   href: '/admin/force-majeure',             icon: AlertOctagon, matchPrefix: '/admin/force-majeure' },
      { key: 'approvals',       label: 'Approvals',       href: '/admin/approvals',                 icon: CheckCheck },
      { key: 'help',            label: 'Help',            href: '/admin/help',                      icon: LifeBuoy },
      { key: 'receipts',        label: 'Receipts',        href: '/admin/receipts',                  icon: Receipt },
      // href is under /admin/settings but belongs conceptually to Transactions.
      { key: 'payment-methods', label: 'Payment methods', href: '/admin/settings/payment-methods',  icon: Landmark },
    ],
  },

  // ── 3. SERVICES ──────────────────────────────────────────────────────────
  // What Setnayan sells and how it is priced / operated.
  {
    key: 'services',
    label: 'Services',
    defaultOpen: false,
    items: [
      { key: 'pricing',        label: 'Pricing',           href: '/admin/pricing',         icon: DollarSign },
      { key: 'addons',         label: 'Add-ons',           href: '/admin/addons',          icon: Sparkles },
      { key: 'token-bands',    label: 'Token bands',       href: '/admin/token-bands',     icon: Coins },
      { key: 'discount-codes', label: 'Discount codes',    href: '/admin/discount-codes',  icon: TagIcon,  matchPrefix: '/admin/discount-codes' },
      { key: 'budget-planner', label: 'Budget Planner',    href: '/admin/budget-planner',  icon: PiggyBank },
      { key: 'pakanta',        label: 'Pakanta queue',     href: '/admin/pakanta',         icon: Music,    matchPrefix: '/admin/pakanta' },
      { key: 'ads',            label: 'Ads',               href: '/admin/ads',             icon: Megaphone },
      { key: 'brain',          label: 'Setnayan AI brain', href: '/admin/brain',           icon: Brain },
    ],
  },

  // ── 4. CONTENT ───────────────────────────────────────────────────────────
  // Everything the public or couples see on the website and app.
  {
    key: 'content',
    label: 'Content',
    defaultOpen: false,
    items: [
      { key: 'website',          label: 'Website',          href: '/admin/website',          icon: Globe },
      { key: 'hero-video',       label: 'Hero video',       href: '/admin/hero-video',       icon: Video },
      { key: 'reveal-studio',    label: 'Reveal Studio',    href: '/admin/reveal-studio',    icon: Sparkles },
      { key: 'real-stories',     label: 'Real Stories',     href: '/admin/real-stories',     icon: Newspaper, matchPrefix: '/admin/real-stories' },
      { key: 'recaps',           label: 'Recaps',           href: '/admin/recaps',           icon: Images,    matchPrefix: '/admin/recaps' },
      { key: 'social-queue',     label: 'Social queue',     href: '/admin/social-queue',     icon: Share2,    matchPrefix: '/admin/social-queue' },
      { key: 'songs',            label: 'Songs',            href: '/admin/songs',            icon: Music,     matchPrefix: '/admin/songs' },
      { key: 'moodboard-library',label: 'Moodboard library',href: '/admin/moodboard-library',icon: Palette },
      { key: 'notifications',    label: 'Notifications',    href: '/admin/notifications',    icon: Bell },
    ],
  },

  // ── 5. PLATFORM ──────────────────────────────────────────────────────────
  // How the system is configured: catalog data, taxonomy, nav registry,
  // onboarding settings, and admin tooling.
  {
    key: 'platform',
    label: 'Platform',
    defaultOpen: false,
    items: [
      {
        key: 'settings',
        label: 'Settings',
        href: '/admin/settings',
        icon: Settings,
        // matchPrefix intentionally kept — /admin/settings/payment-methods and
        // /admin/settings/demo-mode are sub-paths; Settings lights up for both.
        matchPrefix: '/admin/settings',
      },
      { key: 'menus',              label: 'Menus & icons',      href: '/admin/menus',              icon: Shapes },
      { key: 'taxonomy',           label: 'Taxonomy',           href: '/admin/taxonomy',           icon: Tag },
      { key: 'event-types',        label: 'Event Types',        href: '/admin/event-types',        icon: PartyPopper },
      { key: 'wedding-types',      label: 'Wedding types',      href: '/admin/wedding-types',      icon: Church },
      { key: 'wedding-traditions', label: 'Wedding traditions', href: '/admin/wedding-traditions', icon: BookOpen },
      { key: 'refinements',        label: 'Refinements',        href: '/admin/refinements',        icon: SlidersHorizontal },
      { key: 'onboarding',         label: 'Onboarding',         href: '/admin/onboarding',         icon: Compass },
      { key: 'demo-vendors',       label: 'Demo vendors',       href: '/admin/demo-vendors',       icon: TestTube, matchPrefix: '/admin/demo-vendors' },
      { key: 'demo-mode',          label: 'Demo mode',          href: '/admin/settings/demo-mode', icon: Settings },
    ],
  },

  // ── 6. INTELLIGENCE ──────────────────────────────────────────────────────
  // Analytics, operational health, and personal admin account.
  // Overview (/admin) lives here so the Intelligence bottom-nav tab lands on
  // the command-centre dashboard.
  {
    key: 'intelligence',
    label: 'Intelligence',
    defaultOpen: false,
    items: [
      { key: 'overview',            label: 'Overview',            href: '/admin',                    icon: Home },
      { key: 'growth',              label: 'Growth',              href: '/admin/growth',             icon: LineChart,  matchPrefix: '/admin/growth' },
      { key: 'intel',               label: 'Intelligence',        href: '/admin/intelligence',       icon: Radar,      matchPrefix: '/admin/intelligence' },
      { key: 'funnels',             label: 'Funnels',             href: '/admin/funnels',            icon: BarChart3 },
      { key: 'operations-hiring',   label: 'Operations & Hiring', href: '/admin/operations-hiring',  icon: TrendingUp },
      { key: 'connection-logs',     label: 'Connection logs',     href: '/admin/connection-logs',    icon: Bug },
      { key: 'offline',             label: 'Offline daemon',      href: '/admin/offline',            icon: WifiOff },
      { key: 'my-account',          label: 'My account',          href: '/dashboard/profile',        icon: CircleUser },
    ],
  },
];

/**
 * Overlays admin nav-registry label + icon onto each sidebar item via its
 * `admin.sidebar.<key>` slot. Fallback = hardcoded default; hidden slot drops
 * the item; no-op when navSlots is absent. href/matchPrefix + group structure
 * stay in code.
 */
function applyAdminRegistry(
  groups: NavGroup[],
  navSlots?: Record<string, NavSlotLite>,
): NavGroup[] {
  if (!navSlots) return groups;
  return groups.map((group) => ({
    ...group,
    items: group.items.flatMap((item) => {
      const slot = navSlots[`admin.sidebar.${item.key}`];
      if (!slot) return [item];
      if (slot.isHidden) return [];
      return [{ ...item, label: slot.label, icon: navIconComponent(slot.icon) }];
    }),
  }));
}

export function AdminSidebar({ navSlots }: { navSlots?: Record<string, NavSlotLite> }) {
  const pathname = usePathname() ?? '/admin';
  const groups = applyAdminRegistry(ADMIN_NAV_GROUPS, navSlots);

  return (
    <>
      <header className="px-4 pb-4 pt-2 [[data-sidebar-collapsed='1']_&]:hidden">
        <Wordmark className="text-ink" />
        <p
          className="m-label-mono mt-2"
          style={{ color: 'var(--m-slate-2)' }}
        >
          Setnayan HQ
        </p>
      </header>

      {groups.map((group) => (
        <SidebarSection key={group.key} group={group} pathname={pathname}>
          {group.items.map((item) => (
            <SidebarItem key={item.key} item={item} pathname={pathname} />
          ))}
        </SidebarSection>
      ))}
    </>
  );
}
