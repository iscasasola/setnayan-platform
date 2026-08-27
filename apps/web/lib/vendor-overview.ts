import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { isLockHandshakeEnabled } from '@/lib/lock-handshake-flag';
import { fetchVendorThreads } from '@/lib/chat';
import { fetchReviewsForVendorWithCouple } from '@/lib/reviews';
import { fetchVendorContracts } from '@/lib/contracts';
import { fetchVendorPoolBookings } from '@/lib/vendor-schedule';
import { resolveRegion } from '@/lib/region-source';
import { logQueryError } from '@/lib/supabase/error-detect';
import { inquiryHostNounsByType } from '@/lib/inquiry-mask.server';
import {
  buildInquiryCard,
  type InquiryWhatsNewCard,
} from '@/lib/vendor-overview-inquiry-card';
import { displayServiceLabel } from '@/lib/vendors';
import { fetchVendorServices } from '@/lib/vendor-services';
import { computeMonthlySubtotals, fetchVendorEarnings } from '@/lib/vendor-earnings';
import {
  buildPaydayTimeline,
  manilaTodayIso,
  type PaydayInstallmentRow,
} from '@/lib/vendor-cashflow';

/**
 * vendor-overview.ts — the server-side data assembly for the vendor dashboard
 * Overview (/vendor-dashboard root · the finalized 6-menu-shell prototype).
 *
 * The prototype's Overview is a DECISION SURFACE — "what needs you today" — not
 * a stat board. Three live streams feed it:
 *
 *   1. WHAT'S NEW  — a decision feed. Each card = one thing to act on:
 *        · New inquiry (pending chat thread) — Accept burns the region-banded
 *          token cost (◎1/2/3 keyed to the couple's event region), or Decline.
 *        · Lock request — a couple recorded a downpayment off-platform; the
 *          vendor Confirms the lock (acknowledge_vendor_deposit) or Views it.
 *        · New 5-star review — awaiting the vendor's public reply.
 *        · Delivery delay flagged — a couple disputed a handover.
 *   2. ONGOING     — the vendor's open tasks: unanswered inquiries, draft
 *        contracts still to send, lock requests still to confirm.
 *   3. UPCOMING    — the next booked events by date (schedule-pool bookings).
 *
 * DATA-SOURCE HONESTY (per the build brief — never invent a number):
 *   · Inquiries / reviews / contracts / handovers / schedule-pool bookings are
 *     all read under the vendor's OWN session RLS (fail-soft helpers).
 *   · Lock requests + the place/category enrichment on booked events read
 *     event_vendors / events via the admin client, SCOPED to this vendor's own
 *     `vendor_profile_id`. event_vendors carries couple-only RLS, so the
 *     vendor's session can't see it directly — this mirrors the exact pattern
 *     already used by fetchVendorPoolBookings + the clients/[eventId] brief.
 *   · When a stream has no rows the section renders its own empty/zero state;
 *     nothing is fabricated.
 */

/** A single card in the "What's new" decision feed. */
export type WhatsNewCard =
  // Pre-accept inquiry — masked by construction (no couple identity, no
  // `eventName`); see `vendor-overview-inquiry-card.ts`.
  | InquiryWhatsNewCard
  // PR-H step 2 — the couple ASKED, the supplier has not answered. Its own kind
  // on purpose: the 'lock' card below is step 5 (confirm the DEPOSIT, keyed on
  // payment proof) and overloading it would put two different questions, at two
  // different rungs, behind one button.
  | {
      kind: 'lock_request';
      id: string;
      eventId: string;
      eventVendorId: string;
      eventDate: string | null;
      requestedAt: string;
      /** Materialized on the row by the guard trigger — shown AND enforced. */
      expiresAt: string | null;
    }
  /*
    The couple wants to REMOVE a celebration this supplier was paid for, and
    only the supplier can release it (owner 2026-08-21). Its own kind: the
    lock_request card above asks "will you take this booking?", this one asks
    "may this booking's celebration be erased?" — opposite direction, and the
    consequences of a mistaken tap are not symmetric.
  */
  | {
      kind: 'delete_request';
      id: string;
      eventId: string;
      eventVendorId: string;
      eventDate: string | null;
      requestedAt: string;
    }
  | {
      kind: 'lock';
      id: string;
      eventId: string;
      eventVendorId: string;
      coupleName: string;
      eventDate: string | null;
      /** Vendor-visible deposit proof URL, when the couple attached one. */
      proofUrl: string | null;
      recordedAt: string;
    }
  | {
      kind: 'review';
      id: string;
      reviewId: string;
      coupleName: string;
      quote: string | null;
      createdAt: string;
    }
  | {
      kind: 'dispute';
      id: string;
      eventId: string;
      eventName: string;
      label: string | null;
      createdAt: string;
    };

/** A single row in the "Ongoing" open-tasks list. */
export type OngoingTask = {
  id: string;
  label: string;
  /** Pre-formatted due chip ("Due in 2 days" · "This week" · "No date" · "Awaiting you 1 day"). */
  dueChip: string;
  href: string;
};

/** A single row in "Upcoming schedules". */
export type UpcomingEventRow = {
  id: string;
  eventId: string;
  eventName: string;
  date: string; // YYYY-MM-DD
  place: string | null;
  category: string | null;
  inDays: number;
  href: string;
};

export type VendorOverviewData = {
  whatsNew: WhatsNewCard[];
  ongoing: OngoingTask[];
  upcoming: UpcomingEventRow[];
};

/** Manila civil day (midnight) as a Date, for date math. */
function todayManila(): Date {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

/** Whole days from today (Manila civil day) to an event date; null if no date. */
function daysUntil(eventDate: string | null): number | null {
  if (!eventDate) return null;
  const target = new Date(`${eventDate}T00:00:00`);
  const diffMs = target.getTime() - todayManila().getTime();
  return Math.round(diffMs / (24 * 60 * 60 * 1000));
}

/** Whole days since an ISO timestamp (for "Awaiting you N days" chips). */
function daysSince(iso: string): number {
  const then = new Date(iso).getTime();
  const diffMs = Date.now() - then;
  return Math.max(0, Math.floor(diffMs / (24 * 60 * 60 * 1000)));
}

/** A friendly "place" label — the venue name if set, else the region label. */
function placeLabel(venue: string | null, region: string | null): string | null {
  const v = venue?.trim();
  if (v) return v;
  return resolveRegion(region)?.display_label ?? null;
}

/** The vendor's own primary service category label (first listed service). */
function primaryCategoryLabel(services: string[]): string | null {
  const first = services.find((s) => s.trim().length > 0);
  return first ? displayServiceLabel(first) : null;
}

/**
 * Assemble the Overview data. `profile` supplies the vendor's own service list
 * (for the inquiry-card category, which reflects what the couple inquired the
 * vendor FOR). All reads fail soft — a thrown sub-fetch degrades that one
 * stream to empty, never the whole page.
 */
export async function fetchVendorOverviewData(
  supabase: SupabaseClient,
  vendorProfileId: string,
  services: string[],
): Promise<VendorOverviewData> {
  const vendorCategory = primaryCategoryLabel(services);

  // --- 1. Vendor's own-session reads (RLS-scoped, fail-soft) -----------------
  const [threads, reviews, contracts, poolBookings, disputes] = await Promise.all([
    fetchVendorThreads(supabase, vendorProfileId).catch(() => []),
    fetchReviewsForVendorWithCouple(supabase, vendorProfileId, { limit: 50 }).catch(
      () => [],
    ),
    fetchVendorContracts(supabase, vendorProfileId).catch(() => []),
    // LEFT ON THE POOL READ, and this one is a real gap, named not fixed: the
    // upcoming list keys its React ids on poolBookingId, which an agreed booking
    // does not have. Widening it needs a stable id first — its own change.
    fetchVendorPoolBookings(supabase, vendorProfileId).catch(() => []),
    fetchDisputedHandovers(supabase, vendorProfileId),
  ]);

  const pendingThreads = threads.filter((t) => t.inquiry_status === 'pending');

  // --- 2. Admin-scoped reads (vendor's own profile only) ---------------------
  // Lock requests: the couple recorded a deposit; the vendor still needs to
  // confirm it. event_vendors is couple-RLS → admin client, filtered to this
  // vendor. Also enrich booked events with place + category (events read).
  const admin = createAdminClient();

  // Event-region + venue + name for every event referenced by an inquiry or a
  // booking — one batched read.
  const inquiryEventIds = pendingThreads.map((t) => t.event_id);
  const bookingEventIds = poolBookings.map((b) => b.eventId);
  /*
    🔴 THE REQUEST FETCHES MOVED AHEAD OF `fetchEventMeta`, AND IT IS A BUG FIX.
    They used to run in the SAME `Promise.all` as the meta lookup, so their
    event ids could never be in `eventIds` — every lock-request card rendered
    with `meta?.eventDate ?? null`, i.e. a request to take a booking that never
    said WHICH DATE. The card asks a supplier to commit to a day and did not
    name the day.

    Both need only the vendor id, so they run first and the meta read then
    covers their events too. The deletion card would have inherited the
    identical hole — a supplier asked to release a celebration, not told which.
  */
  const [lockRequests, lockAgreementRequests, deletionRequests] =
    await Promise.all([
      fetchLockRequests(admin, vendorProfileId),
      // Flag-gated so the extra read does not even run while the handshake is
      // dark. This file is registered as a GATE for exactly this call.
      isLockHandshakeEnabled()
        ? fetchLockAgreementRequests(admin, vendorProfileId)
        : Promise.resolve([] as LockAgreementRequest[]),
      // NOT flag-gated: the deletion handshake is live, not dark.
      fetchDeletionRequests(admin, vendorProfileId),
    ]);

  const eventIds = [
    ...new Set([
      ...inquiryEventIds,
      ...bookingEventIds,
      ...lockAgreementRequests.map((r) => r.eventId),
      ...deletionRequests.map((r) => r.eventId),
    ]),
  ];
  const eventMeta = await fetchEventMeta(admin, eventIds);
  // The organiser noun per event TYPE, for the masked inquiry cards below. The
  // couple's identity still cannot reach the card — a type is not a person —
  // and a type we cannot resolve yields no noun, so the card says "a host"
  // rather than guessing a wedding.
  const inquiryHostNouns = await inquiryHostNounsByType(
    pendingThreads.map((t) => eventMeta.get(t.event_id)?.eventType ?? null),
  );

  // --- Assemble WHAT'S NEW ---------------------------------------------------
  const whatsNew: WhatsNewCard[] = [];

  for (const t of pendingThreads) {
    const meta = eventMeta.get(t.event_id);
    // Anonymization-until-accept (Glass PR-6b): a pending inquiry is PRE-accept,
    // so the couple's identity must NOT surface here. `buildInquiryCard` accepts
    // only non-identifying inputs (event type · region · date · category) — the
    // admin-read `meta.displayName`/`venue` PII fields are deliberately NOT
    // passed, so there is no path through which they can reach the card. The card
    // carries a neutral `descriptor` ("A couple planning a {type} in {city}") and
    // city/area-level `place` only. Full reveal happens after Accept (this card
    // disappears once the thread leaves `pending`).
    whatsNew.push(
      buildInquiryCard({
        threadId: t.thread_id,
        createdAt: t.created_at,
        eventDate: t.event?.event_date ?? meta?.eventDate ?? null,
        eventType: meta?.eventType ?? null,
        region: meta?.region ?? null,
        category: vendorCategory,
        hostNoun: meta?.eventType ? (inquiryHostNouns.get(meta.eventType) ?? null) : null,
      }),
    );
  }

  // PR-H step 2 FIRST: being ASKED outranks confirming a deposit, because it
  // carries a 7-day fuse and the other one does not.
  for (const ar of lockAgreementRequests) {
    const meta = eventMeta.get(ar.eventId);
    whatsNew.push({
      kind: 'lock_request',
      id: `lockreq-${ar.eventVendorId}`,
      eventId: ar.eventId,
      eventVendorId: ar.eventVendorId,
      eventDate: meta?.eventDate ?? null,
      requestedAt: ar.requestedAt,
      expiresAt: ar.expiresAt,
    });
  }

  /*
    THE DELETION ASK SITS FIRST among the booking cards. A supplier can lose a
    whole celebration's record by ignoring it, and — unlike the lock request —
    it carries no deadline that would surface it later. Owner 2026-08-21: an
    unanswered ask stays open forever with one reminder, never auto-agreed.
  */
  for (const dr of deletionRequests) {
    const meta = eventMeta.get(dr.eventId);
    whatsNew.push({
      kind: 'delete_request',
      id: `delreq-${dr.eventVendorId}`,
      eventId: dr.eventId,
      eventVendorId: dr.eventVendorId,
      eventDate: meta?.eventDate ?? null,
      requestedAt: dr.requestedAt,
    });
  }

  for (const lr of lockRequests) {
    const meta = eventMeta.get(lr.eventId);
    whatsNew.push({
      kind: 'lock',
      id: `lock-${lr.eventVendorId}`,
      eventId: lr.eventId,
      eventVendorId: lr.eventVendorId,
      coupleName: lr.coupleName ?? meta?.displayName ?? 'A couple',
      eventDate: meta?.eventDate ?? null,
      proofUrl: lr.proofUrl,
      recordedAt: lr.recordedAt,
    });
  }

  for (const r of reviews) {
    if (r.rating_overall !== 5 || r.vendor_reply) continue;
    whatsNew.push({
      kind: 'review',
      id: `rev-${r.review_id}`,
      reviewId: r.review_id,
      coupleName: r.couple_display_name ?? 'A verified couple',
      quote: r.body?.trim() ? r.body.trim() : null,
      createdAt: r.created_at,
    });
  }

  for (const d of disputes) {
    const meta = eventMeta.get(d.eventId);
    whatsNew.push({
      kind: 'dispute',
      id: `dsp-${d.handoverId}`,
      eventId: d.eventId,
      eventName: meta?.displayName ?? 'A booked event',
      label: d.label,
      createdAt: d.deliveredAt,
    });
  }

  // Newest first across every card type.
  whatsNew.sort(
    // OLDEST WAITING FIRST (design § 2.4 EXTEND 3). The shipped order was
    // newest-first and carried no recorded rationale; the frame's caption is the
    // authority — "a missed inquiry is lost income". The thing that has been
    // waiting longest is the thing most at risk, so it goes to the top.
    (a, b) => cardTimestamp(a).getTime() - cardTimestamp(b).getTime(),
  );

  // --- Assemble ONGOING ------------------------------------------------------
  const ongoing: OngoingTask[] = [];

  for (const t of pendingThreads) {
    ongoing.push({
      id: `ong-inq-${t.thread_id}`,
      label: `Reply to ${t.event?.display_name ?? 'a new inquiry'}`,
      dueChip: awaitingChip(t.created_at),
      href: `/vendor-dashboard/messages/${t.thread_id}`,
    });
  }

  // The open-task list must report the ask too, or a supplier's own "what do I
  // owe anyone" list under-reports the one item with a deadline on it.
  for (const ar of lockAgreementRequests) {
    ongoing.push({
      id: `ong-lockreq-${ar.eventVendorId}`,
      label: 'Agree to a booking, or turn it down',
      dueChip: awaitingChip(ar.requestedAt),
      href: '/vendor-dashboard',
    });
  }

  for (const lr of lockRequests) {
    const meta = eventMeta.get(lr.eventId);
    ongoing.push({
      id: `ong-lock-${lr.eventVendorId}`,
      label: `Confirm the deposit from ${lr.coupleName ?? meta?.displayName ?? 'a couple'}`,
      dueChip: awaitingChip(lr.recordedAt),
      href: `/vendor-dashboard/clients/${lr.eventId}`,
    });
  }

  for (const c of contracts) {
    if (c.status !== 'draft') continue;
    ongoing.push({
      id: `ong-contract-${c.contract_id}`,
      label: `Send the contract "${c.title}"`,
      dueChip: 'Awaiting you',
      href: `/vendor-dashboard/contracts`,
    });
  }

  // --- Assemble UPCOMING (next 5 booked events by date) ----------------------
  const today = todayManila();
  const upcoming: UpcomingEventRow[] = poolBookings
    .filter((b) => new Date(`${b.bookedDate}T00:00:00`).getTime() >= today.getTime())
    .sort((a, b) => a.bookedDate.localeCompare(b.bookedDate))
    .slice(0, 5)
    .map((b) => {
      const meta = eventMeta.get(b.eventId);
      const inDays = daysUntil(b.bookedDate) ?? 0;
      return {
        id: `up-${b.poolBookingId}`,
        eventId: b.eventId,
        eventName: b.eventName,
        date: b.bookedDate,
        place: placeLabel(meta?.venue ?? null, meta?.region ?? null),
        category: vendorCategory,
        inDays,
        href: b.threadId
          ? `/vendor-dashboard/messages/${b.threadId}`
          : `/vendor-dashboard/clients/${b.eventId}`,
      };
    });

  return { whatsNew, ongoing, upcoming };
}

// ---------------------------------------------------------------------------
// EARNINGS SUMMARY — the real booked-revenue figures the Overview reskin
// skipped (PR #2980 noted "no real source on this surface"; there is one, it
// just wasn't loaded here). Two independent, real sources — both fail-soft:
//
//   · earnedThisYearPhp / bookingCount — the SAME year-to-date figure the
//     /vendor-dashboard/earnings page shows: matched payments on orders whose
//     service_key is in this vendor's own service categories (admin client,
//     scoped by the vendor's OWN vendor_services rows — never a raw user_id).
//   · confirmedPhp / expectedPhp — the vendor's payday cash-flow: the
//     ownership-gated `vendor_payday_installments()` RPC (auth.uid()-scoped
//     internally), summed via buildPaydayTimeline. confirmed = installments the
//     vendor has confirmed receiving; expected = total booked installment value.
//
// Never invents a number: any sub-fetch that throws degrades to empty → ₱0.
// ---------------------------------------------------------------------------

export type VendorEarningsSummary = {
  /** Year-to-date paid revenue on the vendor's service categories (pesos). */
  earnedThisYearPhp: number;
  /** Count of matched paid bookings behind the earnings figure. */
  bookingCount: number;
  /** Confirmed (received) installment value across booked events (pesos). */
  confirmedPhp: number;
  /** Total booked installment value across booked events (pesos). */
  expectedPhp: number;
};

/**
 * Load the vendor's real earnings summary for the Overview bento. Cheap enough
 * to sit on the Overview's parallel batch: two round trips run concurrently and
 * each degrades to empty on failure, so a bad read shows an honest ₱0 rather
 * than crashing the page. `supabase` is the vendor's own session (RLS-scoped);
 * the earnings read uses the admin client filtered by the vendor's OWN
 * categories, mirroring the earnings page exactly.
 */
export async function fetchVendorEarningsSummary(
  supabase: SupabaseClient,
  vendorProfileId: string,
): Promise<VendorEarningsSummary> {
  const admin = createAdminClient();

  const [earnings, paydayTotals] = await Promise.all([
    // Earnings: vendor's categories → matched payments (same path as the
    // Earnings page). Fail-soft to [] so a bad read shows ₱0, not a crash.
    (async () => {
      const services = await fetchVendorServices(supabase, vendorProfileId);
      const categories = Array.from(new Set(services.map((s) => s.category)));
      if (categories.length === 0) return [];
      return fetchVendorEarnings(admin, categories);
    })().catch(() => []),
    // Payday cash-flow: ownership-gated RPC (auth.uid()-scoped). Fail-soft.
    (async () => {
      const { data, error } = await supabase.rpc('vendor_payday_installments');
      const rows = (error ? [] : ((data ?? []) as unknown as PaydayInstallmentRow[]));
      return buildPaydayTimeline(rows, manilaTodayIso()).totals;
    })().catch(() => null),
  ]);

  const { ytdTotal } = computeMonthlySubtotals(earnings);

  return {
    earnedThisYearPhp: ytdTotal,
    bookingCount: earnings.length,
    confirmedPhp: paydayTotals?.confirmedPhp ?? 0,
    expectedPhp: paydayTotals?.expectedPhp ?? 0,
  };
}

/** The sort key for a feed card — its creation/recorded timestamp. */
function cardTimestamp(card: WhatsNewCard): Date {
  switch (card.kind) {
    case 'inquiry':
      return new Date(card.createdAt);
    case 'lock':
      return new Date(card.recordedAt);
    // The ASK is ordered by when it was made, so the oldest — the one closest to
    // its 7-day deadline — sorts to the top of the feed. (This switch is
    // exhaustive over the union: adding a card kind without a sort key is a
    // typecheck failure, which is how this line got written.)
    case 'lock_request':
      return new Date(card.requestedAt);
    case 'delete_request':
      return new Date(card.requestedAt);
    case 'review':
      return new Date(card.createdAt);
    case 'dispute':
      return new Date(card.createdAt);
  }
}

/** "Awaiting you Nd" chip from the moment a task first needed the vendor. */
function awaitingChip(sinceIso: string): string {
  const d = daysSince(sinceIso);
  if (d <= 0) return 'Awaiting you today';
  if (d === 1) return 'Awaiting you 1 day';
  return `Awaiting you ${d} days`;
}

// --- Event metadata (name · date · region · venue) via admin -----------------

type EventMeta = {
  displayName: string;
  eventDate: string | null;
  region: string | null;
  venue: string | null;
  eventType: string | null;
};

async function fetchEventMeta(
  admin: SupabaseClient,
  eventIds: string[],
): Promise<Map<string, EventMeta>> {
  const out = new Map<string, EventMeta>();
  if (eventIds.length === 0) return out;
  // ⚠ `venue_name`, NOT `venue` — public.events has no `venue` column (it has
  // venue_name / venue_address / venue_setting / venue_latitude / …).
  // PostgREST 42703s on ONE unknown column and fails the WHOLE row, so this map
  // was permanently empty and every vendor-overview card lost its couple name,
  // event date, region, venue AND event type — not just the venue line.
  const { data, error } = await admin
    .from('events')
    .select('event_id, display_name, event_date, region, venue_name, event_type')
    .in('event_id', eventIds);
  if (error) {
    logQueryError('vendor-overview:fetchEventMeta', error, {
      eventCount: eventIds.length,
    });
  }
  for (const row of (data ?? []) as Array<{
    event_id: string;
    display_name: string | null;
    event_date: string | null;
    region: string | null;
    venue_name: string | null;
    event_type: string | null;
  }>) {
    out.set(row.event_id, {
      displayName: row.display_name ?? 'A couple',
      eventDate: row.event_date,
      region: row.region,
      venue: row.venue_name,
      eventType: row.event_type,
    });
  }
  return out;
}

// --- Lock requests (couple recorded a deposit, vendor hasn't confirmed) -------

type LockRequest = {
  eventId: string;
  eventVendorId: string;
  coupleName: string | null;
  proofUrl: string | null;
  recordedAt: string;
};

/**
 * "Which couples are waiting on ME to answer?"
 *
 * event_vendors carries couple-only RLS, so this runs on the admin client
 * scoped to the caller's own vendor_profile_id — the same shape as
 * fetchLockRequests, and the reason a vendor SELECT policy on event_vendors is
 * deliberately not opened (it would hand suppliers the couple's whole booking
 * row, budget figures included).
 */
type LockAgreementRequest = {
  eventId: string;
  eventVendorId: string;
  requestedAt: string;
  expiresAt: string | null;
};

async function fetchLockAgreementRequests(
  admin: SupabaseClient,
  vendorProfileId: string,
): Promise<LockAgreementRequest[]> {
  const { data } = await admin
    .from('event_vendors')
    .select('vendor_id, event_id, lock_requested_at, lock_request_expires_at')
    .eq('marketplace_vendor_id', vendorProfileId)
    .eq('lock_request_state', 'pending')
    // A confirmed row can carry a stale 'pending' marker — the printed Locked-QR
    // path promotes to deposit_paid without touching any lock_* column — and
    // offering that supplier an "agree?" card for a booking they have already
    // been paid for is nonsense. Same floor the sweeps carry.
    .not('status', 'in', '("contracted","deposit_paid","delivered","complete")')
    // A covered cascade line carries no request of its own; only the anchor is
    // asked. An archived row is a withdrawn booking.
    .or('package_role.is.null,package_role.eq.anchor')
    .is('archived_at', null)
    .order('lock_requested_at', { ascending: true });
  return ((data ?? []) as Array<{
    vendor_id: string;
    event_id: string;
    lock_requested_at: string;
    lock_request_expires_at: string | null;
  }>).map((r) => ({
    eventId: r.event_id,
    eventVendorId: r.vendor_id,
    requestedAt: r.lock_requested_at,
    expiresAt: r.lock_request_expires_at,
  }));
}

type DeletionRequest = {
  eventId: string;
  eventVendorId: string;
  requestedAt: string;
};

/**
 * Celebrations this supplier was PAID for that the couple has asked to remove.
 *
 * ⚠ THE LOCK FETCH'S STATUS FLOOR IS DELIBERATELY *NOT* COPIED. That one
 * excludes `contracted`/`deposit_paid`/`delivered`/`complete`, because offering
 * an "agree to be booked?" card to somebody already booked is nonsense. Here the
 * ask goes PRECISELY to paid suppliers — excluding those statuses would exclude
 * every row this feature exists for.
 *
 * The other two floors DO apply: a covered cascade line carries no request of
 * its own (only the anchor is asked), and an archived row is a withdrawn
 * booking. `request_event_deletion` marks rows without those predicates, so
 * filtering here keeps a covered or archived line from ever showing a card.
 */
async function fetchDeletionRequests(
  admin: SupabaseClient,
  vendorProfileId: string,
): Promise<DeletionRequest[]> {
  const { data } = await admin
    .from('event_vendors')
    .select('vendor_id, event_id, delete_requested_at')
    .eq('marketplace_vendor_id', vendorProfileId)
    .eq('delete_request_state', 'pending')
    .or('package_role.is.null,package_role.eq.anchor')
    .is('archived_at', null)
    .order('delete_requested_at', { ascending: true });
  return ((data ?? []) as Array<{
    vendor_id: string;
    event_id: string;
    delete_requested_at: string;
  }>).map((r) => ({
    eventId: r.event_id,
    eventVendorId: r.vendor_id,
    requestedAt: r.delete_requested_at,
  }));
}

async function fetchLockRequests(
  admin: SupabaseClient,
  vendorProfileId: string,
): Promise<LockRequest[]> {
  const { data } = await admin
    .from('event_vendors')
    .select(
      'vendor_id, event_id, vendor_name, deposit_recorded_at, deposit_acknowledged_at, deposit_proof_url',
    )
    .eq('marketplace_vendor_id', vendorProfileId)
    .not('deposit_recorded_at', 'is', null)
    .is('deposit_acknowledged_at', null)
    // PR-I · §12.2 step 9. This feed hands its raw `vendor_id` straight to
    // `vendorAcknowledgeDeposit`, which now moves MONEY — so it must never
    // offer a row that is not a sale:
    //   · `package_role='covered'` is a cascade line carrying ₱0; the anchor
    //     is the money row, and the "covered rows carry no money" CHECK
    //     constrains the AMOUNTS only, not the deposit markers, so nothing at
    //     the DB layer stops one appearing here.
    //   · an archived row is a rejected/withdrawn booking.
    // `resolveFeeAnchorRowId` is the backstop; this is the design.
    .or('package_role.is.null,package_role.eq.anchor')
    .is('archived_at', null)
    .order('deposit_recorded_at', { ascending: false });
  return ((data ?? []) as Array<{
    vendor_id: string;
    event_id: string;
    vendor_name: string | null;
    deposit_recorded_at: string;
    deposit_acknowledged_at: string | null;
    deposit_proof_url: string | null;
  }>).map((r) => ({
    eventId: r.event_id,
    eventVendorId: r.vendor_id,
    // event_vendors.vendor_name is the vendor's own business name — NOT the
    // couple. The couple label comes from the joined event (fetchEventMeta),
    // consistent with how reviews attribute to the event, not personal names.
    coupleName: null,
    proofUrl: r.deposit_proof_url,
    recordedAt: r.deposit_recorded_at,
  }));
}

// --- Disputed handovers (vendor-readable) ------------------------------------

type DisputedHandover = {
  handoverId: string;
  eventId: string;
  label: string | null;
  deliveredAt: string;
};

async function fetchDisputedHandovers(
  supabase: SupabaseClient,
  vendorProfileId: string,
): Promise<DisputedHandover[]> {
  // booking_handovers has a vendor-read policy keyed on vendor_profile_id, so
  // the vendor's own session resolves these. Fail-soft: the table may not be
  // present pre-migration → empty list, never a thrown page.
  try {
    const { data, error } = await supabase
      .from('booking_handovers')
      .select('handover_id, event_id, label, status, delivered_at')
      .eq('vendor_profile_id', vendorProfileId)
      .eq('status', 'disputed')
      .order('delivered_at', { ascending: false });
    if (error) return [];
    return ((data ?? []) as Array<{
      handover_id: string;
      event_id: string;
      label: string | null;
      delivered_at: string;
    }>).map((r) => ({
      handoverId: r.handover_id,
      eventId: r.event_id,
      label: r.label,
      deliveredAt: r.delivered_at,
    }));
  } catch {
    return [];
  }
}
