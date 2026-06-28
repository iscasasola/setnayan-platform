/**
 * /admin/work — mobile triage action feed for the Work group.
 *
 * WHY: ops-shaped nav redesign (Admin_Console_Nav_Redesign_2026-06-08.md ·
 * owner conditionally signed off). The mobile "Work" tab lands on a
 * PRIORITIZED action feed — every act-now queue with its live open-count,
 * busiest first, one tap into the work. This is the renamed + expanded
 * successor to the old /admin/queues feed: it now also carries Payouts +
 * Token sales (pulled in from the dissolved Money group), so the mobile
 * job — approvals-on-the-go — covers ALL pending work in one place.
 *
 * Counts come from the shared getAdminQueueCounts() helper
 * (lib/admin/queue-counts.ts) — the SAME source that badges the Work nav items
 * and the /admin overview, so all three agree by construction. The canonical
 * per-queue filter table lives in that helper now (it used to be duplicated
 * here, which is how the verify filter drifted once).
 *
 * A missing/renamed table resolves to a null count (not a throw), so that one
 * row degrades to a chevron instead of 500-ing the whole feed. Desktop redirect
 * implicit via lg:hidden on the feed.
 */

import {
  BadgeCheck,
  Banknote,
  Wallet,
  ShoppingBag,
  Crown,
  CreditCard,
  Shield,
  AlertOctagon,
  Star,
  Flag,
  CheckCheck,
  LifeBuoy,
  UserX,
  Handshake,
} from 'lucide-react';
import {
  QueuesTriageFeed,
  type TriageItem,
} from '../queues/_components/queues-triage-feed';
import {
  getAdminQueueCounts,
  type AdminQueueCounts,
} from '@/lib/admin/queue-counts';

export const metadata = { title: 'Work · Admin' };

export default async function AdminWorkLanding() {
  // Single source of truth — the same head-counts that badge the Work nav
  // items (lib/admin/queue-counts.ts). Fails open: a thrown query degrades the
  // feed to "unknown" chevrons rather than 500-ing the mobile triage page.
  const counts = await getAdminQueueCounts().catch(() => ({}) as AdminQueueCounts);

  const rows: TriageItem[] = [
    {
      key: 'verify',
      label: 'Verify',
      href: '/admin/verify',
      icon: BadgeCheck,
      description: 'Vendors awaiting the verification badge.',
      count: counts.verify ?? null,
    },
    {
      key: 'payments',
      label: 'Payments',
      href: '/admin/payments',
      icon: Banknote,
      description: 'Order payments awaiting reconciliation.',
      count: counts.payments ?? null,
    },
    {
      key: 'payouts',
      label: 'Payouts',
      href: '/admin/payouts',
      icon: Wallet,
      description: 'Vendor payouts ready to release.',
      count: counts.payouts ?? null,
    },
    {
      key: 'token-purchases',
      label: 'Token sales',
      href: '/admin/token-purchases',
      icon: ShoppingBag,
      description: 'Vendor token-pack purchases awaiting confirmation.',
      count: counts["token-purchases"] ?? null,
    },
    {
      key: 'subscriptions',
      label: 'Subscriptions',
      href: '/admin/subscriptions',
      icon: Crown,
      description: 'Vendor Pro / Enterprise upgrades awaiting confirmation.',
      count: counts.subscriptions ?? null,
    },
    {
      key: 'payment-options',
      label: 'Payment options',
      href: '/admin/payment-options',
      icon: CreditCard,
      description: 'Vendor payment destinations awaiting a fraud screen.',
      count: counts["payment-options"] ?? null,
    },
    {
      key: 'disputes',
      label: 'Disputes',
      href: '/admin/disputes',
      icon: Shield,
      description: 'Open customer and vendor disputes.',
      count: counts.disputes ?? null,
    },
    {
      key: 'force-majeure',
      label: 'Force majeure',
      href: '/admin/force-majeure',
      icon: AlertOctagon,
      description: 'Event-impacting flags to triage.',
      count: counts["force-majeure"] ?? null,
    },
    {
      key: 'reviews',
      label: 'Reviews',
      href: '/admin/reviews',
      icon: Star,
      description: 'Review appeals awaiting a decision.',
      count: counts.reviews ?? null,
    },
    {
      key: 'concierge-abuse',
      label: 'Setnayan AI abuse',
      href: '/admin/concierge-abuse',
      icon: Flag,
      description: 'Trial-cycling flags to review.',
      count: counts["concierge-abuse"] ?? null,
    },
    {
      key: 'account-deletions',
      label: 'Account deletions',
      href: '/admin/account-deletions',
      icon: UserX,
      description: 'Self-serve account-deletion requests to review.',
      count: counts["account-deletions"] ?? null,
    },
    {
      key: 'approvals',
      label: 'Two-admin approvals',
      href: '/admin/approvals',
      icon: CheckCheck,
      description: 'A colleague is waiting on your second sign-off.',
      count: counts.approvals ?? null,
    },
    {
      key: 'help',
      label: 'Help',
      href: '/admin/help',
      icon: LifeBuoy,
      description: 'Open help-center tickets.',
      count: counts.help ?? null,
    },
    {
      // Vendor partnerships — unverified partnership claims awaiting two-admin
      // review before their badge renders on couple search results.
      key: 'vendor-partnerships',
      label: 'Partnerships',
      href: '/admin/vendor-partnerships',
      icon: Handshake,
      description: 'Vendor-to-vendor partnership claims awaiting two-admin verification.',
      count: counts["vendor-partnerships"] ?? null,
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

  return <QueuesTriageFeed title="Work" items={ordered} totalOpen={totalOpen} />;
}
