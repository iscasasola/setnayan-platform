import { cache } from 'react';
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
type QueueDef = {
  key: string;
  table: string;
  /**
   * The consequence bucket the worklist groups by (what breaks if you don't
   * act): money = cash/reconciliation, trust = legal / recourse / compliance
   * clock, growth = a vendor/revenue is waiting, support = couples + vendors
   * waiting on help.
   */
  lane: AdminQueueLane;
  /**
   * How long the OLDEST open item may sit before the queue is "overdue" (the
   * clock that turns it red). OWNER-TUNABLE first-pass defaults.
   */
  /**
   * `null` = THIS QUEUE HAS NO CLOCK, because the admin is not the one who can
   * clear it. Watching is not a task.
   *
   * 🔑 A DEADLINE ON SOMEONE ELSE'S DECISION IS PERMANENT RED. Partnerships is
   * the worked example: the rows are proposals awaiting the RECIPIENT VENDOR's
   * answer, and the only admin control is a veto. A 72-hour promise on that can
   * never be met by any admin action, so every solo admin was shown a red
   * past-promise row forever — the same noise that got payouts removed from
   * this list, arriving by a different route.
   */
  slaHours: number | null;
  /** Applies the queue's "open work" filter to a select()-ed builder. */
  filter: (q: any, ctx: { nowIso: string }) => any;
  /**
   * Timestamp column the command center ages the oldest open item from.
   * Defaults to 'created_at' (present on 13/14 queue tables, verified against
   * prod 2026-06-28). Override where a table names it differently.
   */
  tsCol?: string;
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
  // lane TRUST — owner, 2026-08-04: "go with verify". Reading a government ID
  // and deciding whether a business is who it says it is is trust work, not
  // growth. It sat in `growth` because a vendor is waiting for a badge — that is
  // what the queue FEELS like to the vendor, not what the admin is actually
  // doing. The practical cost was that filtering the work list by Trust hid
  // every pending verification, which is the first thing you would expect to
  // find there.
  {
    key: 'verify',
    table: 'vendor_verification_applications',
    lane: 'trust',
    slaHours: 48,
    filter: (q) => q.eq('status', 'pending_review'),
  },
  {
    key: 'payments',
    table: 'payments',
    lane: 'money',
    slaHours: 24,
    filter: (q) => q.eq('status', 'pending'),
  },
  // lane money — a vendor is waiting for money.
  {
    key: 'payouts',
    table: 'vendor_payouts',
    lane: 'money',
    slaHours: 48,
    filter: (q) => q.is('paid_at', null).eq('on_hold', false),
  },
  {
    key: 'token-purchases',
    table: 'vendor_token_purchases',
    lane: 'money',
    slaHours: 24,
    filter: (q) => q.eq('status', 'pending_payment'),
  },
  {
    key: 'subscriptions',
    table: 'vendor_subscriptions',
    lane: 'money',
    slaHours: 24,
    filter: (q) => q.eq('status', 'pending_payment'),
  },
  // lane trust — fraud screen.
  {
    key: 'payment-options',
    table: 'vendor_payment_methods',
    lane: 'trust',
    slaHours: 48,
    filter: (q) => q.in('moderation_status', ['pending_review', 'held']),
  },
  // lane trust — recourse clock.
  {
    key: 'disputes',
    table: 'vendor_disputes',
    lane: 'trust',
    slaHours: 24,
    filter: (q) => q.eq('status', 'open'),
  },
  // lane trust — event-impacting.
  {
    key: 'force-majeure',
    table: 'force_majeure_flags',
    lane: 'trust',
    slaHours: 24,
    filter: (q) => q.in('status', ['open', 'under_review']),
  },
  {
    // vendor_review_appeals has no created_at (verified vs prod) — it ages on
    // submitted_at, when the vendor filed the appeal.
    key: 'reviews',
    table: 'vendor_review_appeals',
    lane: 'support',
    slaHours: 72,
    filter: (q) => q.is('decided_at', null),
    tsCol: 'submitted_at',
  },
  {
    key: 'concierge-abuse',
    table: 'concierge_abuse_flags',
    lane: 'trust',
    slaHours: 48,
    filter: (q) => q.eq('status', 'pending_review'),
  },
  // lane trust — RA 10173 / store rule.
  {
    key: 'account-deletions',
    table: 'account_deletion_requests',
    lane: 'trust',
    slaHours: 24,
    filter: (q) => q.eq('status', 'pending'),
  },
  // lane trust · 12h — a colleague is BLOCKED on you.
  {
    key: 'approvals',
    table: 'admin_approval_requests',
    lane: 'trust',
    slaHours: 12,
    filter: (q, { nowIso }) => q.eq('status', 'pending').gt('expires_at', nowIso),
  },
  {
    key: 'help',
    table: 'help_messages',
    lane: 'support',
    slaHours: 24,
    filter: (q) => q.in('status', ['new', 'in_progress']),
  },
  // Vendor partnerships — under mutual-accept, visibility is gated on
  // status='accepted' (recipient-settable), NOT the now-inert admin_verified
  // flag. HQ oversight = live PROPOSALS that a recipient hasn't yet accepted /
  // declined / that haven't been withdrawn. Keying on admin_verified would
  // never drain (it defaults false and nothing flips it anymore).
  {
    key: 'vendor-partnerships',
    table: 'vendor_partnerships',
    lane: 'growth',
    // NO CLOCK — see the slaHours doc above. These rows wait on the RECIPIENT
    // VENDOR, not on us; the only admin control is a veto. The 72-hour promise
    // could never be met by any admin action, so it produced a permanently red
    // row for every solo admin.
    slaHours: null,
    filter: (q) => q.eq('status', 'proposed').eq('is_active', true),
  },
  // User reports — UGC moderation queue (Apple 1.2 / Play UGC). status='open'
  // is the actionable cut (open → actioned/dismissed).
  {
    key: 'user-reports',
    table: 'user_reports',
    lane: 'trust',
    slaHours: 24,
    filter: (q) => q.eq('status', 'open'),
  },
  // Integrity watch — review-fraud + ghost-listing flags awaiting a verdict
  // (integrity_flags · status='open'). Both kinds share one queue; the badge is
  // the combined open count.
  {
    key: 'integrity-watch',
    table: 'integrity_flags',
    lane: 'trust',
    slaHours: 72,
    filter: (q) => q.eq('status', 'open'),
  },
];

/**
 * Per-queue metadata the command center ranks by — DERIVED from QUEUE_DEFS
 * (council fix #13, 2026-07-09). These were two hand-maintained lists with no
 * enforced link: a QUEUE_DEF without a META row got a sidebar badge but was
 * dropped from totalOpen/overdue; a META row without a DEF permanently
 * inflated unknownCount. Deriving makes key-set drift structurally impossible
 * (which is also why this carries no drift tripwire test — there is no second
 * list left to drift). Same keys, same values as the old hand-written map.
 */
/**
 * The table + "open work" filter for one queue, for consumers that need to LIST
 * the rows the count counted — currently the work-list drawer (queue-peek.ts).
 *
 * 🔑 THE NUMBER AND THE LIST MUST COME FROM ONE PREDICATE. The drawer originally
 * re-typed each filter by hand. Three matched by luck; PAYOUTS did not — the row
 * counted `paid_at IS NULL AND NOT on_hold` (the V2 payout model) while the
 * drawer listed `released_at IS NULL` (the V1 one). Both columns exist on the
 * table, so nothing errors: the badge says one thing and the list underneath it
 * shows another, forever, in silence. Reading the filter from here instead of
 * copying it removes the whole class.
 */
export function getQueueSource(
  key: string,
): { table: string; filter: (q: any, ctx: { nowIso: string }) => any } | null {
  const def = QUEUE_DEFS.find((d) => d.key === key);
  return def ? { table: def.table, filter: def.filter } : null;
}

export const ADMIN_QUEUE_META: Record<
  string,
  { lane: AdminQueueLane; slaHours: number | null }
> = Object.fromEntries(
  QUEUE_DEFS.map((d) => [d.key, { lane: d.lane, slaHours: d.slaHours }]),
);

// DELIBERATELY NOT in QUEUE_DEFS (so they carry NO badge/urgency) — their
// "pending count" and/or actionable age is COMPUTED, not a single-table head-
// count, so an approximate filter would show a WRONG number (worse than none):
//   • pax-changes      — pax_change_audit joined across vendor_profiles + events
//   • completions      — event_vendors, multi-column actionable age (vendor-marked
//                        vs disputed) + a JS "stuck" cut the DB can't replicate
//   • social-queue     — social_posts auto-publish states ≠ "awaiting admin"
//   • pakanta          — orders filtered to the Pakanta SKU (cross-table)
//   • editorial-review — event_editorial flag severity computed from a jsonb array
// These keep their /admin/<route> pages; closing this would need per-queue
// count RPCs, tracked as a follow-up — NOT a silent omission.

const num = (c: number | null | undefined): number | null =>
  typeof c === 'number' ? c : null;

/**
 * The badge-number shape: keyed by nav-item key, `number` = open count, `null`
 * = query unavailable. Counts are derived from the digest below (one fetch path
 * — the digest already returns the count, so no separate head-count query).
 */
export type AdminQueueCounts = Record<string, number | null>;

// ── Digest — the single fetch: count + oldest-open age per queue, for badges,
//    the topbar pill, AND the command-center worklist (cache()'d per request) ──

export type AdminQueueDigestRow = { count: number | null; oldestAt: string | null };
export type AdminQueueDigest = Record<string, AdminQueueDigestRow>;

/**
 * Richer than the badge counts: per queue, the open count AND the oldest open
 * item's timestamp, in ONE round-trip each (count:'exact' + oldest-first +
 * limit(1) returns both). A table without a `created_at` column degrades to
 * oldestAt:null (that queue ranks by volume only) — never blocks the feed.
 */
export const getAdminQueueDigest = cache(async (): Promise<AdminQueueDigest> => {
  const admin = createAdminClient();
  const nowIso = new Date().toISOString();
  const results = await Promise.all(
    QUEUE_DEFS.map((d) => {
      const ts = d.tsCol ?? 'created_at';
      return d
        .filter(admin.from(d.table).select(ts, { count: 'exact' }), { nowIso })
        .order(ts, { ascending: true })
        .limit(1);
    }),
  );
  const out: AdminQueueDigest = {};
  QUEUE_DEFS.forEach((d, i) => {
    const ts = d.tsCol ?? 'created_at';
    const r = results[i];
    const oldestAt =
      Array.isArray(r?.data) && r.data[0]?.[ts] ? String(r.data[0][ts]) : null;
    out[d.key] = { count: num(r?.count), oldestAt };
  });
  return out;
});

/**
 * Compact age label for an oldest-open timestamp ("38m" · "5h" · "3d").
 * Lifted from the /admin/work command center (council fix #11) so the
 * Overview's queue tiles can render the same oldest-item age. Floors at each
 * unit boundary — never overstates an age. Null in, null out.
 */
export function ageShort(iso: string | null, nowMs: number): string | null {
  if (!iso) return null;
  const mins = Math.max(0, Math.floor((nowMs - new Date(iso).getTime()) / 60_000));
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 48) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
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
  slaHours: number | null,
  nowMs: number,
): AdminQueueDueState {
  if (row.count === null) return 'unknown';
  if (row.count <= 0) return 'clear';
  // No clock ⇒ never late and never nearly-late. It still shows its count, so
  // the work is visible; it just stops claiming a promise nobody made.
  if (slaHours === null) return 'ok';
  if (!row.oldestAt) return 'unknown';
  const ageHours = (nowMs - new Date(row.oldestAt).getTime()) / 3_600_000;
  if (ageHours >= slaHours) return 'overdue';
  if (ageHours >= slaHours * 0.75) return 'due-soon';
  return 'ok';
}

/** Per-queue urgency + the rolled-up tallies the nav chrome escalates on. */
export type QueueUrgency = {
  /** dueState per nav-item key (only queues with open work appear). */
  states: Record<string, AdminQueueDueState>;
  /** Queues with at least one item past its SLA. */
  overdue: number;
  /** Queues approaching SLA (last quarter of the window). */
  dueSoon: number;
  /** Sum of open items across all queues. */
  totalOpen: number;
  /**
   * Queues whose count came back NULL (query degraded/unavailable). Lets a
   * caller tell "genuinely all-clear" (totalOpen 0, unknownCount 0) from a
   * "read failed" all-clear (totalOpen 0, unknownCount > 0) — so an outage
   * never renders a falsely reassuring "all clear".
   */
  unknownCount: number;
};

/**
 * Collapses a digest into the urgency signal the nav surfaces share: a
 * per-queue dueState (so a badge is red only when something is ACTUALLY overdue,
 * not merely because the queue is "important"), plus the overdue/due-soon queue
 * tallies the topbar escalates on. Pure — pass Date.now() so callers control the
 * clock (and tests can pin it).
 */
export function deriveQueueUrgency(
  digest: AdminQueueDigest,
  nowMs: number,
): QueueUrgency {
  const states: Record<string, AdminQueueDueState> = {};
  let overdue = 0;
  let dueSoon = 0;
  let totalOpen = 0;
  let unknownCount = 0;
  for (const [key, meta] of Object.entries(ADMIN_QUEUE_META)) {
    const row = digest[key];
    if (!row || row.count === null) {
      unknownCount += 1; // queue missing from digest, or its count query degraded
      if (row) states[key] = computeDueState(row, meta.slaHours, nowMs);
      continue;
    }
    totalOpen += Math.max(0, row.count);
    const state = computeDueState(row, meta.slaHours, nowMs);
    states[key] = state;
    if (state === 'overdue') overdue += 1;
    else if (state === 'due-soon') dueSoon += 1;
  }
  return { states, overdue, dueSoon, totalOpen, unknownCount };
}
