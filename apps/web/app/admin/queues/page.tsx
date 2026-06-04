/**
 * /admin/queues — mobile triage action feed for the Queues group.
 *
 * WHY: CLAUDE.md 2026-05-23 row 2 admin doorway mobile lock — the 7 queue
 * surfaces compress behind the Queues bottom-nav tab on a phone. Previously
 * this landed on a flat card menu; per the 0023 §5 "mobile = urgent
 * approvals" rule it now lands on a PRIORITIZED action feed: every queue
 * with its live open-count, busiest first, one tap into the work.
 *
 * Counts mirror the exact filters each queue page uses so the number here
 * matches the rows the admin sees on arrival:
 *   payments        status='pending'                  → /admin/payments
 *   verify          public_visibility='coming_soon'   → /admin/verify
 *   disputes        status='open'                      → /admin/disputes
 *   force-majeure   status in (open, under_review)     → /admin/force-majeure
 *   reviews         decided_at IS NULL                 → /admin/reviews
 *   help            status in (new, in_progress)       → /admin/help
 *   abuse           status='pending_review'            → /admin/concierge-abuse
 *
 * Desktop redirects implicit via lg:hidden on the feed — desktop admins use
 * the sidebar tree and never land here. Server component, no client JS.
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
import { createAdminClient } from '@/lib/supabase/admin';
import { QueuesTriageFeed, type TriageItem } from './_components/queues-triage-feed';

export const metadata = { title: 'Queues · Admin' };

function take(c: number | null | undefined): number | null {
  return typeof c === 'number' ? c : null;
}

export default async function AdminQueuesLanding() {
  const admin = createAdminClient();
  const head = { count: 'exact', head: true } as const;

  // A queue table missing/renamed resolves with an { error } (not a throw),
  // so take() degrades that one row to null (chevron) instead of 500-ing the
  // whole feed. Mirrors the count pattern on /admin (Home).
  const [
    paymentsRes,
    verifyRes,
    disputesRes,
    forceMajeureRes,
    reviewsRes,
    helpRes,
    abuseRes,
  ] = await Promise.all([
    admin.from('payments').select('*', head).eq('status', 'pending'),
    admin
      .from('vendor_profiles')
      .select('*', head)
      .eq('public_visibility', 'coming_soon'),
    admin.from('vendor_disputes').select('*', head).eq('status', 'open'),
    admin
      .from('force_majeure_flags')
      .select('*', head)
      .in('status', ['open', 'under_review']),
    admin.from('vendor_review_appeals').select('*', head).is('decided_at', null),
    admin
      .from('help_messages')
      .select('*', head)
      .in('status', ['new', 'in_progress']),
    admin
      .from('concierge_abuse_flags')
      .select('*', head)
      .eq('status', 'pending_review'),
  ]);

  const rows: TriageItem[] = [
    {
      key: 'payments',
      label: 'Payments',
      href: '/admin/payments',
      icon: Banknote,
      description: 'Order payments awaiting reconciliation.',
      count: take(paymentsRes.count),
    },
    {
      key: 'verify',
      label: 'Verify',
      href: '/admin/verify',
      icon: BadgeCheck,
      description: 'Vendors awaiting the verification badge.',
      count: take(verifyRes.count),
    },
    {
      key: 'disputes',
      label: 'Disputes',
      href: '/admin/disputes',
      icon: Shield,
      description: 'Open customer and vendor disputes.',
      count: take(disputesRes.count),
    },
    {
      key: 'force-majeure',
      label: 'Force majeure',
      href: '/admin/force-majeure',
      icon: AlertOctagon,
      description: 'Event-impacting flags to triage.',
      count: take(forceMajeureRes.count),
    },
    {
      key: 'reviews',
      label: 'Reviews',
      href: '/admin/reviews',
      icon: Star,
      description: 'Review appeals awaiting a decision.',
      count: take(reviewsRes.count),
    },
    {
      key: 'help',
      label: 'Help',
      href: '/admin/help',
      icon: LifeBuoy,
      description: 'Open help-center tickets.',
      count: take(helpRes.count),
    },
    {
      key: 'concierge-abuse',
      label: "Today's Focus abuse",
      href: '/admin/concierge-abuse',
      icon: Flag,
      description: 'Trial-cycling flags to review.',
      count: take(abuseRes.count),
    },
  ];

  // Prioritize: queues with open work first (busiest first), then clear /
  // unavailable, preserving the canonical order within each band.
  const ordered = rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      const ca = a.row.count ?? 0;
      const cb = b.row.count ?? 0;
      const aOpen = ca > 0 ? 1 : 0;
      const bOpen = cb > 0 ? 1 : 0;
      if (aOpen !== bOpen) return bOpen - aOpen;
      if (cb !== ca) return cb - ca;
      return a.index - b.index;
    })
    .map((entry) => entry.row);

  const totalOpen = rows.reduce(
    (sum, row) => sum + Math.max(0, row.count ?? 0),
    0,
  );

  return <QueuesTriageFeed items={ordered} totalOpen={totalOpen} />;
}
