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
 * 2026-07-10: card hrefs repointed to /admin/app-performance?tab=<key> (the
 * Insights Studio) so mobile matches the desktop sidebar; the legacy routes
 * redirect there anyway.
 *
 * Telemetry + Offline daemon remain FORWARD-REFERENCE entries until their
 * sprints land.
 */

import {
  Activity,
  LineChart,
  Radar,
  Globe,
  BarChart3,
  TrendingUp,
  Bug,
  WifiOff,
} from 'lucide-react';
import { MobileLandingGrid, type LandingItem } from '../_components/mobile-landing-grid';
import { fetchAdminPesoOverview } from '@/lib/vendor-peso';
import { PesoPerLeadAdminCard } from './_components/peso-per-lead-admin-card';
import { fetchAdminOutcomeOverview } from '@/lib/inquiry-outcomes';
import { WonLostAdminCard } from './_components/won-lost-admin-card';

import { requireAdmin } from '@/lib/admin/require-admin';
export const metadata = { title: 'Insights · Admin' };

const INSIGHTS_ITEMS: LandingItem[] = [
  {
    // The cockpit leads the group (owner lock 2026-07-03 — "1 of the 6 menus";
    // the desktop sidebar group is renamed "App Performance" with this at top).
    key: 'app-performance',
    label: 'App Performance',
    href: '/admin/app-performance',
    icon: Activity,
    description:
      'The operator cockpit — growth, stability, and money in on one page, every chart tagged Live or Needs-wiring.',
  },
  {
    key: 'growth',
    label: 'Growth',
    href: '/admin/app-performance?tab=growth',
    icon: LineChart,
    description:
      'Population now + growth over time for vendors, services, events, customers, and guests — plus guest→account conversion.',
  },
  {
    key: 'intelligence',
    label: 'Intelligence',
    href: '/admin/app-performance?tab=intelligence',
    icon: Radar,
    description:
      'Churn radar (quiet couples with upcoming events), market pulse (budgets · regions · event types), and engagement-ranked lead scores.',
  },
  {
    key: 'seo',
    label: 'SEO & GEO',
    href: '/admin/app-performance?tab=seo',
    icon: Globe,
    description:
      'Nightly llms.txt-vs-catalog drift audit, route/token coverage, and Search Console trend.',
  },
  {
    key: 'funnels',
    label: 'Funnels',
    href: '/admin/app-performance?tab=funnels',
    icon: BarChart3,
    description:
      'PostHog-resident product funnels. Open in PostHog for cohort and step-level analysis.',
  },
  {
    key: 'operations-hiring',
    label: 'Operations & Hiring',
    href: '/admin/app-performance?tab=operations',
    icon: TrendingUp,
    description:
      'Growth cockpit. Vendor count, weekly visits, hiring milestones, and bottleneck signals.',
  },
  {
    key: 'connection-logs',
    label: 'Connection logs',
    href: '/admin/app-performance?tab=connection-logs',
    icon: Bug,
    description:
      'Real-time client-side faults — broken buttons, failed saves, blank fallbacks — with a resolve lifecycle.',
  },
  {
    key: 'offline',
    label: 'Offline daemon',
    href: '/admin/app-performance?tab=offline',
    icon: WifiOff,
    description:
      'Offline sync queue and conflict resolution. Forward-reference — ships with the next refresh.',
  },
];

export default async function AdminInsightsLanding() {
  // Defense-in-depth: reads service-role admin overviews below.
  await requireAdmin();
  // Vendor unit-economics scorecard (Wave 6). The /admin layout already 404s
  // non-admins, and the RPC self-gates on is_console_admin(), so this only
  // resolves for admins. Visible at all breakpoints (unlike the mobile-only
  // nav grid below).
  const [pesoOverview, outcomeOverview] = await Promise.all([
    fetchAdminPesoOverview(),
    // Won & Lost Reasons aggregate (Wave 6). Same admin-only gating as above.
    fetchAdminOutcomeOverview(),
  ]);

  return (
    <>
      <div className="mx-auto w-full max-w-3xl px-4 pt-6 sm:px-6 lg:max-w-6xl">
        <PesoPerLeadAdminCard overview={pesoOverview} />
        <WonLostAdminCard overview={outcomeOverview} />
      </div>
      <MobileLandingGrid
        title="Insights"
        subtitle="How we're doing — growth, intelligence, funnels, and service health in one place."
        items={INSIGHTS_ITEMS}
      />
    </>
  );
}
