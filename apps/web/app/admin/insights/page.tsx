/**
 * /admin/insights — mobile overflow landing for the Insights group.
 *
 * WHY: nav tune 2026-06-15 (owner-approved this session — "6 tabs, keep
 * 'Work'"). The admin mobile strip grows from the 4-tab ops spine (Home ·
 * Work · Directory · More) to 6 tabs (Home · Work · Directory · Money ·
 * Insights · More) so the analytics pulse the team checks daily is one tap,
 * not buried two levels deep inside More. This card grid is the Insights
 * tab's landing — it mirrors the desktop sidebar's Insights group (key
 * 'funnels') 1:1 per [[feedback_setnayan_orphan_prevention]], and the items
 * are lifted verbatim from the old /admin/more accordion's Insights section.
 *
 * SCOPE: server component, no client interactivity (same pattern as
 * /admin/directory). MobileLandingGrid hides itself at lg+ via lg:hidden —
 * desktop reaches these surfaces through the sidebar Insights group.
 *
 * Telemetry + Offline daemon remain FORWARD-REFERENCE entries until their
 * sprints land.
 */

import {
  LineChart,
  Radar,
  BarChart3,
  TrendingUp,
  Activity,
  Bug,
  WifiOff,
} from 'lucide-react';
import { MobileLandingGrid, type LandingItem } from '../_components/mobile-landing-grid';

export const metadata = { title: 'Insights · Admin' };

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
    key: 'intelligence',
    label: 'Intelligence',
    href: '/admin/intelligence',
    icon: Radar,
    description:
      'Churn radar (quiet couples with upcoming events), market pulse (budgets · regions · event types), and engagement-ranked lead scores.',
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

export default function AdminInsightsLanding() {
  return (
    <MobileLandingGrid
      title="Insights"
      subtitle="How we're doing — growth, intelligence, funnels, and service health in one place."
      items={INSIGHTS_ITEMS}
    />
  );
}
