import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Admin Work-queue counting + urgency — the single source of truth behind the
 * nav badges (getAdminQueueCounts) AND the command-center worklist
 * (getAdminQueueDigest). Both build off ONE filter table (QUEUE_DEFS) so a
 * queue's "open" definition is written once and can never drift between the two
 * (it had drifted before this consolidation: verify counted `coming_soon` in
 * one copy vs `pending_review` in another).
 */

export type AdminQueueLane = 'money' | 'trust' | 'growth' | 'support';

/**
 * Per-queue metadata the command center ranks by.
 *   slaHours — how long the OLDEST open item may sit before the queue is
 *              "overdue" (the clock that turns it red). OWNER-TUNABLE: these are
 *              a first-pass default; tune per real ops experience.
 *   lane     — the consequence bucket the worklist groups by (what breaks if
 *              you don't act): money = cash/reconciliation, trust = legal /
 *              recourse / compliance clock, growth = a vendor/revenue is
 *              waiting, support = couples + vendors waiting on help.
 *
 * Urgency today is derived from the oldest open item's AGE vs slaHours. A
 * future refinement is a true per-row due_at where a queue needs item-specific
 * deadlines (e.g. a dispute filed today vs one filed last week) rather than a
 * single oldest-item proxy.
 */
export const ADMIN_QUEUE_META: Record<
  string,
  { lane: AdminQueueLane; slaHours: number }
> = {
  approvals: { lane: 'trust', slaHours: 12 }, // a colleague is BLOCKED on you
  disputes: { lane: 'trust', slaHours: 24 }, // recourse clock
  'force-majeure': { lane: 'trust', slaHours: 24 }, // event-impacting
  'account-deletions': { lane: 'trust', slaHours: 24 }, // RA 10173 / store rule
  payments: { lane: 'money', slaHours: 24 },
  'token-purchases': { lane: 'money', slaHours: 24 },
  subscriptions: { lane: 'money', slaHours: 24 },
  payouts: { lane: 'money', slaHours: 48 }, // a vendor is waiting for money
  'payment-options': { lane: 'trust', slaHours: 48 }, // fraud screen
  'concierge-abuse': { lane: 'trust', slaHours: 48 },
  help: { lane: 'support', slaHours: 24 },
  reviews: { lane: 'support', slaHours: 72 },
  verify: { lane: 'growth', slaHours: 48 }, // a vendor is waiting for the badge
  'vendor-partnerships': { lane: 'growth', slaHours: 72 },
};

type QueueDef = {
  key: string;
  table: string;
  /** Applies the queue's "open work" filter to a select()-ed builder. */
  filter: (q: any, ctx: { nowIso: string }) => any;
};

/**
 * SINGLE SOURCE OF TRUTH for every Work queue's "open" filter. Each filter MUST
 * mirror the destination page's own filter so the count matches the rows the
 * admin sees on arrival. Both consumers below build off this list.
 */
const QUEUE_DEFS: QueueDef[] = [
  // Verify — applications awaiting review (vendor_verification_applications ·
  // pending_review), NOT the secondary visibility surface (vendor_profiles
  // coming_soon). This is the filter the earlier drift got wrong.
  {
    key: 'verify',
    table: 'vendor_verification_applications',
    filter: (q) => q.eq('status', 'pending_review'),
  },
  { key: 'payments', table: 'payments', filter: (q) => q.eq('status', 'pending') },
  {
    key: 'payouts',
    table: 'vendor_payouts',
    filter: (q) => q.is('paid_at', null).eq('on_hold', false),
  },
  {
    key: 'token-purchases',
    table: 'vendor_token_purchases',
    filter: (q) => q.eq('status', 'pending_payment'),
  },
  {
    key: 'subscriptions',
    table: 'vendor_subscriptions',
    filter: (q) => q.eq('status', 'pending_payment'),
  },
  {
    key: 'payment-options',
    table: 'vendor_payment_methods',
    filter: (q) => q.in('moderation_status', ['pending_review', 'held']),
  },
  { key: 'disputes', table: 'vendor_disputes', filter: (q) => q.eq('status', 'open') },
  {
    key: 'force-majeure',
    table: 'force_majeure_flags',
    filter: (q) => q.in('status', ['open', 'under_review']),
  },
  {
    key: 'reviews',
    table: 'vendor_review_appeals',
    filter: (q) => q.is('decided_at', null),
  },
  {
    key: 'concierge-abuse',
    table: 'concierge_abuse_flags',
    filter: (q) => q.eq('status', 'pending_review'),
  },
  {
    key: 'account-deletions',
    table: 'account_deletion_requests',
    filter: (q) => q.eq('status', 'pending'),
  },
  {
    key: 'approvals',
    table: 'admin_approval_requests',
    filter: (q, { nowIso }) => q.eq('status', 'pending').gt('expires_at', nowIso),
  },
  {
    key: 'help',
    table: 'help_messages',
    filter: (q) => q.in('status', ['new', 'in_progress']),
  },
  // Vendor partnerships — unverified + active = awaiting HQ two-admin review.
  {
    key: 'vendor-partnerships',
    table: 'vendor_partnerships',
    filter: (q) => q.eq('admin_verified', false).eq('is_active', true),
  },
];

const num = (c: number | null | undefined): number | null =>
  typeof c === 'number' ? c : null;

// ── Counts (nav badges · runs on EVERY admin page · head-only, cheapest) ──

/** Keyed by nav-item key; `number` = open count, `null` = query unavailable. */
export type AdminQueueCounts = Record<string, number | null>;

export async function getAdminQueueCounts(): Promise<AdminQueueCounts> {
  const admin = createAdminClient();
  const nowIso = new Date().toISOString();
  const head = { count: 'exact', head: true } as const;
  const results = await Promise.all(
    QUEUE_DEFS.map((d) => d.filter(admin.from(d.table).select('*', head), { nowIso })),
  );
  const out: AdminQueueCounts = {};
  QUEUE_DEFS.forEach((d, i) => {
    out[d.key] = num(results[i]?.count);
  });
  return out;
}

// ── Digest (command center · ONE page · count + oldest-open age for ranking) ──

export type AdminQueueDigestRow = { count: number | null; oldestAt: string | null };
export type AdminQueueDigest = Record<string, AdminQueueDigestRow>;

/**
 * Richer than the badge counts: per queue, the open count AND the oldest open
 * item's timestamp, in ONE round-trip each (count:'exact' + oldest-first +
 * limit(1) returns both). A table without a `created_at` column degrades to
 * oldestAt:null (that queue ranks by volume only) — never blocks the feed.
 */
export async function getAdminQueueDigest(): Promise<AdminQueueDigest> {
  const admin = createAdminClient();
  const nowIso = new Date().toISOString();
  const results = await Promise.all(
    QUEUE_DEFS.map((d) =>
      d
        .filter(admin.from(d.table).select('created_at', { count: 'exact' }), { nowIso })
        .order('created_at', { ascending: true })
        .limit(1),
    ),
  );
  const out: AdminQueueDigest = {};
  QUEUE_DEFS.forEach((d, i) => {
    const r = results[i];
    const oldestAt =
      Array.isArray(r?.data) && r.data[0]?.created_at
        ? String(r.data[0].created_at)
        : null;
    out[d.key] = { count: num(r?.count), oldestAt };
  });
  return out;
}

export type AdminQueueDueState =
  | 'overdue'
  | 'due-soon'
  | 'ok'
  | 'clear'
  | 'unknown';

/**
 * Urgency of a queue from its oldest open item's age vs its SLA window.
 *   clear    — nothing open
 *   unknown  — count unavailable, or no timestamp to age from
 *   overdue  — oldest item has passed slaHours (worklist RED · top priority)
 *   due-soon — oldest item is in the last quarter of its SLA window (AMBER)
 *   ok       — open work, comfortably inside SLA
 */
export function computeDueState(
  row: AdminQueueDigestRow,
  slaHours: number,
  nowMs: number,
): AdminQueueDueState {
  if (row.count === null) return 'unknown';
  if (row.count <= 0) return 'clear';
  if (!row.oldestAt) return 'unknown';
  const ageHours = (nowMs - new Date(row.oldestAt).getTime()) / 3_600_000;
  if (ageHours >= slaHours) return 'overdue';
  if (ageHours >= slaHours * 0.75) return 'due-soon';
  return 'ok';
}
