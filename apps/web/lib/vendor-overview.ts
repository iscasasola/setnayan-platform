import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchVendorThreads } from '@/lib/chat';
import { fetchReviewsForVendorWithCouple } from '@/lib/reviews';
import { fetchVendorContracts } from '@/lib/contracts';
import { fetchVendorPoolBookings } from '@/lib/vendor-schedule';
import { regionBurnTokens } from '@/lib/v2/region-token-burn';
import { resolveRegion, regionLabel } from '@/lib/region-source';
import { inquiryPlaceholderLabel } from '@/lib/inquiry-mask';
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
  | {
      kind: 'inquiry';
      id: string;
      threadId: string;
      title: string; // "New inquiry — New customer"
      eventName: string;
      eventDate: string | null;
      place: string | null;
      category: string | null;
      /** Region-banded token cost to Accept (◎N). */
      tokenCost: number;
      createdAt: string;
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
  const eventIds = [...new Set([...inquiryEventIds, ...bookingEventIds])];
  // eventMeta needs the ids derived from step 1; lockRequests needs only the
  // vendor id — they're independent, so run them together (2026-07-01 perf).
  const [eventMeta, lockRequests] = await Promise.all([
    fetchEventMeta(admin, eventIds),
    fetchLockRequests(admin, vendorProfileId),
  ]);

  // --- Assemble WHAT'S NEW ---------------------------------------------------
  const whatsNew: WhatsNewCard[] = [];

  for (const t of pendingThreads) {
    const meta = eventMeta.get(t.event_id);
    // Anonymization-until-accept (Glass PR-6b): a pending inquiry is PRE-accept,
    // so the couple's identity must not surface here. `eventName` becomes the
    // neutral placeholder ("A couple planning a {event_type} in {city}") — never
    // the event display_name — and `place` is city/area-level ONLY (drop the
    // venue name). `eventMeta.displayName`/`venue` are read via the admin client
    // (a vendor holds no events RLS), so this is the load-bearing masking point:
    // those PII fields must never be assembled into the card. `eventDate` is
    // permitted. Full reveal happens after Accept (this card disappears once the
    // thread leaves `pending`).
    const city = regionLabel(meta?.region ?? null);
    whatsNew.push({
      kind: 'inquiry',
      id: `inq-${t.thread_id}`,
      threadId: t.thread_id,
      title: 'New inquiry — New customer',
      eventName: inquiryPlaceholderLabel({ eventType: meta?.eventType ?? null, city }),
      eventDate: t.event?.event_date ?? meta?.eventDate ?? null,
      place: city,
      category: vendorCategory,
      tokenCost: regionBurnTokens(meta?.region ?? null),
      createdAt: t.created_at,
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
    (a, b) => cardTimestamp(b).getTime() - cardTimestamp(a).getTime(),
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
  const { data } = await admin
    .from('events')
    .select('event_id, display_name, event_date, region, venue, event_type')
    .in('event_id', eventIds);
  for (const row of (data ?? []) as Array<{
    event_id: string;
    display_name: string | null;
    event_date: string | null;
    region: string | null;
    venue: string | null;
    event_type: string | null;
  }>) {
    out.set(row.event_id, {
      displayName: row.display_name ?? 'A couple',
      eventDate: row.event_date,
      region: row.region,
      venue: row.venue,
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
