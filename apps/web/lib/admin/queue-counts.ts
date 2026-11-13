import { cache } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import {
  completionStuckReason,
  completionStuckSince,
  type CompletionCandidate,
} from '@/lib/admin/completions-stuck';
import { ACTIVE_STATUSES, BUNDLE_CHILD_SKUS } from '@/lib/entitlements';
import { FAILED_DELIVERY_EVENTS, SUMMARY_WINDOW_MS } from '@/lib/email-delivery-log';

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
 * THE ONE ORDER THE LANES ARE SHOWN IN.
 *
 * 🔴 WHY IT LIVES HERE. Until 2026-08-25 there were TWO `LANE_ORDER` constants,
 * neither aware of the other, ranking the same four lanes in OPPOSITE orders:
 * the admin triage feed led with `money`, the daily digest email led with
 * `trust`. Same queues, same person, two answers about what to do first — and
 * the disagreement was invisible because each file was internally consistent.
 * It lives beside the lane TYPE now, so a fifth lane cannot be added without
 * meeting the order it will be shown in.
 *
 * ⚖ TRUST FIRST, and the reason is the clock rather than the money. `trust` is
 * the only lane carrying a STATUTORY deadline — RA 10173 erasure requests,
 * disputes, recourse. A compliance deadline missed is not recoverable; a payment
 * confirmed an hour later is. `money` follows immediately because a real person
 * is waiting on it, then `growth` (a vendor waiting), then `support`.
 */
export const ADMIN_LANE_ORDER: readonly AdminQueueLane[] = Object.freeze([
  'trust',
  'money',
  'growth',
  'support',
]);

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
  /**
   * A queue whose open work CANNOT be a single-table head-count reads itself.
   *
   * 🔴 WHY THIS EXISTS. `completions` was added here on 2026-08-19 with a plain
   * `.in('completion_status', …)` filter — but its destination page has always
   * applied a second cut needing the CELEBRATION DATE, which lives on another
   * table. So the badge counted 45 while the page listed 1, and it aged on
   * `created_at` (when a couple typed a supplier's name in) so it rendered RED.
   * An escape hatch beats a filter that quietly means something else: when
   * `digest` is set it replaces the generic count, and the queue is obliged to
   * return the same rows its page shows.
   */
  digest?: (admin: SupabaseClient, nowMs: number) => Promise<AdminQueueDigestRow>;
  /** Applies the queue's "open work" filter to a select()-ed builder. */
  filter: (q: any, ctx: { nowIso: string }) => any;
  /**
   * Timestamp column the command center ages the oldest open item from.
   * Defaults to 'created_at' (present on 13/14 queue tables, verified against
   * prod 2026-06-28). Override where a table names it differently.
   */
  tsCol?: string;
  /**
   * A TRAIL TO WATCH, NOT A DECISION TO MAKE (admin slice 4, 2026-11-13). Its
   * count is the last week's new rows — guest-count cost changes, refunds a
   * supplier recorded — which HQ observes but cannot "clear". It shows its
   * number everywhere a queue does, and is left out of every "N items need
   * you" total, because a trail that can never drain would keep that total
   * permanently above zero.
   */
  watchOnly?: true;
  /**
   * The line the morning digest prints for this queue BY NAME (admin slice 4).
   * Set on the queues that had no badge and no digest line before 2026-11-13 —
   * the audit's "silent queues". `null` counts print "couldn't count", never 0.
   */
  digestLine?: { label: string; say: (n: number) => string };
};

/** The week a watch-only trail counts — the same window Email delivery summarises. */
export const WATCH_WINDOW_MS = SUMMARY_WINDOW_MS;

/**
 * Head-count + oldest timestamp for one filtered table, failing to NULL.
 * The building block for the `digest` counts below that sum several tables.
 */
async function countAndOldest(
  // A PostgREST builder, already filtered — duck-typed like every filter here.
  q: any,
  ts: string,
): Promise<AdminQueueDigestRow | null> {
  const r = await q.order(ts, { ascending: true }).limit(1);
  if (r?.error || typeof r?.count !== 'number') return null;
  const rows = r.data as Record<string, unknown>[] | null | undefined;
  const oldestAt = Array.isArray(rows) && rows[0]?.[ts] ? String(rows[0][ts]) : null;
  return { count: r.count, oldestAt };
}

/** Sum several counts; ANY failed part makes the whole count unknown. */
function sumCounts(parts: Array<AdminQueueDigestRow | null>): AdminQueueDigestRow {
  if (parts.some((p) => p === null || p.count === null)) return { count: null, oldestAt: null };
  const rows = parts as AdminQueueDigestRow[];
  const oldests = rows.map((p) => p.oldestAt).filter((v): v is string => Boolean(v));
  return {
    count: rows.reduce((n, p) => n + (p.count ?? 0), 0),
    oldestAt: oldests.length > 0 ? oldests.reduce((a, b) => (a < b ? a : b)) : null,
  };
}

/**
 * REPOST WATCH — BOTH tables /admin/repost-watch lists as open: reposted
 * pictures (`vendor_image_flags`) AND payment QR codes found inside media
 * (`vendor_qr_media_flags`). This is the "two tables" reason it stayed out of
 * QUEUE_DEFS; `countOpenDisputes` showed the shape, and this copies it.
 */
export async function countRepostWatch(
  admin: SupabaseClient,
  _nowMs: number,
): Promise<AdminQueueDigestRow> {
  const [images, qr] = await Promise.all([
    countAndOldest(
      admin.from('vendor_image_flags').select('created_at', { count: 'exact' }).eq('status', 'open'),
      'created_at',
    ),
    countAndOldest(
      admin.from('vendor_qr_media_flags').select('created_at', { count: 'exact' }).eq('status', 'open'),
      'created_at',
    ),
  ]);
  if (!images) logQueryError('countRepostWatch (vendor_image_flags)', null, {}, 'graceful_degrade');
  if (!qr) logQueryError('countRepostWatch (vendor_qr_media_flags)', null, {}, 'graceful_degrade');
  return sumCounts([images, qr]);
}

/**
 * SOCIAL QUEUE — the two lanes of /admin/studio?tab=social-queue that wait on a
 * PERSON: an auto-post that FAILED (it will not retry itself), and a couple who
 * took back their consent AFTER we posted (the post must come down). Scheduled
 * and publishing posts run themselves and are not counted.
 */
export async function countSocialQueue(
  admin: SupabaseClient,
  _nowMs: number,
): Promise<AdminQueueDigestRow> {
  const [failed, takedowns] = await Promise.all([
    countAndOldest(
      admin.from('social_posts').select('updated_at', { count: 'exact' }).eq('status', 'failed'),
      'updated_at',
    ),
    countAndOldest(
      admin
        .from('marketing_share_consents')
        .select('revoked_at', { count: 'exact' })
        .not('revoked_at', 'is', null)
        .not('posted_at', 'is', null)
        .is('taken_down_at', null),
      'revoked_at',
    ),
  ]);
  if (!failed) logQueryError('countSocialQueue (social_posts failed)', null, {}, 'graceful_degrade');
  if (!takedowns) logQueryError('countSocialQueue (take-downs)', null, {}, 'graceful_degrade');
  return sumCounts([failed, takedowns]);
}

/**
 * MUSIC MAKER (Pakanta) — songs still to write: an event holding a PAID order
 * that grants the song (direct or in a bundle, `ACTIVE_STATUSES`), or a brief
 * marked purchased, whose song is not yet delivered. The same rows
 * /admin/pakanta tags "write the song".
 *
 * ⚖ CHEAP BY DESIGN. The page confirms each order event with
 * `eventSkuActive`, several reads per event; a count that runs on every admin
 * page load cannot. It reads the paid order itself instead — the same status
 * set `eventSkuActive` checks first — so the two differ only for an
 * entitlement that comes from somewhere other than a paid order (a comp, a
 * promo window), which this count leaves out rather than guesses at.
 */
export async function countMusicMakerToWrite(
  admin: SupabaseClient,
  _nowMs: number,
): Promise<AdminQueueDigestRow> {
  const keys = ['PAKANTA', ...bundlesGrantingPakanta()];
  const [orders, drafts] = await Promise.all([
    admin
      .from('orders')
      .select('event_id, created_at')
      .in('service_key', keys)
      .in('status', Array.from(ACTIVE_STATUSES))
      .limit(500),
    admin
      .from('pakanta_intake_drafts')
      .select('event_id, status, updated_at')
      .order('updated_at', { ascending: false })
      .limit(200),
  ]);
  if (orders.error || !Array.isArray(orders.data)) {
    logQueryError('countMusicMakerToWrite (orders)', orders.error ?? null, {}, 'graceful_degrade');
    return { count: null, oldestAt: null };
  }
  if (drafts.error || !Array.isArray(drafts.data)) {
    logQueryError('countMusicMakerToWrite (drafts)', drafts.error ?? null, {}, 'graceful_degrade');
    return { count: null, oldestAt: null };
  }
  // Since when each event has been owed its song (oldest paid order, or the brief).
  const owedSince = new Map<string, string>();
  for (const o of orders.data as Array<{ event_id: string | null; created_at: string }>) {
    if (!o.event_id) continue;
    const prev = owedSince.get(o.event_id);
    if (!prev || o.created_at < prev) owedSince.set(o.event_id, o.created_at);
  }
  const seenDraft = new Set<string>();
  for (const d of drafts.data as Array<{ event_id: string; status: string; updated_at: string }>) {
    // Newest first, so the first row per event is its current brief (as the page reads it).
    if (seenDraft.has(d.event_id)) continue;
    seenDraft.add(d.event_id);
    if (d.status === 'purchased' && !owedSince.has(d.event_id)) owedSince.set(d.event_id, d.updated_at);
  }
  if (owedSince.size === 0) return { count: 0, oldestAt: null };
  const { data: events, error } = await admin
    .from('events')
    .select('event_id, pakanta_song_status, pakanta_song_r2_key')
    .in('event_id', Array.from(owedSince.keys()));
  if (error || !Array.isArray(events)) {
    logQueryError('countMusicMakerToWrite (events)', error ?? null, {}, 'graceful_degrade');
    return { count: null, oldestAt: null };
  }
  const delivered = new Set(
    (events as Array<{ event_id: string; pakanta_song_status: string | null; pakanta_song_r2_key: string | null }>)
      .filter((e) => e.pakanta_song_status === 'ready' && !!e.pakanta_song_r2_key)
      .map((e) => e.event_id),
  );
  let count = 0;
  let oldestAt: string | null = null;
  for (const [eventId, since] of owedSince) {
    if (delivered.has(eventId)) continue;
    count += 1;
    if (!oldestAt || since < oldestAt) oldestAt = since;
  }
  return { count, oldestAt };
}

/** The bundle codes that grant the song — derived, as /admin/pakanta derives them. */
function bundlesGrantingPakanta(): string[] {
  return (Object.entries(BUNDLE_CHILD_SKUS) as Array<[string, ReadonlyArray<string>]>)
    .filter(([, children]) => children.includes('PAKANTA'))
    .map(([bundleKey]) => bundleKey);
}

/**
 * EMAIL BOUNCES — emails of the last week that will not arrive: refused at
 * send, or reported by Resend as bounced / complained / failed / suppressed.
 * The same verdict Email delivery shows as "failed" (`verdictOf`), asked as a
 * head-count so it stays cheap on every admin page load.
 *
 * ⚠ "Not configured" (no Resend key) is NOT a bounce — nothing was sent. The
 * Email delivery strip already says that one out loud.
 */
export async function countEmailBounces(
  admin: SupabaseClient,
  nowMs: number,
): Promise<AdminQueueDigestRow> {
  const since = new Date(nowMs - WATCH_WINDOW_MS).toISOString();
  const events = FAILED_DELIVERY_EVENTS.join(',');
  const r = await countAndOldest(
    admin
      .from('email_deliveries')
      .select('created_at', { count: 'exact' })
      .gte('created_at', since)
      .or(`outcome.eq.send_failed,and(outcome.eq.accepted,last_event.in.(${events}))`),
    'created_at',
  );
  if (!r) {
    logQueryError('countEmailBounces', null, {}, 'graceful_degrade');
    return { count: null, oldestAt: null };
  }
  return r;
}

/**
 * SINGLE SOURCE OF TRUTH for every Work queue's "open" filter. Each filter MUST
 * mirror the destination page's own filter so the count matches the rows the
 * admin sees on arrival. Both consumers below build off this list.
 */
/**
 * The completions count, asking the SAME question /admin/completions asks.
 *
 * Embeds the celebration date (a PostgREST `!inner` join) so the shared stuck
 * rule can run, counts the survivors, and ages the queue from when each row
 * BECAME stuck rather than when it was created.
 *
 * ⚠ FAILS TO NULL, NEVER TO ZERO. A refused read must stay tellable from a real
 * empty — that is what `unknownCount` and "some counts unavailable" rest on.
 */
export async function countStuckCompletions(
  admin: SupabaseClient,
  nowMs: number,
): Promise<AdminQueueDigestRow> {
  const { data, error } = await admin
    .from('event_vendors')
    .select(
      /* 🚨 THE FOREIGN KEY IS NAMED ON PURPOSE. A bare `events!inner` from
         event_vendors is REFUSED by PostgREST (PGRST201): there is one direct FK
         but nineteen junction tables also join the two, so it cannot choose and
         rejects the whole query. Three sites had already died silently that way
         — a guard exists for it, and it caught this line. Without the hint this
         count would have read "unavailable" forever. */
      'completion_status, service_marked_complete_at, customer_confirmed_received_at, completion_disputed_at, marketplace_vendor_id, event:events!event_vendors_event_id_fkey!inner(event_date)',
    )
    .is('completion_resolved_at', null)
    .in('completion_status', ['disputed', 'awaiting_vendor', 'vendor_marked']);
  if (error || !Array.isArray(data)) {
    logQueryError('countStuckCompletions', error ?? null, {}, 'graceful_degrade');
    return { count: null, oldestAt: null };
  }
  let count = 0;
  let oldestAt: string | null = null;
  for (const raw of data) {
    const row = raw as unknown as CompletionCandidate & {
      completion_disputed_at: string | null;
      event: { event_date: string | null } | { event_date: string | null }[] | null;
    };
    /* An embedded to-one arrives as an object OR a one-element array depending
       on how PostgREST resolves the relationship. Handle both rather than
       assume — guessing here silently zeroes the whole queue. */
    const ev = Array.isArray(row.event) ? row.event[0] : row.event;
    const eventDate = ev?.event_date ?? null;
    const reason = completionStuckReason(row, eventDate, nowMs);
    if (!reason) continue;
    count += 1;
    const since = completionStuckSince(row, eventDate, reason);
    if (since && (!oldestAt || since < oldestAt)) oldestAt = since;
  }
  return { count, oldestAt };
}

/**
 * The `disputes` count, asking the same question the disputes PAGE asks.
 *
 * 🔴 WHY IT IS A DIGEST AND NOT A FILTER. /admin/disputes shows THREE kinds of
 * dispute: the `vendor_disputes` queue it always had, an installment's "it never
 * reached me" on `event_vendor_payments` (H4, 2026-09-11), and (since 2026-08-28) a
 * supplier's "the downpayment never reached me" (owner: "we will confirm it
 * manually"), which lives on `event_vendors` because vendor_disputes' own
 * CHECK (payout_id IS NOT NULL OR order_id IS NOT NULL) cannot be satisfied by
 * off-platform couple→supplier money. One def counts one table, so leaving the
 * plain filter here would UNDERCOUNT — the exact failure this file already
 * records for `completions` (badge 45, page 1) and warns about for
 * `repost-watch`. A lane that quietly reports less than its page is worse than
 * a lane that is absent.
 *
 * ⚠ AN OPEN DEPOSIT DISPUTE IS BOTH HALVES: refused AND not yet settled. The
 * second half is what makes a SECOND refusal a fresh question rather than one
 * that inherits the first settlement and never appears again.
 *
 * 🔑 EITHER SIDE FAILING DEGRADES THE WHOLE COUNT TO `null`, never to a
 * smaller number. `null` renders as "unavailable"; a partial sum renders as a
 * confident wrong total, which is how an admin is told there is less work
 * waiting than there is.
 */
export async function countOpenDisputes(
  admin: SupabaseClient,
  _nowMs: number,
): Promise<AdminQueueDigestRow> {
  const [classic, deposits, installments] = await Promise.all([
    admin
      .from('vendor_disputes')
      .select('created_at')
      .eq('status', 'open')
      .order('created_at', { ascending: true }),
    admin
      .from('event_vendors')
      .select('deposit_declined_at')
      .not('deposit_declined_at', 'is', null)
      .is('deposit_dispute_settled_at', null)
      .order('deposit_declined_at', { ascending: true }),
    // H4 (2026-09-11) — an installment's "it never reached me", the page's
    // third section. Same two halves: refused AND not yet settled.
    admin
      .from('event_vendor_payments')
      .select('payment_refused_at')
      .not('payment_refused_at', 'is', null)
      .is('payment_dispute_settled_at', null)
      .order('payment_refused_at', { ascending: true }),
  ]);

  if (classic.error || !Array.isArray(classic.data)) {
    logQueryError('countOpenDisputes (vendor_disputes)', classic.error ?? null, {}, 'graceful_degrade');
    return { count: null, oldestAt: null };
  }
  if (deposits.error || !Array.isArray(deposits.data)) {
    logQueryError('countOpenDisputes (deposit)', deposits.error ?? null, {}, 'graceful_degrade');
    return { count: null, oldestAt: null };
  }

  if (installments.error || !Array.isArray(installments.data)) {
    logQueryError('countOpenDisputes (installment)', installments.error ?? null, {}, 'graceful_degrade');
    return { count: null, oldestAt: null };
  }

  const count = classic.data.length + deposits.data.length + installments.data.length;
  const oldests = [
    (classic.data[0] as { created_at?: string } | undefined)?.created_at ?? null,
    (deposits.data[0] as { deposit_declined_at?: string } | undefined)?.deposit_declined_at ?? null,
    (installments.data[0] as { payment_refused_at?: string } | undefined)?.payment_refused_at ?? null,
  ].filter((v): v is string => Boolean(v));
  const oldestAt = oldests.length > 0 ? oldests.reduce((a, b) => (a < b ? a : b)) : null;
  return { count, oldestAt };
}

const QUEUE_DEFS: QueueDef[] = [
  /* ─── ADDED 2026-08-19 · THE OWNER WENT THROUGH THEM ONE BY ONE ───────────
     The Work page said "You're all caught up" while counting 14 queues and
     ignoring ten other queue-shaped admin surfaces. Asked which of the ten
     mattered, the owner answered each in turn. These four are real queues with
     a real intake, and each filter MIRRORS its destination page's own default —
     the rule this list already states, because a count that disagrees with the
     rows on arrival is its own defect.

     ⛔ THREE OF THE TEN ARE DELIBERATELY NOT HERE, and the reason matters more
     than the omission:
       · verification-docs — a document BROWSER (what a vendor uploaded to prove
         who they are), not work awaiting a decision.
       · data-privacy      — a compliance checklist plus the NPC document set.
       · repost-watch      — ✅ DONE 2026-11-13: it sums its TWO source tables
         through `countRepostWatch`, the `countOpenDisputes` shape, at the end
         of this list.
     ⛔ And payouts stays out — owner 2026-08-19: *"we do not have a payout."*
  ─────────────────────────────────────────────────────────────────────────── */
  {
    // Vendors who have not yet paid the fee that syncs them to an event. Owner:
    // payment comes BEFORE the sync, so this is "who has not paid yet", never a
    // debt accruing. Mirrors /admin/booking-fees.
    key: 'booking-fees',
    table: 'booking_fee_charges',
    lane: 'money',
    slaHours: 48,
    filter: (q) => q.eq('status', 'pending'),
  },
  {
    /*
      A booking whose completion both sides have not settled.

      ⚠ IT MIRRORS /admin/completions *THROUGH A SHARED PREDICATE*. This comment
      used to claim it mirrored the page "exactly" while the filter alone did
      not: `completion_status` DEFAULTS to 'awaiting_vendor', so the bare filter
      matched every event_vendors row ever inserted. Measured in prod
      2026-08-25 — badge 45, page 1, and 44 of the 45 were weddings 109 and 115
      days in the FUTURE. See lib/admin/completions-stuck.ts.
    */
    key: 'completions',
    table: 'event_vendors',
    lane: 'trust',
    slaHours: 72,
    // Kept so the shape stays uniform and a reader can see the coarse cut; the
    // COUNT comes from `digest` below, which also applies the celebration-date
    // half. Never re-point a consumer at this filter alone.
    filter: (q) =>
      q
        .is('completion_resolved_at', null)
        .in('completion_status', ['disputed', 'awaiting_vendor', 'vendor_marked']),
    digest: countStuckCompletions,
  },
  {
    // Messages flagged for trying to take a deal off-platform. Mirrors
    // /admin/chat-flags, whose own default is status 'open'.
    key: 'chat-flags',
    table: 'chat_message_flags',
    lane: 'trust',
    slaHours: 48,
    filter: (q) => q.eq('status', 'open'),
  },
  {
    /*
      A verified shop asking to fix a locked detail. Mirrors /admin/corrections,
      default status 'open'.

      ⚠ TWO DOCBLOCKS IN THAT FEATURE STILL SAY NOTHING CAN FILE ONE — that is
      STALE. `requestProfileCorrection` now has a caller:
      `app/vendor-dashboard/shop/_components/request-correction-card.tsx`. The
      comments were true when written and were never revisited, which is exactly
      why this queue looked permanently empty and stayed uncounted.
    */
    key: 'corrections',
    table: 'vendor_correction_requests',
    lane: 'support',
    slaHours: 72,
    filter: (q) => q.eq('status', 'open'),
  },
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
    // Coarse cut only — the COUNT comes from `digest`, which also counts the
    // deposit disputes this page has shown since 2026-08-28. Never re-point a
    // consumer at this filter alone; it sees one of the two tables.
    filter: (q) => q.eq('status', 'open'),
    digest: countOpenDisputes,
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
  /*
    lane MONEY, not trust — and the lane is the interesting choice.

    A couple asks us to remove a celebration ONLY when money is in the way: a
    bill we confirmed, or a payment nobody has checked yet. Every one of these
    rows is somebody waiting to hear what happens to what they paid, which is
    the money lane's whole definition. Filing it under trust would rank it above
    a payment awaiting confirmation while being, in substance, the same person
    waiting on the same money.

    ⚠ `status='pending'` ONLY. `self_removed` rows are reasons recorded on a
    removal that needed nobody's answer — there are far more of them, they are
    already final, and counting them would show a queue that can never drain.
  */
  {
    key: 'event-deletions',
    table: 'event_deletion_requests',
    lane: 'money',
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
  /* ─── ADDED 2026-11-13 · THE SILENT QUEUES (admin slice 4) ────────────────
     The solo-operator audit (Setnayan-specs prototypes/admin_five_tabs_2026-11-13/
     SOLO-OPERATOR-AUDIT.md, fact 4): "A queue the digest does not count fills
     silently." These ten had no badge on Work and no line in the morning digest.
     Each count mirrors its page's own "open" rows; each fails to NULL.

     ⏱ NONE OF THEM HAS A CLOCK (`slaHours: null`). A promise time is the
     owner's call, not a builder's guess — they show their number and never
     turn red until he sets one.
  ─────────────────────────────────────────────────────────────────────────── */
  {
    // Both tables /admin/repost-watch lists as open — see countRepostWatch.
    key: 'repost-watch',
    table: 'vendor_image_flags',
    lane: 'trust',
    slaHours: null,
    filter: (q) => q.eq('status', 'open'),
    digest: countRepostWatch,
    digestLine: { label: 'Repost watch', say: (n) => `${n} flagged ${n === 1 ? 'picture' : 'pictures'} to look at` },
  },
  {
    // The fraud runner's reversible auto-suspend (lib/fraud-enforcement-runner.ts
    // sets fraud_suspended_at). A ban is final and is not waiting on anyone, so
    // a banned shop is not counted. /admin/fraud tags these "Auto-suspended".
    key: 'fraud',
    table: 'vendor_profiles',
    lane: 'trust',
    slaHours: null,
    filter: (q) => q.not('fraud_suspended_at', 'is', null).is('fraud_banned_at', null),
    tsCol: 'fraud_suspended_at',
    digestLine: { label: 'Fraud queue', say: (n) => `${n} auto-suspended, ${n === 1 ? 'needs' : 'need'} your look` },
  },
  {
    // /admin/editorial-review's "Needs review" list. It BLOCKS the couple: their
    // editorial stays locked until a red flag is resolved.
    key: 'editorial-review',
    table: 'event_editorial',
    lane: 'trust',
    slaHours: null,
    filter: (q) => q.eq('scan_status', 'flagged'),
    tsCol: 'scan_completed_at',
    digestLine: { label: 'Editorial review', say: (n) => `${n} flagged ${n === 1 ? 'editorial' : 'editorials'} waiting — the couple is blocked` },
  },
  {
    // A read-only TRAIL (/admin/pax-changes: "HQ only observes"), so its count
    // is the last week's new rows, not an open state it never had.
    key: 'pax-changes',
    table: 'pax_change_audit',
    lane: 'support',
    slaHours: null,
    watchOnly: true,
    filter: (q, { nowIso }) =>
      q.gte('created_at', new Date(Date.parse(nowIso) - WATCH_WINDOW_MS).toISOString()),
    digestLine: { label: 'Pax changes', say: (n) => `${n} guest-count cost ${n === 1 ? 'change' : 'changes'} this week` },
  },
  {
    // Failed auto-posts + take-downs owed — see countSocialQueue.
    key: 'social-queue',
    table: 'social_posts',
    lane: 'support',
    slaHours: null,
    filter: (q) => q.eq('status', 'failed'),
    digest: countSocialQueue,
    digestLine: { label: 'Social queue', say: (n) => `${n} ${n === 1 ? 'post needs' : 'posts need'} you (failed or to take down)` },
  },
  {
    // Songs still to write — see countMusicMakerToWrite. Key stays `pakanta`
    // (the route); every word a person reads says Music Maker.
    key: 'pakanta',
    table: 'orders',
    lane: 'support',
    slaHours: null,
    filter: (q) => q.in('service_key', ['PAKANTA']).in('status', Array.from(ACTIVE_STATUSES)),
    digest: countMusicMakerToWrite,
    digestLine: { label: 'Music Maker', say: (n) => `${n} ${n === 1 ? 'song' : 'songs'} to write` },
  },
  {
    // Refunds suppliers RECORDED giving their clients — no money moves through
    // Setnayan and the page decides nothing, so it is a week's trail too.
    key: 'supplier-refunds',
    table: 'event_vendor_refunds',
    lane: 'support',
    slaHours: null,
    watchOnly: true,
    filter: (q, { nowIso }) =>
      q.is('removed_at', null).gte('created_at', new Date(Date.parse(nowIso) - WATCH_WINDOW_MS).toISOString()),
    digestLine: { label: 'Supplier refunds', say: (n) => `${n} ${n === 1 ? 'refund' : 'refunds'} recorded this week` },
  },
  {
    // A service we do not list yet — /admin/categories/requests, status pending.
    key: 'service-requests',
    table: 'taxonomy_category_requests',
    lane: 'growth',
    slaHours: null,
    filter: (q) => q.eq('status', 'pending'),
    digestLine: { label: 'Service requests', say: (n) => `${n} ${n === 1 ? 'request' : 'requests'} for a service we don't list` },
  },
  {
    // Problems — the grouped fault list (lib/telemetry/fault-issues.server.ts),
    // open issues only. It closes quiet issues when the page is read, so this
    // can run one or two ahead of the page between visits — never behind.
    key: 'problems',
    table: 'app_fault_issues',
    lane: 'support',
    slaHours: null,
    filter: (q) => q.eq('status', 'open'),
    tsCol: 'first_seen',
    digestLine: { label: 'Problems', say: (n) => `${n} ${n === 1 ? 'thing is' : 'things are'} failing in the app` },
  },
  {
    // Emails of the last week that will not arrive — see countEmailBounces.
    key: 'email-bounces',
    table: 'email_deliveries',
    lane: 'support',
    slaHours: null,
    filter: (q) => q.eq('outcome', 'send_failed'),
    digest: countEmailBounces,
    digestLine: { label: 'Email bounces', say: (n) => `${n} ${n === 1 ? 'email' : 'emails'} this week did not arrive` },
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
  { lane: AdminQueueLane; slaHours: number | null; watchOnly?: true }
> = Object.fromEntries(
  QUEUE_DEFS.map((d) => [
    d.key,
    d.watchOnly ? { lane: d.lane, slaHours: d.slaHours, watchOnly: true as const } : { lane: d.lane, slaHours: d.slaHours },
  ]),
);

/**
 * The digest's named lines — one per queue that carries a `digestLine`, in
 * QUEUE_DEFS order. Derived, so a queue given a line here cannot be missed by
 * the email (lib/admin/digest-content.ts reads this, never its own list).
 */
export const ADMIN_QUEUE_DIGEST_LINES: ReadonlyArray<{
  key: string;
  label: string;
  say: (n: number) => string;
}> = QUEUE_DEFS.flatMap((d) => (d.digestLine ? [{ key: d.key, ...d.digestLine }] : []));

// ✅ CLOSED 2026-11-13 (admin slice 4). This block used to list pax-changes,
// social-queue, pakanta and editorial-review as DELIBERATELY uncounted, "tracked
// as a follow-up". All four now count in QUEUE_DEFS, each through the cut its
// page uses (a week's trail · failed posts + take-downs owed · songs to write ·
// scan_status 'flagged'), alongside repost-watch, fraud, service-requests,
// supplier-refunds, problems and email-bounces. silent-queues-have-a-count.test.ts
// fails if any of the ten loses its count source again.
//
// 🛑 `completions` WAS ON THIS LIST AND ITS REASONING WAS RIGHT — it needs the
// celebration date from another table plus a JS "stuck" cut. On 2026-08-19 it
// was added to QUEUE_DEFS anyway, with a filter that applied neither. This list
// was NOT updated, so for six days the file said in one place that completions
// carried no badge and in another that it did. The badge counted 45 while its
// page listed 1, and it aged on `created_at`, so it rendered RED "past SLA" for
// weddings 109 days in the FUTURE.
// 🔑 THIS COMMENT WAS THE MECHANISM KEEPING THAT ALIVE: it is what an engineer
// reads before touching the overview, and it told them the omission was
// deliberate. Corrected 2026-08-25 — completions now counts through the
// `digest` escape hatch, which applies the full rule from
// lib/admin/completions-stuck.ts, shared with the page. If you add a queue whose
// count needs a join, use `digest` — do NOT approximate it with `filter` and
// leave this list saying otherwise.

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
/**
 * ONE queue's count + oldest-open age, failing to NULL — never to 0.
 *
 * Exported so `silent-queues-have-a-count.test.ts` can hand it a database that
 * refuses every read and prove each queue answers "unknown" rather than an
 * all-clear. `getAdminQueueDigest` is this, once per QUEUE_DEFS row.
 * `undefined` = no queue has that key.
 */
export async function countQueue(
  admin: SupabaseClient,
  key: string,
  nowMs: number,
): Promise<AdminQueueDigestRow | undefined> {
  const d = QUEUE_DEFS.find((q) => q.key === key);
  if (!d) return undefined;
  const nowIso = new Date(nowMs).toISOString();
  try {
    /* A queue that cannot be a single-table head-count reads itself. Caught
       here so a rejection degrades THAT queue to null instead of poisoning
       its siblings in getAdminQueueDigest's Promise.all. */
    if (d.digest) return await d.digest(admin, nowMs);
    const ts = d.tsCol ?? 'created_at';
    const r = await d
      .filter(admin.from(d.table).select(ts, { count: 'exact' }), { nowIso })
      .order(ts, { ascending: true })
      .limit(1);
    // A refused read carries `error` and no count: NULL, never a zero.
    if (r?.error) return { count: null, oldestAt: null };
    const rows = r?.data as Record<string, unknown>[] | null | undefined;
    const oldestAt = Array.isArray(rows) && rows[0]?.[ts] ? String(rows[0][ts]) : null;
    return { count: num(r?.count), oldestAt };
  } catch {
    return { count: null, oldestAt: null };
  }
}

export const getAdminQueueDigest = cache(async (): Promise<AdminQueueDigest> => {
  const admin = createAdminClient();
  const nowMs = Date.now();
  const results = await Promise.all(QUEUE_DEFS.map((d) => countQueue(admin, d.key, nowMs)));
  const out: AdminQueueDigest = {};
  QUEUE_DEFS.forEach((d, i) => {
    /* Index-aligned with the Promise.all above by construction; the fallback is
       for the type, and it fails to NULL rather than inventing a zero. */
    out[d.key] = results[i] ?? { count: null, oldestAt: null };
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

/**
 * SINGLE SOURCE OF TRUTH for how urgent one queue is against another.
 *
 * 🔑 TWO SURFACES RANKED THE SAME QUEUES IN OPPOSITE ORDERS. The command center
 * (/admin/work) ranked overdue-first and kept its own private DUE_RANK table;
 * the Overview's "busiest queues" preview (/admin) sorted on open count alone.
 * The same admin reading both was told two different things were the most
 * urgent thing to do — and /admin/work's own docblock claimed the two "agree by
 * construction". Whichever screen they happened to open decided what they did
 * first. The overdue-first rule wins because it is the one derived from a real
 * promise (slaHours); volume is only the tie-break inside a band.
 *
 * Lower number = ranks earlier. `unknown` (count unavailable) sits BELOW open
 * work but ABOVE clear: a degraded read must not be presented as either urgent
 * or settled.
 */
export const QUEUE_DUE_RANK: Record<AdminQueueDueState, number> = {
  overdue: 0,
  'due-soon': 1,
  ok: 2,
  unknown: 3,
  clear: 4,
};

/** The minimum a surface must know about a queue to rank it. */
export type RankableQueue = {
  /** Missing (a queue with no urgency signal at all) ranks as `unknown`. */
  dueState?: AdminQueueDueState;
  /** `null` = count unavailable; ranks as 0 for the volume tie-break. */
  count: number | null;
};

/**
 * Comparator both admin surfaces sort by: urgency band first, then busiest
 * inside the band. Returns 0 on a full tie so the CALLER's declaration order
 * breaks it (Array.prototype.sort is stable) — the two surfaces list their
 * queues in different orders on purpose, and that is the only difference left
 * between them.
 */
export function compareQueuePriority(a: RankableQueue, b: RankableQueue): number {
  const ra = QUEUE_DUE_RANK[a.dueState ?? 'unknown'];
  const rb = QUEUE_DUE_RANK[b.dueState ?? 'unknown'];
  if (ra !== rb) return ra - rb;
  const ca = a.count ?? 0;
  const cb = b.count ?? 0;
  if (cb !== ca) return cb - ca;
  return 0;
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
    // A trail to watch is not work waiting: it keeps its own state (so its
    // badge still shows) and stays out of every total below — including the
    // unknown tally, which is "a queue of WORK we could not read".
    if (meta.watchOnly) {
      if (row) states[key] = computeDueState(row, meta.slaHours, nowMs);
      continue;
    }
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
