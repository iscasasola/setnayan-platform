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
 * Counts mirror the exact filters each queue page uses so the number here
 * matches the rows the admin sees on arrival:
 *   verify          public_visibility='coming_soon'           → /admin/verify
 *   payments        status='pending'                          → /admin/payments
 *   payouts         paid_at IS NULL AND on_hold=false         → /admin/payouts
 *   token-purchases status='pending_payment'                  → /admin/token-purchases
 *   payment-options moderation_status in (pending_review,held)→ /admin/payment-options
 *   disputes        status='open'                             → /admin/disputes
 *   force-majeure   status in (open, under_review)            → /admin/force-majeure
 *   reviews         decided_at IS NULL                        → /admin/reviews
 *   abuse           status='pending_review'                   → /admin/concierge-abuse
 *   help            status in (new, in_progress)              → /admin/help
 *
 * A missing/renamed table resolves with an { error } (not a throw), so
 * take() degrades that one row to null (chevron) instead of 500-ing the
 * whole feed. Desktop redirects implicit via lg:hidden on the feed.
 */

import {
  BadgeCheck,
  Banknote,
  Wallet,
  ShoppingBag,
  CreditCard,
  Shield,
  AlertOctagon,
  Star,
  Flag,
  LifeBuoy,
} from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  QueuesTriageFeed,
  type TriageItem,
} from '../queues/_components/queues-triage-feed';

export const metadata = { title: 'Work · Admin' };

function take(c: number | null | undefined): number | null {
  return typeof c === 'number' ? c : null;
}

export default async function AdminWorkLanding() {
  const admin = createAdminClient();
  const head = { count: 'exact', head: true } as const;

  const [
    verifyRes,
    paymentsRes,
    payoutsRes,
    tokenSalesRes,
    paymentOptionsRes,
    disputesRes,
    forceMajeureRes,
    reviewsRes,
    abuseRes,
    helpRes,
  ] = await Promise.all([
    admin
      .from('vendor_profiles')
      .select('*', head)
      .eq('public_visibility', 'coming_soon'),
    admin.from('payments').select('*', head).eq('status', 'pending'),
    admin
      .from('vendor_payouts')
      .select('*', head)
      .is('paid_at', null)
      .eq('on_hold', false),
    admin
      .from('vendor_token_purchases')
      .select('*', head)
      .eq('status', 'pending_payment'),
    admin
      .from('vendor_payment_methods')
      .select('*', head)
      .in('moderation_status', ['pending_review', 'held']),
    admin.from('vendor_disputes').select('*', head).eq('status', 'open'),
    admin
      .from('force_majeure_flags')
      .select('*', head)
      .in('status', ['open', 'under_review']),
    admin.from('vendor_review_appeals').select('*', head).is('decided_at', null),
    admin
      .from('concierge_abuse_flags')
      .select('*', head)
      .eq('status', 'pending_review'),
    admin
      .from('help_messages')
      .select('*', head)
      .in('status', ['new', 'in_progress']),
  ]);

  const rows: TriageItem[] = [
    {
      key: 'verify',
      label: 'Verify',
      href: '/admin/verify',
      icon: BadgeCheck,
      description: 'Vendors awaiting the verification badge.',
      count: take(verifyRes.count),
    },
    {
      key: 'payments',
      label: 'Payments',
      href: '/admin/payments',
      icon: Banknote,
      description: 'Order payments awaiting reconciliation.',
      count: take(paymentsRes.count),
    },
    {
      key: 'payouts',
      label: 'Payouts',
      href: '/admin/payouts',
      icon: Wallet,
      description: 'Vendor payouts ready to release.',
      count: take(payoutsRes.count),
    },
    {
      key: 'token-purchases',
      label: 'Token sales',
      href: '/admin/token-purchases',
      icon: ShoppingBag,
      description: 'Vendor token-pack purchases awaiting confirmation.',
      count: take(tokenSalesRes.count),
    },
    {
      key: 'payment-options',
      label: 'Payment options',
      href: '/admin/payment-options',
      icon: CreditCard,
      description: 'Vendor payment destinations awaiting a fraud screen.',
      count: take(paymentOptionsRes.count),
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
      key: 'concierge-abuse',
      label: 'Setnayan AI abuse',
      href: '/admin/concierge-abuse',
      icon: Flag,
      description: 'Trial-cycling flags to review.',
      count: take(abuseRes.count),
    },
    {
      key: 'help',
      label: 'Help',
      href: '/admin/help',
      icon: LifeBuoy,
      description: 'Open help-center tickets.',
      count: take(helpRes.count),
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
