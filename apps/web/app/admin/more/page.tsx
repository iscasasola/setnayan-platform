/**
 * /admin/more — mobile overflow landing for Content + Operations + Funnels
 *                + Settings groups.
 *
 * WHY: CLAUDE.md 2026-05-23 row 2 admin doorway mobile lock — the 5-item
 * BottomNav caps at 5 tabs (Home + Queues + Directory + Money + More).
 * The remaining 4 desktop groups (Content + Operations + Funnels +
 * Settings) compress into this More overflow.
 *
 * Telemetry + Offline daemon are FORWARD-REFERENCE entries — Phase E +
 * Phase G parallel sprints ship those routes in their own PRs. Until
 * those land the cards link to 404, which is acceptable for parallel
 * sprint coordination per the Phase 3 brief.
 */

import {
  Brain,
  Palette,
  Tag,
  Globe,
  Megaphone,
  TrendingUp,
  Activity,
  WifiOff,
  BarChart3,
  LineChart,
  Settings,
} from 'lucide-react';
import { MobileLandingGrid, type LandingItem } from '../_components/mobile-landing-grid';

export const metadata = { title: 'More · Admin' };

const MORE_ITEMS: LandingItem[] = [
  // Content group
  {
    key: 'brain',
    label: "Today's Focus brain",
    href: '/admin/brain',
    icon: Brain,
    description:
      'Curated knowledge feeding the AI Today’s Focus chat. Browse chunks by topic.',
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
    key: 'taxonomy',
    label: 'Taxonomy',
    href: '/admin/taxonomy',
    icon: Tag,
    description:
      'Canonical vendor service categories and the 192-entry sub-category map.',
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
    key: 'ads',
    label: 'Ads',
    href: '/admin/ads',
    icon: Megaphone,
    description:
      'Boosted Ads + Sponsored Boost activation review. Manage vendor marketing tier eligibility.',
  },
  // Operations group
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
    key: 'offline',
    label: 'Offline daemon',
    href: '/admin/offline',
    icon: WifiOff,
    description:
      'Offline sync queue and conflict resolution. Forward-reference — ships with the next refresh.',
  },
  // Insights group
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
  // Settings group
  {
    key: 'settings',
    label: 'Settings',
    href: '/admin/settings',
    icon: Settings,
    description:
      'Platform identity, business details, and Sentry smoke-test. Edit gated to internal admins.',
  },
  {
    key: 'demo-mode',
    label: 'Demo mode',
    href: '/admin/settings/demo-mode',
    icon: Settings,
    description:
      'Pilot demo-mode toggle. Surfaces seeded showcase data and hides retired SKU surfaces.',
  },
];

export default function AdminMoreLanding() {
  return (
    <MobileLandingGrid
      title="More"
      subtitle="Content, operations, funnels, and platform settings. Less-frequent admin surfaces live here."
      items={MORE_ITEMS}
    />
  );
}
