/**
 * /admin/marketing — mobile overflow landing for the Marketing group
 * (6-menu respine 2026-07-03: Overview · Accounts · Content · Marketing ·
 * Performance · System Settings).
 *
 * The 6th-HQ marketing module's landing: the social publishing queue + the
 * two featuring levers + the growth incentives. Ads + campaign surfaces join
 * here when they ship (Ads blocked on Meta creds). Per
 * [[feedback_setnayan_orphan_prevention]] every item maps 1:1 to a sidebar
 * entry in apps/web/app/admin/_components/admin-sidebar.tsx Marketing group.
 *
 * SCOPE: server component (same pattern as /admin/directory). Hidden at lg+
 * via lg:hidden inside MobileLandingGrid — desktop reaches these through the
 * sidebar Marketing group.
 */

import { Share2, Trophy, BookOpen, Tag, Gift } from 'lucide-react';
import { MobileLandingGrid, type LandingItem } from '../_components/mobile-landing-grid';

export const metadata = { title: 'Marketing · Admin' };

const MARKETING_ITEMS: LandingItem[] = [
  {
    key: 'social-queue',
    label: 'Social queue',
    href: '/admin/social-queue',
    icon: Share2,
    description:
      'Ready-to-post couple creations, vendor verification features, and take-downs for the Setnayan social pages.',
  },
  {
    key: 'spotlight-awards',
    label: 'Spotlight Awards',
    href: '/admin/spotlight-awards',
    icon: Trophy,
    description:
      'Award and order the vendor spotlight badges that feature on public surfaces.',
  },
  {
    key: 'journal-spotlights',
    label: 'Journal Spotlights',
    href: '/admin/journal-spotlights',
    icon: BookOpen,
    description:
      'Pick and order which stories the public Journal features front and center.',
  },
  {
    key: 'discount-codes',
    label: 'Discount codes',
    href: '/admin/discount-codes',
    icon: Tag,
    description:
      'Create and manage promo codes — the paid-SKU growth lever for campaigns.',
  },
  {
    key: 'referrals',
    label: 'Referrals',
    href: '/admin/referrals',
    icon: Gift,
    description:
      'Referral program settings and payouts — who referred whom, and what it earned.',
  },
];

export default function AdminMarketingLanding() {
  return (
    <MobileLandingGrid
      title="Marketing"
      subtitle="Publishing, featuring, and growth levers — the marketing side of Setnayan HQ."
      items={MARKETING_ITEMS}
    />
  );
}
