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
import {
  lockAskPhase,
  meetingAskPhase,
  reviewNeedsReply,
  threadOwesReply,
} from '@/lib/answers-desk';
import { resolveAppointmentLabel, type AppointmentKind } from '@/lib/appointments';
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
 *   1. WHAT'S NEW — THE ANSWERS DESK. Every answer this shop owes anybody, one
 *      list across all their celebrations, OLDEST WAITING FIRST with the age on
 *      the row. Each card is one thing to answer, and — the 2026-08-27 delta —
 *      the answer is given ON the row wherever the answer works:
 *        · New inquiry (pending chat thread) — Accept (free) or Decline.
 *        · Booking ask — the couple asked; agree or turn it down. Past its
 *          7-day deadline it becomes a closed line that keeps its place.
 *        · A celebration you were paid for is being removed — agree or hold.
 *        · Downpayment recorded — confirm it.
 *        · An unanswered review AT ANY RATING, with the reply box on the card.
 *        · Delivery delay flagged — a judgement, so a sentence and a way in.
 *        · A reply owed in an accepted conversation.
 *        · A meeting time the couple proposed.
 *        · A quote, and a contract, written and never sent.
 *   2. ONGOING     — the vendor's open tasks: unanswered inquiries and booking
 *        asks. (Draft contracts moved INTO the feed — one thing, one list.)
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
  /*
    THE BOOKING ASK WHOSE WINDOW CLOSED. Its own kind, because it is not a
    question any more: `vendor_agree_to_lock` expires LAZILY — only on the answer
    path — so a lapsed ask keeps `lock_request_state = 'pending'` and the
    answerable card above kept offering it, saying "Last day to answer" (the day
    count floors at 0) about something that now returns `expired` when pressed.
    It holds its place in the feed for a week and carries no buttons at all.
  */
  | {
      kind: 'lock_request_lapsed';
      id: string;
      eventId: string;
      eventVendorId: string;
      eventDate: string | null;
      requestedAt: string;
      expiresAt: string | null;
    }
  | {
      kind: 'review';
      id: string;
      reviewId: string;
      coupleName: string;
      quote: string | null;
      /** 1–5, or null when unreadable. Decides the card's words AND its colour. */
      rating: number | null;
      createdAt: string;
    }
  | {
      kind: 'dispute';
      id: string;
      eventId: string;
      eventName: string;
      label: string | null;
      createdAt: string;
    }
  /*
    A REPLY OWED IN AN ACCEPTED CONVERSATION — and it is probably the commonest
    row on this desk. The enquiry card above is PRE-accept only, so a couple the
    shop has already booked waiting on an answer appeared nowhere, while that is
    the exact thing we measure and publish as this shop's reply speed.
  */
  | {
      kind: 'message';
      id: string;
      threadId: string;
      eventId: string;
      coupleName: string;
      /** A short excerpt of what they said last — never the whole thread. */
      excerpt: string | null;
      lastMessageAt: string;
    }
  /*
    THE COUPLE PROPOSED A TIME. Deadlined by the meeting itself, so `passed`
    rows drop out of the waited-longest order (see `meetingAskPhase`).
  */
  | {
      kind: 'meeting';
      id: string;
      appointmentId: string;
      eventId: string;
      vendorProfileId: string;
      coupleName: string;
      label: string;
      meetingKind: AppointmentKind;
      location: string | null;
      scheduledAt: string | null;
      durationMin: number | null;
      proposedAt: string;
      /** True once the proposed time has been and gone — a closed line, no buttons. */
      passed: boolean;
    }
  /*
    A QUOTE THIS SHOP WROTE AND NEVER SENT. A reminder that OPENS it — never a
    Send button on a feed card: sending retires every other live quote this shop
    has out with that couple, which is not a decision to make in one tap from a
    list.
  */
  | {
      kind: 'quote_draft';
      id: string;
      proposalId: string;
      publicId: string | null;
      eventId: string | null;
      title: string;
      totalCentavos: number | null;
      createdAt: string;
    }
  /** A contract this shop drafted and never sent. Same shape, same treatment. */
  | {
      kind: 'contract_draft';
      id: string;
      contractId: string;
      eventId: string;
      title: string;
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
  const [
    threads,
    reviews,
    contracts,
    poolBookings,
    disputes,
    meetingProposals,
    draftQuotes,
  ] = await Promise.all([
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
    // Both read under the vendor's OWN session: event_appointments carries a
    // vendor-read policy keyed on vendor_profile_id, and vendor_proposals is the
    // shop's own table (the Proposals surface reads it the same way).
    fetchCoupleMeetingProposals(supabase, vendorProfileId),
    fetchUnsentQuotes(supabase, vendorProfileId),
  ]);

  const pendingThreads = threads.filter((t) => t.inquiry_status === 'pending');
  /*
    THE ACCEPTED LANE — where a reply is actually owed.
    · `accepted` only: displaced / withdrawn / expired threads are conversations
      that ended, and nagging a supplier to answer one is a door onto nothing.
    · An ARCHIVED thread is one the supplier deliberately put away, and a newer
      message auto-unarchives it (`computeArchived`), so a thread that is still
      archived has nothing newer than the moment they filed it.
  */
  const acceptedThreads = threads.filter(
    (t) => t.inquiry_status === 'accepted' && !t.archived,
  );
  const owedReplies = await fetchOwedThreadReplies(
    supabase,
    acceptedThreads.map((t) => t.thread_id),
  );

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

  /*
    THE ASK SPLITS BY ITS OWN MATERIALIZED DEADLINE. `fetchLockAgreementRequests`
    can only ask for `lock_request_state = 'pending'`, and expiry in this product
    is LAZY — flipped on the answer path, never by a sweeper — so a lapsed ask is
    indistinguishable from a live one at the query. The phase is decided here,
    once, from the stamped deadline.
  */
  const now = Date.now();
  const answerableAsks = lockAgreementRequests.filter(
    (r) => lockAskPhase(r.expiresAt, now) === 'answerable',
  );
  const lapsedAsks = lockAgreementRequests.filter(
    (r) => lockAskPhase(r.expiresAt, now) === 'lapsed',
  );

  const draftContracts = contracts.filter((c) => c.status === 'draft');
  const answerableMeetings = meetingProposals.filter(
    (m) => meetingAskPhase(m.scheduledAt, now) !== 'dropped',
  );

  const eventIds = [
    ...new Set([
      ...inquiryEventIds,
      ...bookingEventIds,
      ...lockAgreementRequests.map((r) => r.eventId),
      ...deletionRequests.map((r) => r.eventId),
      // The four kinds added with the desk. Their event ids all come from rows
      // the vendor's OWN session returned; the meta read is admin-scoped
      // enrichment of ids already proved, never a way to reach a new event.
      ...owedReplies.map((m) => {
        const thread = acceptedThreads.find((t) => t.thread_id === m.threadId);
        return thread?.event_id ?? null;
      }).filter((id): id is string => Boolean(id)),
      ...answerableMeetings.map((m) => m.eventId),
      ...draftQuotes.map((q) => q.eventId).filter((id): id is string => Boolean(id)),
      ...draftContracts.map((c) => c.event_id),
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
  for (const ar of answerableAsks) {
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

  /*
    THE LAPSED ASK KEEPS ITS PLACE. Sorted on `requestedAt`, exactly like the
    answerable card it replaces, so the row does not move when the window shuts —
    it changes what it says. A row that simply vanishes reads as one you answered.
  */
  for (const ar of lapsedAsks) {
    const meta = eventMeta.get(ar.eventId);
    whatsNew.push({
      kind: 'lock_request_lapsed',
      id: `lockreq-lapsed-${ar.eventVendorId}`,
      eventId: ar.eventId,
      eventVendorId: ar.eventVendorId,
      eventDate: meta?.eventDate ?? null,
      requestedAt: ar.requestedAt,
      expiresAt: ar.expiresAt,
    });
  }

  /*
    EVERY UNANSWERED REVIEW, AT EVERY RATING. The shipped filter was
    `rating_overall !== 5 || vendor_reply` — so a ONE-STAR review, the one that
    most needs an answer, could never reach this desk at all, and nothing
    anywhere reported that it had been excluded. The rating rides on the card
    because it decides both the words and the colour (see `reviewTemper`).
  */
  for (const r of reviews) {
    if (!reviewNeedsReply(r)) continue;
    whatsNew.push({
      kind: 'review',
      id: `rev-${r.review_id}`,
      reviewId: r.review_id,
      coupleName: r.couple_display_name ?? 'A verified couple',
      quote: r.body?.trim() ? r.body.trim() : null,
      rating: typeof r.rating_overall === 'number' ? r.rating_overall : null,
      createdAt: r.created_at,
    });
  }

  // A reply owed inside a conversation this shop already accepted.
  for (const m of owedReplies) {
    const thread = acceptedThreads.find((t) => t.thread_id === m.threadId);
    if (!thread) continue;
    const meta = eventMeta.get(thread.event_id);
    whatsNew.push({
      kind: 'message',
      id: `msg-${m.threadId}`,
      threadId: m.threadId,
      eventId: thread.event_id,
      // Post-accept, so the couple's own event name is theirs to see. The
      // `events` embed on a vendor's thread read is null (a vendor holds no
      // events RLS), which is why this comes from the scoped meta read.
      coupleName: meta?.displayName ?? thread.event?.display_name ?? 'A couple',
      excerpt: m.excerpt,
      lastMessageAt: m.lastMessageAt,
    });
  }

  // The couple proposed a time. A passed proposal stays as a closed line.
  for (const mp of answerableMeetings) {
    const meta = eventMeta.get(mp.eventId);
    const passed = meetingAskPhase(mp.scheduledAt, now) === 'passed';
    whatsNew.push({
      kind: 'meeting',
      id: `appt-${mp.appointmentId}`,
      appointmentId: mp.appointmentId,
      eventId: mp.eventId,
      vendorProfileId,
      coupleName: meta?.displayName ?? 'A couple',
      label: mp.label,
      meetingKind: mp.meetingKind,
      location: mp.location,
      scheduledAt: mp.scheduledAt,
      durationMin: mp.durationMin,
      proposedAt: mp.proposedAt,
      passed,
    });
  }

  /*
    A QUOTE, THEN A CONTRACT, THAT NEVER WENT OUT.
    ⚠ THIS LIST IS DRAFTS, AND IT SAYS SO ON THE CARD. A quote can also be
    created-and-sent in one step from a chat thread (`sendProposalCore` inserts a
    draft and flips it to `sent` in the same call), so this lane cannot see that
    one at all — and when that flip fails it deletes its own draft, best effort.
    So "you have no unsent quotes" is a true statement about drafts, not a claim
    that every quote you ever wrote reached somebody.
  */
  for (const q of draftQuotes) {
    whatsNew.push({
      kind: 'quote_draft',
      id: `qd-${q.proposalId}`,
      proposalId: q.proposalId,
      publicId: q.publicId,
      eventId: q.eventId,
      title: q.title,
      totalCentavos: q.totalCentavos,
      createdAt: q.createdAt,
    });
  }

  for (const c of draftContracts) {
    whatsNew.push({
      kind: 'contract_draft',
      id: `cd-${c.contract_id}`,
      contractId: c.contract_id,
      eventId: c.event_id,
      title: c.title,
      createdAt: c.created_at,
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
  for (const ar of answerableAsks) {
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

  /*
    ⛔ THE DRAFT CONTRACTS ARE NOT LISTED TWICE. They used to live only here, as
    an open task with a hand-typed "Awaiting you" and no age; they are cards in
    the feed now, with the age every other row carries. Re-adding them here would
    put one thing in two lists with two different clocks.
  */

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
    // The lapsed ask keeps the answerable card's key on purpose — it must not
    // move when the window closes, only change what it says.
    case 'lock_request_lapsed':
      return new Date(card.requestedAt);
    case 'message':
      return new Date(card.lastMessageAt);
    /*
      A LIVE PROPOSAL IS ORDERED BY WHEN THEY ASKED; A PASSED ONE BY THE TIME
      THAT PASSED. Ordering a dead ask by how long it has been waiting would let
      a tasting that already happened claim the top of the list.
    */
    case 'meeting':
      return new Date(card.passed && card.scheduledAt ? card.scheduledAt : card.proposedAt);
    case 'quote_draft':
      return new Date(card.createdAt);
    case 'contract_draft':
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

// --- The four answers the desk gained (all vendor's-own-session reads) -------

/*
  ⛔ WHAT IS DELIBERATELY NOT HERE. Four kinds of answer a supplier is asked for
  elsewhere in this product do NOT join this desk, because the answer does not
  work yet — the waitlist pick, a paid crew shift, a guest's song request, and
  "somebody says they paid you". `ANSWERS_THAT_DO_NOT_JOIN` in
  `lib/answers-desk.ts` carries the reason on each, in one copy, and the guard
  reads that list rather than a hand-typed one. A row would be a door onto
  nothing: the supplier presses, something says it worked, and nobody is helped.
*/

type OwedReply = {
  threadId: string;
  excerpt: string | null;
  lastMessageAt: string;
};

/**
 * "Which conversations are waiting on ME?" — the LAST message in each accepted
 * thread, kept when the shop did not write it.
 *
 * 🔑 THE QUESTION IS AUTHORSHIP, NOT AN UNREAD MARKER. Reading a message is not
 * answering it, and `count_unread_message_threads()` answers a different
 * question (and only as a total).
 *
 * 🪤 NO SILENT CAP. One batched read, newest first, reduced to the first row per
 * thread. If it ever reaches the cap the truncation is LOGGED — an unreported
 * truncation on this desk would hide exactly the oldest owed answers, which are
 * the rows it exists to surface.
 */
const OWED_REPLY_SCAN_CAP = 2000;

async function fetchOwedThreadReplies(
  supabase: SupabaseClient,
  threadIds: string[],
): Promise<OwedReply[]> {
  if (threadIds.length === 0) return [];
  const { data, error } = await supabase
    .from('chat_messages')
    .select('thread_id, sender_role, body, created_at')
    .in('thread_id', threadIds)
    .order('created_at', { ascending: false })
    .limit(OWED_REPLY_SCAN_CAP);
  if (error) {
    logQueryError('vendor-overview:fetchOwedThreadReplies', error, {
      threadCount: threadIds.length,
    });
    return [];
  }
  const rows = (data ?? []) as Array<{
    thread_id: string;
    sender_role: string | null;
    body: string | null;
    created_at: string;
  }>;
  if (rows.length >= OWED_REPLY_SCAN_CAP) {
    console.warn(
      `[vendor-overview] owed-reply scan hit its ${OWED_REPLY_SCAN_CAP}-row cap over ` +
        `${threadIds.length} threads — the oldest owed replies may be missing from the desk.`,
    );
  }
  const newestPerThread = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    if (!newestPerThread.has(row.thread_id)) newestPerThread.set(row.thread_id, row);
  }
  const out: OwedReply[] = [];
  for (const row of newestPerThread.values()) {
    if (!threadOwesReply(row.sender_role)) continue;
    const body = row.body?.trim();
    out.push({
      threadId: row.thread_id,
      excerpt: body ? body.slice(0, 140) : null,
      lastMessageAt: row.created_at,
    });
  }
  return out;
}

type MeetingProposal = {
  appointmentId: string;
  eventId: string;
  label: string;
  meetingKind: AppointmentKind;
  location: string | null;
  scheduledAt: string | null;
  durationMin: number | null;
  proposedAt: string;
};

/**
 * Meeting times the COUPLE proposed and this shop has not answered.
 *
 * `initiated_by = 'couple'` is the whole point: `respondAppointment` refuses an
 * answer from the side that proposed, so a vendor-initiated row is not something
 * the vendor can answer — offering it would be a control that refuses the person
 * it is shown to.
 *
 * 🔑 `proposedAt` IS `updated_at`, NOT `created_at`. A propose-new keeps the same
 * row and flips authorship, so `created_at` is the first round's instant — using
 * it would overstate how long this supplier has owed an answer, on a desk whose
 * whole order is who has waited longest.
 *
 * The label resolves without the type catalog (`resolveAppointmentLabel` with no
 * preset map): a custom meeting's own name, else the type in words. One less read
 * on the home page, and it can never render a label from a stale catalog row.
 */
async function fetchCoupleMeetingProposals(
  supabase: SupabaseClient,
  vendorProfileId: string,
): Promise<MeetingProposal[]> {
  const { data, error } = await supabase
    .from('event_appointments')
    .select(
      'appointment_id, event_id, kind, type, custom_label, location, scheduled_at, duration_min, updated_at',
    )
    .eq('vendor_profile_id', vendorProfileId)
    .eq('status', 'proposed')
    .eq('initiated_by', 'couple')
    .order('updated_at', { ascending: true });
  if (error) {
    logQueryError('vendor-overview:fetchCoupleMeetingProposals', error, {
      vendor_profile_id: vendorProfileId,
    });
    return [];
  }
  return ((data ?? []) as Array<{
    appointment_id: string;
    event_id: string;
    kind: AppointmentKind;
    type: string;
    custom_label: string | null;
    location: string | null;
    scheduled_at: string | null;
    duration_min: number | null;
    updated_at: string;
  }>).map((r) => ({
    appointmentId: r.appointment_id,
    eventId: r.event_id,
    label: resolveAppointmentLabel({ type: r.type, custom_label: r.custom_label }, {}),
    meetingKind: r.kind,
    location: r.location,
    scheduledAt: r.scheduled_at,
    durationMin: r.duration_min,
    proposedAt: r.updated_at,
  }));
}

type UnsentQuote = {
  proposalId: string;
  publicId: string | null;
  eventId: string | null;
  title: string;
  totalCentavos: number | null;
  createdAt: string;
};

/** Quotes saved as drafts and never sent. See the card push for what this cannot see. */
async function fetchUnsentQuotes(
  supabase: SupabaseClient,
  vendorProfileId: string,
): Promise<UnsentQuote[]> {
  const { data, error } = await supabase
    .from('vendor_proposals')
    .select('proposal_id, public_id, event_id, title, total_centavos, created_at')
    .eq('vendor_profile_id', vendorProfileId)
    .eq('status', 'draft')
    .order('created_at', { ascending: true });
  if (error) {
    logQueryError('vendor-overview:fetchUnsentQuotes', error, {
      vendor_profile_id: vendorProfileId,
    });
    return [];
  }
  return ((data ?? []) as Array<{
    proposal_id: string;
    public_id: string | null;
    event_id: string | null;
    title: string | null;
    total_centavos: number | null;
    created_at: string;
  }>).map((r) => ({
    proposalId: r.proposal_id,
    publicId: r.public_id,
    eventId: r.event_id,
    title: r.title?.trim() || 'Untitled quote',
    totalCentavos: r.total_centavos,
    createdAt: r.created_at,
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
