/**
 * /admin/queues — mobile overflow landing for the Queues group.
 *
 * WHY: CLAUDE.md 2026-05-23 row 2 admin doorway mobile lock — 7 queue
 * surfaces compress into a card grid behind the Queues bottom-nav tab
 * because rendering 7 separate tabs on a 360px PH mobile would yield
 * ~50px-wide cells unusable at the 44pt WCAG floor.
 *
 * Desktop redirects implicit via lg:hidden on the MobileLandingGrid —
 * desktop users see the sidebar tree directly and never land here. We
 * still ship a desktop-safe render (the landing surface is reachable
 * by direct URL on any viewport per orphan-prevention) but it stays
 * inside the lg:hidden block so it's purely a mobile affordance.
 *
 * Per [[feedback_setnayan_no_dev_text_post_launch]] all descriptions use
 * brand voice — no engineering jargon, no schema names leaked into UI.
 */

import {
  Banknote,
  BadgeCheck,
  Shield,
  AlertOctagon,
  Star,
  LifeBuoy,
  Flag,
} from 'lucide-react';
import { MobileLandingGrid, type LandingItem } from '../_components/mobile-landing-grid';

export const metadata = { title: 'Queues · Admin' };

const QUEUE_ITEMS: LandingItem[] = [
  {
    key: 'payments',
    label: 'Payments',
    href: '/admin/payments',
    icon: Banknote,
    description:
      'Reconcile order payments. Approve uploads, request a clearer screenshot, or decline with a reason.',
  },
  {
    key: 'verify',
    label: 'Verify',
    href: '/admin/verify',
    icon: BadgeCheck,
    description:
      'Vendor verification queue. Review the 12-document checklist and grant the lifetime badge.',
  },
  {
    key: 'disputes',
    label: 'Disputes',
    href: '/admin/disputes',
    icon: Shield,
    description:
      'Customer + vendor disputes by category. Track open SLA windows and resolutions in progress.',
  },
  {
    key: 'force-majeure',
    label: 'Force majeure',
    href: '/admin/force-majeure',
    icon: AlertOctagon,
    description:
      'Inbound force-majeure flags from couples. Triage event-impacting weather, illness, and venue events.',
  },
  {
    key: 'reviews',
    label: 'Reviews',
    href: '/admin/reviews',
    icon: Star,
    description:
      'Review moderation queue with related-account signals. Override-publish appeals with a reason.',
  },
  {
    key: 'help',
    label: 'Help',
    href: '/admin/help',
    icon: LifeBuoy,
    description:
      'Inbound help-center tickets routed by role. Reply, escalate, or close with notes.',
  },
  {
    key: 'concierge-abuse',
    label: "Today's Focus abuse",
    href: '/admin/concierge-abuse',
    icon: Flag,
    description:
      'Multi-account trial-cycling flags. Clear false positives or confirm abuse with progressive enforcement.',
  },
];

export default function AdminQueuesLanding() {
  return (
    <MobileLandingGrid
      title="Queues"
      subtitle="Time-sensitive work. Payments, verification, disputes, reviews, help, and abuse review live here."
      items={QUEUE_ITEMS}
    />
  );
}
