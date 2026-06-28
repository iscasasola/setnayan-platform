/**
 * /admin/work — the admin command center: every act-now queue in ONE ranked
 * worklist, most-urgent first, each row one click into the work.
 *
 * WHY: ~95% of admin sessions are "clear a queue." Instead of remembering to
 * check 14 separate pages, the admin lands on a single list that already knows
 * what needs them and in what order — overdue first (past its SLA window),
 * then due-soon, then busiest. Ranking + the per-queue "open" filters come from
 * the shared lib/admin/queue-counts.ts helpers, so this feed, the nav badges,
 * and the /admin overview all agree by construction.
 *
 * Urgency = the oldest open item's age vs the queue's slaHours (ADMIN_QUEUE_META
 * — owner-tunable). A queue whose timestamp is unavailable degrades to volume
 * ranking; a thrown query fails the whole feed open to "all clear" rather than
 * 500-ing. Renders at every breakpoint (the feed component handles the
 * responsive layout) — it's the desktop home as well as the mobile Work tab.
 *
 * Per [[feedback_setnayan_no_dev_text_post_launch]] all copy is brand-voice;
 * no schema names leak into the UI.
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
  MessageSquareWarning,
  type LucideIcon,
} from 'lucide-react';
import {
  QueuesTriageFeed,
  type TriageItem,
} from '../queues/_components/queues-triage-feed';
import {
  getAdminQueueDigest,
  computeDueState,
  ADMIN_QUEUE_META,
  type AdminQueueDigest,
} from '@/lib/admin/queue-counts';

export const metadata = { title: 'Work · Admin' };

// Presentation constants per queue (key MUST match ADMIN_QUEUE_META + the
// digest keys + the sidebar item keys 1:1). Urgency/count/lane are layered on
// from the digest below — this array only holds the brand-voice label/copy.
type BaseRow = {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
  description: string;
};

const BASE_ROWS: BaseRow[] = [
  { key: 'verify', label: 'Verify', href: '/admin/verify', icon: BadgeCheck, description: 'Vendors awaiting the verification badge.' },
  { key: 'payments', label: 'Payments', href: '/admin/payments', icon: Banknote, description: 'Order payments awaiting reconciliation.' },
  { key: 'payouts', label: 'Payouts', href: '/admin/payouts', icon: Wallet, description: 'Vendor payouts ready to release.' },
  { key: 'token-purchases', label: 'Token sales', href: '/admin/token-purchases', icon: ShoppingBag, description: 'Vendor token-pack purchases awaiting confirmation.' },
  { key: 'subscriptions', label: 'Subscriptions', href: '/admin/subscriptions', icon: Crown, description: 'Vendor Pro / Enterprise upgrades awaiting confirmation.' },
  { key: 'payment-options', label: 'Payment options', href: '/admin/payment-options', icon: CreditCard, description: 'Vendor payment destinations awaiting a fraud screen.' },
  { key: 'disputes', label: 'Disputes', href: '/admin/disputes', icon: Shield, description: 'Open customer and vendor disputes.' },
  { key: 'force-majeure', label: 'Force majeure', href: '/admin/force-majeure', icon: AlertOctagon, description: 'Event-impacting flags to triage.' },
  { key: 'reviews', label: 'Reviews', href: '/admin/reviews', icon: Star, description: 'Review appeals awaiting a decision.' },
  { key: 'concierge-abuse', label: 'Setnayan AI abuse', href: '/admin/concierge-abuse', icon: Flag, description: 'Trial-cycling flags to review.' },
  { key: 'account-deletions', label: 'Account deletions', href: '/admin/account-deletions', icon: UserX, description: 'Self-serve account-deletion requests to review.' },
  { key: 'approvals', label: 'Two-admin approvals', href: '/admin/approvals', icon: CheckCheck, description: 'A colleague is waiting on your second sign-off.' },
  { key: 'help', label: 'Help', href: '/admin/help', icon: LifeBuoy, description: 'Open help-center tickets.' },
  { key: 'vendor-partnerships', label: 'Partnerships', href: '/admin/vendor-partnerships', icon: Handshake, description: 'Vendor-to-vendor partnership claims awaiting two-admin verification.' },
  { key: 'user-reports', label: 'User reports', href: '/admin/user-reports', icon: MessageSquareWarning, description: 'Reported guest-gallery content awaiting moderation.' },
];

// Compact age string from the oldest open item: 45m · 6h · 3d.
function ageShort(iso: string | null, nowMs: number): string | null {
  if (!iso) return null;
  const mins = Math.max(0, Math.floor((nowMs - new Date(iso).getTime()) / 60_000));
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 48) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

// Worklist priority: overdue first, then due-soon, then open work (busiest),
// then unknown, then clear — canonical order breaks ties within a band.
const DUE_RANK: Record<string, number> = {
  overdue: 0,
  'due-soon': 1,
  ok: 2,
  unknown: 3,
  clear: 4,
};

export default async function AdminWorkLanding() {
  // One round-trip per queue (count + oldest-open age). Fails open: a thrown
  // query degrades the whole feed to "all clear" rather than 500-ing.
  const digest = await getAdminQueueDigest().catch(() => ({}) as AdminQueueDigest);
  const nowMs = Date.now();

  const rows: TriageItem[] = BASE_ROWS.map((base, index) => {
    const d = digest[base.key] ?? { count: null, oldestAt: null };
    const meta = ADMIN_QUEUE_META[base.key];
    const slaHours = meta?.slaHours ?? 48;
    const dueState = computeDueState(d, slaHours, nowMs);
    const age = ageShort(d.oldestAt, nowMs);

    let ageLabel: string | undefined;
    if (age && dueState === 'overdue') ageLabel = `Oldest ${age} · past SLA`;
    else if (age && dueState === 'due-soon') ageLabel = `Oldest ${age} · due soon`;
    else if (age && dueState === 'ok') ageLabel = `Oldest ${age}`;

    return {
      ...base,
      count: d.count,
      lane: meta?.lane,
      dueState,
      ageLabel,
      _index: index,
    } as TriageItem & { _index: number };
  });

  const ordered = (rows as (TriageItem & { _index: number })[])
    .slice()
    .sort((a, b) => {
      const ra = DUE_RANK[a.dueState ?? 'unknown'] ?? 3;
      const rb = DUE_RANK[b.dueState ?? 'unknown'] ?? 3;
      if (ra !== rb) return ra - rb;
      const ca = a.count ?? 0;
      const cb = b.count ?? 0;
      if (cb !== ca) return cb - ca;
      return a._index - b._index;
    })
    .map(({ _index, ...row }) => row as TriageItem);

  const totalOpen = rows.reduce(
    (sum, row) => sum + Math.max(0, row.count ?? 0),
    0,
  );

  return <QueuesTriageFeed title="Work" items={ordered} totalOpen={totalOpen} />;
}
