'use client';

/**
 * AdminMoreAccordion — the icon-carrying data + render for /admin/more.
 *
 * WHY THIS IS A CLIENT COMPONENT: the three section arrays carry
 * `icon: LucideIcon` refs (forwardRef objects). MobileLandingAccordion is a
 * Client Component (its collapse state is interactive · useState). If the
 * server `page.tsx` built these arrays and passed them as props into the
 * accordion, the Flight serializer would try to send those function refs
 * across the Server→Client boundary and throw into the root error boundary
 * (the digest-only "Something on our end didn't work." screen) — the exact
 * failure mode documented in admin-bottom-nav.tsx. Keeping the icon refs
 * inside a 'use client' module end-to-end means nothing non-serializable
 * crosses the boundary: the server page just renders <AdminMoreAccordion />
 * with no props, mirroring how AdminBottomNav / AdminSidebar hold their own
 * icon-ref item lists. Regression fix 2026-06-09 (introduced by the PR 3
 * accordion swap 2026-06-08, which turned the renderer client-side while the
 * page kept passing icons from the server).
 *
 * The /admin/directory sibling does NOT need this wrapper because its
 * renderer (MobileLandingGrid) stayed a Server Component.
 */

import {
  // Insights
  LineChart,
  BarChart3,
  TrendingUp,
  Activity,
  Bug,
  WifiOff,
  // Money & Catalog
  DollarSign,
  Sparkles,
  Tag as TagIcon,
  Coins,
  PiggyBank,
  Receipt,
  CreditCard,
  // Platform
  Settings,
  Compass,
  Tag,
  Globe,
  Megaphone,
  Brain,
  Palette,
  Music,
  Church,
  BookOpen,
  Bell,
  CircleUser,
  PartyPopper,
  Newspaper,
} from 'lucide-react';
import type { LandingItem } from '../_components/mobile-landing-grid';
import {
  MobileLandingAccordion,
  type AccordionSectionData,
} from '../_components/mobile-landing-accordion';

const INSIGHTS_ITEMS: LandingItem[] = [
  {
    key: 'growth',
    label: 'Growth',
    href: '/admin/growth',
    icon: LineChart,
    description:
      'Population now + growth over time for vendors, services, events, customers, and guests — plus guest→account conversion.',
  },
  {
    key: 'funnels',
    label: 'Funnels',
    href: '/admin/funnels',
    icon: BarChart3,
    description:
      'PostHog-resident product funnels. Open in PostHog for cohort and step-level analysis.',
  },
  {
    key: 'operations-hiring',
    label: 'Operations & Hiring',
    href: '/admin/operations-hiring',
    icon: TrendingUp,
    description:
      'Growth cockpit. Vendor count, weekly visits, hiring milestones, and bottleneck signals.',
  },
  {
    key: 'telemetry',
    label: 'Telemetry',
    href: '/admin/telemetry',
    icon: Activity,
    description:
      'Service telemetry checkpoints. Forward-reference — ships with the next refresh.',
  },
  {
    key: 'connection-logs',
    label: 'Connection logs',
    href: '/admin/connection-logs',
    icon: Bug,
    description:
      'Real-time client-side faults — broken buttons, failed saves, blank fallbacks — with a resolve lifecycle.',
  },
  {
    key: 'offline',
    label: 'Offline daemon',
    href: '/admin/offline',
    icon: WifiOff,
    description:
      'Offline sync queue and conflict resolution. Forward-reference — ships with the next refresh.',
  },
];

const MONEY_ITEMS: LandingItem[] = [
  {
    key: 'pricing',
    label: 'Pricing',
    href: '/admin/pricing',
    icon: DollarSign,
    description:
      'SKU catalog with sticker prices and active status. Read-only V1; edit lands with the next refresh.',
  },
  {
    key: 'addons',
    label: 'Add-ons',
    href: '/admin/addons',
    icon: Sparkles,
    description:
      'Customer SKU catalog audit. Pricing, eligibility, and lifetime traction in one grid.',
  },
  {
    key: 'discount-codes',
    label: 'Discount codes',
    href: '/admin/discount-codes',
    icon: TagIcon,
    description:
      'Voucher codes for pilot. Mint percentage discounts, capped percentages, or 100% free codes.',
  },
  {
    key: 'token-bands',
    label: 'Token bands',
    href: '/admin/token-bands',
    icon: Coins,
    description:
      'Region → token burn bands (₱100 / ₱200 / ₱300) charged when a vendor answers an inquiry. Admin-editable.',
  },
  {
    key: 'budget-planner',
    label: 'Budget Planner',
    href: '/admin/budget-planner',
    icon: PiggyBank,
    description:
      'Seed benchmark prices, tune the allocation engine, and review de-identified couple budget insights.',
  },
  {
    key: 'receipts',
    label: 'Receipts',
    href: '/admin/receipts',
    icon: Receipt,
    description:
      'Setnayan software receipts archive. Download per-order PDFs for couples and vendors.',
  },
  {
    key: 'payment-methods',
    label: 'Payment methods',
    href: '/admin/settings/payment-methods',
    icon: CreditCard,
    description:
      'BDO and GCash receiving accounts shown on customer orders. Edit account numbers and QR codes.',
  },
];

const PLATFORM_ITEMS: LandingItem[] = [
  {
    key: 'settings',
    label: 'Settings',
    href: '/admin/settings',
    icon: Settings,
    description:
      'Platform identity, business details, and Sentry smoke-test. Edit gated to internal admins.',
  },
  {
    key: 'onboarding',
    label: 'Onboarding',
    href: '/admin/onboarding',
    icon: Compass,
    description:
      'New-account onboarding settings grouped by type — background music and future per-flow knobs.',
  },
  {
    key: 'taxonomy',
    label: 'Taxonomy',
    href: '/admin/taxonomy',
    icon: Tag,
    description:
      'Canonical vendor service categories and the sub-category card tree.',
  },
  {
    key: 'event-types',
    label: 'Event Types',
    href: '/admin/event-types',
    icon: PartyPopper,
    description:
      'Create, launch, and retire the event types Setnayan plans — pickers and vendor checkboxes follow automatically.',
  },
  {
    key: 'website',
    label: 'Website',
    href: '/admin/website',
    icon: Globe,
    description:
      'Marketing site widget visibility and content toggles. Manage the public homepage and footer.',
  },
  {
    key: 'real-stories',
    label: 'Real Stories',
    href: '/admin/real-stories',
    icon: Newspaper,
    description:
      'Feature and order which consented wedding editorials surface on the public /realstories page, and pick the hero.',
  },
  {
    key: 'ads',
    label: 'Ads',
    href: '/admin/ads',
    icon: Megaphone,
    description:
      'Boosted Ads + Sponsored Boost activation review. Manage vendor marketing tier eligibility.',
  },
  {
    key: 'brain',
    label: 'Setnayan AI brain',
    href: '/admin/brain',
    icon: Brain,
    description:
      'Curated knowledge feeding the Setnayan AI chat. Browse chunks by topic.',
  },
  {
    key: 'moodboard-library',
    label: 'Moodboard library',
    href: '/admin/moodboard-library',
    icon: Palette,
    description:
      'Curated location and figure imagery for the 3-pillar mood board. Manage palettes and tags.',
  },
  {
    key: 'songs',
    label: 'Songs',
    href: '/admin/songs',
    icon: Music,
    description:
      'The owned music-track library that scores rendered videos. Manage tracks and categories.',
  },
  {
    key: 'wedding-types',
    label: 'Wedding types',
    href: '/admin/wedding-types',
    icon: Church,
    description:
      'Per-religion launch gate — vendor and venue readiness vs an editable threshold; open, hold, or disable each wedding religion.',
  },
  {
    key: 'wedding-traditions',
    label: 'Wedding traditions',
    href: '/admin/wedding-traditions',
    icon: BookOpen,
    description:
      'Per-religion wedding-traditions content shown on the couple paperwork guide. Edit items, or reset to the latest starter content.',
  },
  {
    key: 'notifications',
    label: 'Notifications',
    href: '/admin/notifications',
    icon: Bell,
    description:
      'Cross-actor signal reader — customer→vendor and admin signals in one inbox.',
  },
  {
    key: 'demo-mode',
    label: 'Demo mode',
    href: '/admin/settings/demo-mode',
    icon: Settings,
    description:
      'Pilot demo-mode toggle. Surfaces seeded showcase data and hides retired SKU surfaces.',
  },
  {
    // Mirrors the desktop sidebar's Platform → My account entry (account-
    // security suite 2026-06-11) so mobile admins also reach the shared
    // /dashboard/profile surface for password + session controls.
    key: 'my-account',
    label: 'My account',
    href: '/dashboard/profile',
    icon: CircleUser,
    description:
      'Your personal account — display name, change password, and sign out other devices.',
  },
];

const SECTIONS: AccordionSectionData[] = [
  // Keys mirror the desktop sidebar group keys (funnels / money / content)
  // for conceptual continuity with admin-sidebar.tsx.
  { key: 'funnels', label: 'Insights', items: INSIGHTS_ITEMS },
  { key: 'money', label: 'Money & Catalog', items: MONEY_ITEMS },
  { key: 'content', label: 'Platform', items: PLATFORM_ITEMS },
];

export function AdminMoreAccordion() {
  return (
    <MobileLandingAccordion
      title="More"
      subtitle="Insights, money & catalog config, content, and platform settings. Tap a group to expand or collapse."
      sections={SECTIONS}
    />
  );
}
