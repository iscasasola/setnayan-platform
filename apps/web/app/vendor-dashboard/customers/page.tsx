import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CalendarDays, ChevronRight, MessageSquare, PhilippinePeso, Plus, Sparkles } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { createClient } from '@/lib/supabase/server';
import { logQueryError } from '@/lib/supabase/error-detect';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { VENDOR_CATEGORY_LABEL } from '@/lib/vendors';
import { formatPhp } from '@/lib/orders';
import { fetchVendorThreadsDetailed } from '@/lib/chat';
import { readAllPages, readInChunks } from '@/lib/read-all-pages';
import { pendingInquiryDates } from '@/lib/vendor-inquiry-dates';
import {
  fetchVendorBlocksDetailed,
  fetchVendorDayStates,
  fetchVendorPoolBookings,
  fetchVendorPools,
} from '@/lib/vendor-schedule';
import { fetchVendorWaitlist } from '@/lib/vendor-waitlist';
import { fetchVendorServices } from '@/lib/vendor-services';
import {
  fetchVendorTeam,
  enrichTeamWithUsers,
  fetchAgentServiceAssignments,
} from '@/lib/vendor-team';
import { tierCaps } from '@/lib/vendor-tier-caps';
import { manilaTodayIso } from '@/lib/vendor-cashflow';
import { readVendorPaydayInstallments } from '@/lib/vendor-payday-read';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  buildCustomerCalendarMonth,
  summarizeMonthlyPayments,
  computeEventMoneyPositions,
} from '@/lib/vendor-customers';
import {
  customerLaneOf,
  comparePipelineCustomers,
  groupByLane,
  holdingByDate,
  CUSTOMER_LANES,
  type CustomerLane,
  type PipelineCustomer,
} from '@/lib/vendor-customer-pipeline';
import { isLockHandshakeEnabled } from '@/lib/lock-handshake-flag';
import {
  CustomersRoster,
  type KeptNote,
  type OutsideClient,
  type RosterRow,
} from './_components/customers-roster';
import { CustomersPick } from './_components/customers-pick';
import { CustomersSegments, SegmentHashLander } from './_components/customers-segments';
import { PeopleThumb } from './_components/people-thumb';
import { MiniTour } from '@/app/_components/mini-tour';
import { rosterView } from './roster-view';
import { customersSegment, SECTION_SEGMENT, type CustomerSegment } from './anchors';
import { NO_FACTS, nextDueByEvent, peopleRowView, type PeopleFacts } from './people-row';
import { readVendorClosedLines } from '@/lib/vendor-closed-lines';
import { lockAskPhase } from '@/lib/answers-desk';
import { rowReadsCompleted } from '@/lib/vendor-thread-stage';
import { interestLabeller } from '@/lib/thread-interest-labels.server';
import { formatEventTypeLabel } from '@/lib/reviews';
import { importExternalClient, removeBlock } from '../calendar/actions';
import { SupplierSubmit } from '../_components/supplier-submit';
import { SupplierToast } from '../_components/supplier-toast';
import { shopInputClass } from '../_components/kit';
import { CustomersCalendar } from './_components/customers-calendar';
import type { FilterOption } from './_components/customers-filter-bar';
import { VendorQrSection } from '../_components/qr-section';
import { keepParamsFrom } from '../_components/list-pager';

export const metadata = { title: 'Customers' };

/**
 * /vendor-dashboard/customers — Customers: People · Dates · Money.
 *
 * One page, three views of the same bookings (supplier redesign S-PR2,
 * 2026-10-10; corpus `SUPPLIER_DASHBOARD_REDESIGN_2026-10-08_fable.md` § 2
 * "Customers" + § 3; prototype frame 03). The segment is `?seg=`, decided once
 * by the hub at the bottom of this file (`customersSegment`, `./anchors.ts`).
 *
 *   PEOPLE (default) — the roster: one hairline row per customer, the ones
 *     waiting on an answer first; Filter ▾; search + Add in the frosted thumb
 *     row. Outside clients and kept notes are rows of this same list. REDRAWN.
 *   DATES — the month calendar (the 6-state day taxonomy + bookings + blocks +
 *     the waitlist), days-full per service, the QR codes, and the Availability
 *     fold. The shipped blocks, unchanged, until S-PR3 redraws the segment.
 *   MONEY — this month's payments, the bookings list, the payday timeline, and
 *     the Quotes / Contracts folds. The shipped blocks, unchanged, until S-PR4.
 *
 * Every number resolves from a real query/RPC — all wired to LIVE,
 * vendor-scoped sources, no hard-coded figures. Where a value has no source yet
 * (a couple's venue before they set one) the row leaves it out rather than
 * inventing one; where a read FAILED the page says so rather than drawing the
 * empty answer.
 */

type Props = {
  searchParams: Promise<{
    m?: string;
    et?: string;
    cat?: string;
    lane?: string;
    /** The roster's page (1-based). Paged after the lane order, never before. */
    page?: string;
    /** Name search over the roster, applied before paging. */
    q?: string;
    /** `?add=outside` opens the Add sheet on People (the old round +'s link). */
    add?: string;
    /** The outcome of adding / removing an outside client, said once as a toast. */
    notice?: string;
  }>;
  /** People · Dates · Money — decided once by the hub (`customersSegment`). */
  seg: CustomerSegment;
};

/** What happened to an outside client — the words the retired Clients fold said. */
const OUTSIDE_NOTICES: Record<string, { refused: boolean; text: string }> = {
  client_imported: { refused: false, text: 'Client added — free. They now hold a slot on that schedule.' },
  block_removed: { refused: false, text: 'Outside client removed — the date is open again.' },
  bad_dates: { refused: true, text: 'Those dates don’t work — check the start and end date.' },
  bad_name: { refused: true, text: 'The client needs a name.' },
  bad_pool: { refused: true, text: 'Pick which schedule this client belongs to.' },
  save_failed: { refused: true, text: 'That didn’t save — try again.' },
};

/** Filter ▾'s words — the stage, as the row's pill says it. */
const LANE_FILTER_LABEL: Record<CustomerLane, string> = {
  // "Waiting" — the prototype's one word (frame 03); it was "Waiting on you".
  waiting: 'Waiting',
  holding: 'Holding',
  talking: 'Talking',
  booked: 'Booked',
  finished: 'Done',
};

/*
  🗑 `STATUS_PILL` LIVED HERE AND IS DELETED. It mapped five statuses —
  booked · locked · whitelist · waitlist · in_conversation — to pill colours,
  and the assembly loop below it could only ever produce TWO of them. `locked`,
  `whitelist` and `waitlist` were unreachable by construction: no code path
  wrote them onto a row. The register recorded "Booked and Waitlist filters
  already exist in customers/page.tsx"; measured, the PILL existed and the
  filter never did.

  ⛔ AND NO `waitlist` LANE REPLACES IT. A shop can be waitlisted against, but
  picking somebody off that waitlist does nothing today and still reports
  success — a chip whose only action is a lie is a fake door. The couple-facing
  waitlist queue still surfaces on the month calendar below as a per-day chip,
  where it says something true. Lane tones now live with the rows they colour,
  in `_components/customers-roster.tsx`.
*/

function categoryLabel(key: string): string {
  return (VENDOR_CATEGORY_LABEL as Record<string, string>)[key] ?? key.replace(/_/g, ' ');
}

async function CustomersPipeline({ searchParams, seg }: Props) {
  const search = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');

  const vendorProfileId = profile.vendor_profile_id;
  const todayIso = manilaTodayIso();
  const thisMonth = todayIso.slice(0, 7);
  const month = /^\d{4}-\d{2}$/.test(search.m ?? '') ? (search.m as string) : thisMonth;

  // All vendor-scoped reads in parallel. Each helper is the SAME one the
  // dedicated Calendar / Payday / Messages / Services pages use — one source of
  // truth per surface, no duplicated queries.
  const [
    pools,
    bookings,
    blocksRead,
    dayStates,
    waitlist,
    threadsRead,
    services,
    teamRows,
    paydayRes,
    tierProbe,
  ] = await Promise.all([
    fetchVendorPools(supabase, vendorProfileId),
    // CAPACITY, not the room: fullDatesForPool() counts these against each pool's
    // seat count. A booking with no pool cannot consume a pool seat.
    fetchVendorPoolBookings(supabase, vendorProfileId),
    // Paged to the server's count; `complete` drives a note over the calendar.
    fetchVendorBlocksDetailed(supabase, vendorProfileId),
    fetchVendorDayStates(supabase, vendorProfileId, `${month}-01`, `${month}-31`),
    // Waitlist for the visible month (the lib bounds by a from-date; a past
    // month simply returns nothing pending, which is correct).
    fetchVendorWaitlist(supabase, vendorProfileId, `${month}-01`),
    // Detailed: the roster says so on screen when the read could not prove it
    // reached every thread (`fetchVendorThreadsDetailed`).
    fetchVendorThreadsDetailed(supabase, vendorProfileId),
    fetchVendorServices(supabase, vendorProfileId),
    fetchVendorTeam(supabase, vendorProfileId),
    // Frozen installment plan across all booked events (ownership-gated RPC),
    // paged to the server's exact count — see `lib/vendor-payday-read.ts`.
    readVendorPaydayInstallments(supabase),
    // tier_state is excluded from the profile select → isolated probe (matches
    // the chat-send / proposal-send convention). Gates the Agent filter.
    supabase
      .from('vendor_profiles')
      .select('tier_state')
      .eq('vendor_profile_id', vendorProfileId)
      .maybeSingle(),
  ]);

  const threads = threadsRead.threads;
  const blocks = blocksRead.blocks;
  const blocksIncomplete = !blocksRead.complete;

  // Agent filtering is a subscription feature — enabled only when the tier
  // grants agent accounts (Pro+, agentAccounts > 0). A vendor who drops below
  // Pro loses it. Resolve which service categories each agent covers so the
  // filter can narrow the calendar to that agent's schedule.
  const tier = (tierProbe.data as { tier_state?: string } | null)?.tier_state ?? null;
  const agentsEnabled = tierCaps(tier).agentAccounts > 0;
  const agentCategories: Record<string, string[]> = {};
  if (agentsEnabled && teamRows.length > 0) {
    try {
      const assignments = await fetchAgentServiceAssignments(supabase, vendorProfileId);
      const categoryByServiceId = new Map(
        services.map((s) => [s.vendor_service_id, s.category]),
      );
      for (const [memberId, serviceIds] of Object.entries(assignments)) {
        const cats = new Set<string>();
        for (const sid of serviceIds) {
          const cat = categoryByServiceId.get(sid);
          if (cat) cats.add(cat);
        }
        agentCategories[memberId] = [...cats];
      }
    } catch {
      // Fail-soft: no assignment map → agent options still render, but selecting
      // one narrows to nothing rather than blocking the page.
    }
  }

  // ⚠ MONEY. A payday read that did not reach the server's count is NOT added
  // up: the tile says some payments couldn't load and the roster's money notes
  // stay off, rather than showing a "collected of expected" that is too small.
  const paydayIncomplete = !paydayRes.complete;
  if (paydayIncomplete) {
    logQueryError(
      'VendorCustomersPage.paydayInstallments',
      {
        message:
          paydayRes.error ??
          `read ${paydayRes.rows.length} rows without reaching the server count`,
      },
      { vendorProfileId },
      'graceful_degrade',
    );
  }
  const paydayRows = paydayIncomplete ? [] : paydayRes.rows;

  // The dates couples are ASKING about. Derived from `threads`, which this page
  // already loads — zero new queries, and a COUNT only: a pending enquiry is
  // pre-accept, so the couple's identity must not reach the calendar.
  const inquiryDates = pendingInquiryDates(threads);

  // ── Section 2: month calendar ────────────────────────────────────────────
  const calendar = buildCustomerCalendarMonth(
    pools,
    bookings,
    blocks,
    dayStates,
    waitlist,
    month,
    todayIso,
    inquiryDates,
  );

  // ── Section 3a: this-month payments roll-up ──────────────────────────────
  const payments = summarizeMonthlyPayments(paydayRows, month);
  const collectPct =
    payments.expectedPhp > 0
      ? Math.min(100, Math.round((payments.collectedPhp / payments.expectedPhp) * 100))
      : 0;

  // ── Section 3c: service coverage ─────────────────────────────────────────
  // Per active service: is it live, and how many dates in the visible month is
  // its schedule full? "Full N dates" counts fully-booked days on the pool(s)
  // that carry the service's category.
  const activeServices = services.filter((s) => s.is_active);
  const poolsForCategory = (cat: string) =>
    pools.filter((p) => p.categories.includes(cat));
  const fullDatesForPool = (poolId: string, cap: number): number => {
    if (cap <= 0) return 0;
    const consumed = new Map<string, number>();
    for (const b of bookings) {
      if (b.poolId !== poolId) continue;
      if (b.bookedDate.slice(0, 7) !== month) continue;
      consumed.set(b.bookedDate, (consumed.get(b.bookedDate) ?? 0) + 1);
    }
    for (const blk of blocks) {
      if (blk.source !== 'external_client' || blk.poolId !== poolId) continue;
      for (const day of calendar.days) {
        if (day.date < blk.startDate || day.date > blk.endDate) continue;
        consumed.set(day.date, (consumed.get(day.date) ?? 0) + 1);
      }
    }
    let full = 0;
    for (const n of consumed.values()) if (n >= cap) full += 1;
    return full;
  };
  const serviceCoverage = activeServices.slice(0, 3).map((s) => {
    const catPools = poolsForCategory(s.category);
    const fullDates = catPools.reduce(
      (sum, p) => sum + fullDatesForPool(p.poolId, p.capacity),
      0,
    );
    return {
      key: s.vendor_service_id,
      label: s.title?.trim() || categoryLabel(s.category),
      fullDates,
    };
  });

  // ── Section 4 (NOW THE PAGE'S FIRST BLOCK): the customers roster ─────────
  //
  // 🔴 WHAT THIS REPLACED, AND WHY. The roster was assembled from exactly two
  // sources — live pool bookings, and chat threads whose `inquiry_status` was
  // ALREADY 'accepted'. So a couple who had asked and not been accepted, and a
  // couple waiting on this shop's yes, were both invisible on the page called
  // "my customers". Its own `STATUS_PILL` map carried `locked`, `whitelist` and
  // `waitlist` labels that NO ROW COULD EVER HOLD: the loop below only ever
  // wrote `booked` or `in_conversation`. Three of five pills were unreachable.
  //
  // 🔑 THE LANES ARE DERIVED IN ONE PURE MODULE, not here. This block's job is
  // to gather the three inputs — the shop's bookings, its threads, and the
  // non-identifying facts a masked row needs — and hand them over.
  const moneyByEvent = computeEventMoneyPositions(paydayRows);
  const handshakeEnabled = isLockHandshakeEnabled();
  // ONE "now" for the whole derivation and the render, so a customer cannot sit
  // one side of the quiet boundary in the lane count and the other on the row.
  const rosterNowMs = Date.now();

  /*
    THE SHOP'S OWN `event_vendors` ROWS — read with the ADMIN CLIENT, SCOPED BY
    THE CALLER'S OWN PROFILE ID.

    🔴 NOT AN OPTIMISATION. Measured against production 2026-08-28 as the shop's
    own authenticated role, in a rolled-back transaction: `event_vendors` carries
    four policies — couple read, couple write, moderator read, moderator write —
    and NOT ONE admits a vendor. The shop that is genuinely booked on the one
    marketplace booking in production reads ZERO rows of it through its own
    session. This is the same shape `fetchLockAgreementRequests` uses on the
    Answers Desk, and the reason a vendor SELECT policy on `event_vendors` is
    deliberately not opened: it would hand suppliers the couple's whole booking
    row, budget figures included. The id it filters on came from this caller's
    own session one line earlier.

    ⚠ AN UNREADABLE BOOKING SET IS NOT AN EMPTY ONE. Refused, every booked and
    finished customer silently leaves the roster and the shop reads it as having
    no clients — so the error is logged rather than swallowed by `?? []`.
  */
  const rosterAdmin = createAdminClient();
  /*
    ⚠ PAGED TO THE SERVER'S EXACT COUNT. One un-ranged SELECT here was capped by
    PostgREST (Supabase default 1000 rows) with `error: null`, so past a
    thousand bookings the rest silently left the roster.
  */
  const evRead = await readAllPages(
    async (from, to) => {
      const { data, error, count } = await rosterAdmin
        .from('event_vendors')
        .select(
          'vendor_id, event_id, status, lock_request_state, lock_requested_at, lock_request_expires_at, completion_status, customer_confirmed_received_at',
          { count: 'exact' },
        )
        .eq('marketplace_vendor_id', vendorProfileId)
        .is('archived_at', null)
        // A covered cascade line carries no request of its own — only the anchor is
        // asked — and folding one in would put the same celebration on the roster
        // twice. Same filter the Answers Desk applies to the identical question.
        .or('package_role.is.null,package_role.eq.anchor')
        .order('vendor_id', { ascending: true })
        .range(from, to);
      return { rows: data ?? null, error: error ? error.message : null, total: count };
    },
    { pageSize: 1000 },
  );
  const evRows = evRead.rows;
  if (evRead.error || !evRead.complete) {
    logQueryError(
      'VendorCustomersPage.rosterBookings',
      { message: evRead.error ?? `read ${evRead.rows.length} rows without reaching the server count` },
      { vendor_profile_id: vendorProfileId },
      'graceful_degrade',
    );
  }
  const bookingRows = (evRows ?? []) as {
    vendor_id: string;
    event_id: string;
    status: string | null;
    lock_request_state: string | null;
    lock_requested_at: string | null;
    lock_request_expires_at: string | null;
    completion_status: string | null;
    customer_confirmed_received_at: string | null;
  }[];
  const bookingByEvent = new Map(bookingRows.map((r) => [r.event_id, r]));

  // One thread per event — the newest, since `fetchVendorThreads` already
  // returns them newest-first. A second thread on the same celebration is one
  // customer, not two rows.
  const threadByEvent = new Map<string, (typeof threads)[number]>();
  for (const t of threads) if (!threadByEvent.has(t.event_id)) threadByEvent.set(t.event_id, t);

  // Booked events (live pool reservations) grouped by event — RETAINED
  // UNCHANGED because the CALENDAR reads its venue/type enrichment below.
  const bookedByEvent = new Map<
    string,
    { eventName: string; eventDate: string | null; threadId: string | null }
  >();
  for (const b of bookings) {
    if (!bookedByEvent.has(b.eventId)) {
      bookedByEvent.set(b.eventId, {
        eventName: b.eventName,
        eventDate: null,
        threadId: b.threadId,
      });
    }
  }

  // Enrich with date + venue + type via the admin client — the vendor is party
  // to the booking but holds no `events` RLS. Request-local maps (never module
  // state) so concurrent requests never bleed venues into each other.
  const venueByEvent = new Map<string, string | null>();
  const eventTypeByEvent = new Map<string, string | null>();
  const eventNameByEvent = new Map<string, string | null>();
  const eventDateByEvent = new Map<string, string | null>();
  const rosterEventIds = [
    ...new Set([...bookedByEvent.keys(), ...bookingByEvent.keys(), ...threadByEvent.keys()]),
  ];
  let eventRowsErrorSeen = false;
  if (rosterEventIds.length > 0) {
    // Chunked: one `in.()` over every customer is a URL, and past ~600 UUIDs
    // the gateway refuses it 400 — every name and date on the roster at once.
    const { rows: eventRows, error: eventRowsError } = await readInChunks(
      rosterEventIds,
      (part) =>
        rosterAdmin
          .from('events')
          .select('event_id, display_name, event_date, venue_name, event_type')
          .in('event_id', part),
    );
    // ⚠ THE EVENT DATE, VENUE AND TYPE for every booked client. Refused, all
    // ⚠ three go null: the date column empties, the venue disappears, and the
    // ⚠ list SORTS DIFFERENTLY — rows without a date fall to the bottom, so the
    // ⚠ wedding happening next week stops being at the top of the supplier's
    // ⚠ own client list. An absence that quietly re-orders is worse than one
    // ⚠ that empties, because nothing on screen looks missing.
    if (eventRowsError) {
      eventRowsErrorSeen = true;
      logQueryError(
        'VendorCustomersPage.eventRows',
        eventRowsError,
        {},
        'graceful_degrade',
      );
    }
    for (const e of (eventRows ?? []) as {
      event_id: string;
      display_name: string | null;
      event_date: string | null;
      venue_name: string | null;
      event_type: string | null;
    }[]) {
      const g = bookedByEvent.get(e.event_id);
      if (g) g.eventDate = e.event_date;
      venueByEvent.set(e.event_id, e.venue_name);
      eventTypeByEvent.set(e.event_id, e.event_type);
      eventNameByEvent.set(e.event_id, e.display_name);
      eventDateByEvent.set(e.event_id, e.event_date);
    }
  }

  /*
    NO MASK (owner ruling 2026-09-08 — "we do not need to hide anything, since
    no more tokens"). Every row rendered the neutral placeholder — "A couple
    planning a wedding in Metro Manila" — until the shop was "entitled" to the
    name, because accepting cost a token and identity was what the token bought.
    The token wallet was retired on 2026-05-11, so the placeholder was charging
    nothing for something it withheld from a supplier the couple had written to.

    🔑 THE NAME WAS ALREADY HERE. `eventNameByEvent` is filled from `rosterAdmin`
    above — the roster has always held the couple's real display name and threw
    it away at render.

    ⚠ FLIPPING THE CALLER WAS NOT THE WHOLE CHANGE, though this comment said so
    for eleven days. `customerLaneOf` gated identity by LANE and never consulted
    the flag for `waiting`, so a couple who had just asked to lock still read
    "Customer" with a "·" mark (owner report 2026-09-19). The gate is gone; the
    derivation now names every row that has a name.
  */
  const derived: PipelineCustomer[] = [];
  for (const eventId of rosterEventIds) {
    const t = threadByEvent.get(eventId);
    const b = bookingByEvent.get(eventId);
    const row = customerLaneOf(
      {
        eventId,
        thread: t
          ? {
              threadId: t.thread_id,
              inquiryStatus: t.inquiry_status ?? null,
              createdAt: t.created_at ?? null,
              // The LAST thing that happened, from either side — what separates
              // a live conversation from something the shop is holding.
              lastActivityAt: t.updated_at ?? null,
            }
          : null,
        booking: b
          ? {
              eventVendorId: b.vendor_id,
              status: b.status,
              lock_request_state: b.lock_request_state,
              requestedAt: b.lock_requested_at,
              expiresAt: b.lock_request_expires_at,
              // "Is it finished?" — the ONE predicate the thread pill uses too.
              completed: rowReadsCompleted(b),
            }
          : null,
        // The name is supplied for every event and used on every lane.
        eventName:
          eventNameByEvent.get(eventId) ?? bookedByEvent.get(eventId)?.eventName ?? null,
        // FALLBACK ONLY — reached solely when the event genuinely has no
        // `display_name`, never to hide one.
        descriptor: 'Customer',
        eventDate: eventDateByEvent.get(eventId) ?? null,
        place: venueByEvent.get(eventId) ?? null,
        // A live hold in this shop's own pool. The roster this replaced derived
        // "booked" from THIS ALONE; carrying it forward is what stops the
        // rewrite from silently dropping a customer whose `event_vendors` row is
        // archived or was never stamped with a marketplace id.
        poolBooked: bookedByEvent.has(eventId),
      },
      handshakeEnabled,
      rosterNowMs,
    );
    if (row) derived.push(row);
  }

  const lanes = groupByLane(derived);

  /*
    ── ONE LIST, NOT TWO (S-PR2) ────────────────────────────────────────────
    An outside client — a date this shop sold outside Setnayan and wrote down so
    the app would not double-book it — used to live in a second list, in the
    "Clients" fold. It is a row of THIS list now, wearing an "Outside" pill.

    It holds a date, so it sits with the booked while that date is ahead and
    with the done once it has passed. It is not a Setnayan customer: no event,
    no thread, no card — `outsideById` carries what the row can show, and the
    row opens in place.

    ⚠ `blocks` is the same paged read the calendar uses; when it did not reach
    the server's count the roster says so (`rosterIncomplete`, below).
  */
  const poolLabelById = new Map(pools.map((p) => [p.poolId, p.label]));
  const outsideById = new Map<string, OutsideClient>();
  for (const k of blocks) {
    if (k.source !== 'external_client') continue;
    const id = `outside:${k.blockId}`;
    const lane: CustomerLane = k.endDate >= todayIso ? 'booked' : 'finished';
    const name = (k.clientName ?? k.label)?.trim() || null;
    lanes[lane].push({
      eventId: id,
      lane,
      waitingKind: null,
      waitingSince: null,
      expiresAt: null,
      quietDays: null,
      title: name ?? 'Outside client',
      identityRevealed: name !== null,
      eventDate: k.startDate,
      place: null,
      threadId: null,
      eventVendorId: null,
    });
    outsideById.set(id, {
      blockId: k.blockId,
      schedule: (k.poolId ? poolLabelById.get(k.poolId) : null) ?? 'Schedule',
      contact: k.clientContact,
      note: k.clientNote,
    });
  }
  // Soonest date first, among the booked and among the done — an outside client
  // sits where its date puts it, not at the end of the lane.
  if (outsideById.size > 0) {
    lanes.booked.sort(comparePipelineCustomers);
    lanes.finished.sort(comparePipelineCustomers);
  }
  /*
    Computed over EVERY derived customer, never over the page on screen —
    filtering to a lane must not make a date clash disappear. That is the
    difference between a warning and a decoration.
  */
  const holdingPerDate = holdingByDate(derived);

  /*
    COUNT, NARROW, SEARCH, PAGE — in that order, in one pure step
    (`./roster-view.ts`, executed by `the-roster-pages.test.ts`).

    🔑 THE CHIPS AND THE HEADING COUNT EVERYONE. `laneCounts` comes from the
    whole `lanes`; only `roster.paged.items` — one page of 20 — reaches the
    render (owner 2026-09-19: "if they have 1000 inquiries, they can still
    manage all and still be able to see the lower parts of the page").
  */
  const picked = rosterView(lanes, {
    lane: search.lane,
    q: search.q,
    page: search.page,
    decorate: (r) => r,
  });

  /*
    ── WHAT EACH ROW ON THIS PAGE SAYS (S-PR2) ──────────────────────────────
    Read for the ROWS ON THE PAGE only — twenty ids, never one `in.()` of every
    customer — and only when People is the segment on screen.

    🔴 EVERY ONE OF THESE CAN FAIL, AND NONE MAY FAIL AS A FACT:
      · the quote read refused → `quoted: null` → the row says "Talking" and no
        more (never "send a quote" to a shop whose quote is already out);
      · payday not read to the end → `moneyRead: false` → no money line;
      · the flagged-delay / missed-meeting reads refused → said above the list;
      · what they asked about is a decoration: unread, the line is simply absent.
  */
  const pageRows = picked.paged.items;
  const onPeople = seg === 'people';
  const customerRows = pageRows.filter((r) => !outsideById.has(r.eventId));
  const talkingIds = customerRows.filter((r) => r.lane === 'talking').map((r) => r.eventId);
  const pageThreadIds = customerRows.map((r) => r.threadId).filter((id): id is string => Boolean(id));

  const [quotedRead, interestRead, closedLines, keptRead] = await Promise.all([
    onPeople && talkingIds.length > 0
      ? supabase
          .from('vendor_proposals')
          .select('event_id')
          .eq('vendor_profile_id', vendorProfileId)
          .in('event_id', talkingIds)
          .in('status', ['sent', 'viewed'])
      : Promise.resolve({ data: [] as { event_id: string }[], error: null }),
    onPeople && pageThreadIds.length > 0
      ? supabase
          .from('thread_service_interests')
          .select('thread_id, category_key, vendor_service_id, created_at')
          .in('thread_id', pageThreadIds)
          .order('created_at', { ascending: true })
      : Promise.resolve({ data: [] as { thread_id: string; category_key: string | null; vendor_service_id: string | null }[], error: null }),
    onPeople
      ? readVendorClosedLines(supabase, vendorProfileId, rosterNowMs)
      : Promise.resolve({ delayFlagged: new Set<string>(), meetingPassed: new Set<string>(), complete: true }),
    /*
      KEPT NOTES — the supplier's own notes whose event was deleted (owner
      2026-08-24: "the supplier keeps the note, but it stops being filed under
      that person's name"). ⚠ WITHOUT THIS READ THE KEEPING IS A FICTION: the
      only other reader filters `.eq('event_id', …)`, so a severed note would be
      preserved and permanently invisible.
    */
    onPeople
      ? supabase
          .from('vendor_client_notes')
          .select('note_id, body, created_at')
          .eq('vendor_profile_id', vendorProfileId)
          .is('event_id', null)
          .order('created_at', { ascending: false })
          .limit(50)
      : Promise.resolve({ data: [] as { note_id: string; body: string; created_at: string }[], error: null }),
  ]);

  // ⚠ WHICH CUSTOMERS THEY HAVE ALREADY QUOTED. Refused, the set would be empty
  // and every quoted customer would read "send a quote" — so a refusal is kept
  // as `null`, and the row then claims nothing about a quote.
  if (quotedRead.error) {
    logQueryError('VendorCustomersPage.quoted', quotedRead.error, { vendorProfileId }, 'graceful_degrade');
  }
  const quotedIds = quotedRead.error
    ? null
    : new Set(((quotedRead.data ?? []) as { event_id: string }[]).map((r) => r.event_id));

  // WHAT THEY ASKED ABOUT — every category on the one thread (a couple can ask
  // about several in one inquiry; it is still one inquiry and one row).
  if (interestRead.error) {
    logQueryError('VendorCustomersPage.interests', interestRead.error, { vendorProfileId }, 'graceful_degrade');
  }
  const interests = (interestRead.error ? [] : (interestRead.data ?? [])) as Array<{
    thread_id: string;
    category_key: string | null;
    vendor_service_id: string | null;
  }>;
  const labelInterest = interests.length > 0 ? await interestLabeller(rosterAdmin, interests) : null;
  const askedByThread = new Map<string, string[]>();
  for (const i of interests) {
    if (!labelInterest || (!i.category_key && !i.vendor_service_id)) continue;
    const label = labelInterest(i);
    const list = askedByThread.get(i.thread_id) ?? [];
    if (label && !list.includes(label)) list.push(label);
    askedByThread.set(i.thread_id, list);
  }

  // 🔑 A FAILED READ IS NOT AN EMPTY ONE: on a refusal the kept-notes row is not
  // drawn at all — never "you wrote none".
  if (keptRead.error) {
    logQueryError('VendorCustomersPage.keptNotes', keptRead.error, { vendorProfileId }, 'graceful_degrade');
  }
  const keptNotes: KeptNote[] = keptRead.error
    ? []
    : ((keptRead.data ?? []) as { note_id: string; body: string; created_at: string }[]).map((n) => ({
        noteId: n.note_id,
        body: n.body,
        createdAt: n.created_at,
      }));

  const nextDue = nextDueByEvent(paydayRows);
  /*
    A booking ask the sweep has ALREADY flipped to `expired`, still inside the
    week the desk keeps a closed line. The row is no longer a `booking_ask` by
    then — it falls back to its thread's lane — so its deadline is read off the
    shop's own booking row and handed in. (An ask still `pending` past its
    deadline is caught by the row itself.)
  */
  const askClosedAt = (eventId: string): string | null => {
    const b = bookingByEvent.get(eventId);
    return b && b.lock_request_state === 'expired' && lockAskPhase(b.lock_request_expires_at, rosterNowMs) === 'lapsed'
      ? b.lock_request_expires_at
      : null;
  };
  const factsFor = (r: PipelineCustomer): PeopleFacts => ({
    ...NO_FACTS,
    quoted: quotedIds ? quotedIds.has(r.eventId) : null,
    money: moneyByEvent.get(r.eventId) ?? null,
    moneyRead: !paydayIncomplete,
    nextDue: nextDue.get(r.eventId) ?? null,
    delayFlagged: closedLines.delayFlagged.has(r.eventId),
    meetingPassed: closedLines.meetingPassed.has(r.eventId),
    askClosedAt: askClosedAt(r.eventId),
  });
  const toRow = (r: PipelineCustomer): RosterRow => {
    const outside = outsideById.get(r.eventId) ?? null;
    if (outside) {
      return {
        ...r,
        outside,
        eventType: null,
        askedAbout: [],
        view: { pill: { label: 'Outside', tone: 'quiet' }, line: null, lineTone: null, opens: 'card', closed: null },
      };
    }
    const type = eventTypeByEvent.get(r.eventId) ?? null;
    return {
      ...r,
      outside: null,
      eventType: type ? formatEventTypeLabel(type) : null,
      askedAbout: (r.threadId ? askedByThread.get(r.threadId) : null) ?? [],
      // ONE "now" for the lanes and for what each row says.
      view: peopleRowView(r, factsFor(r), rosterNowMs),
    };
  };
  const roster = { ...picked, paged: { ...picked.paged, items: pageRows.map(toRow) } };
  const laneCounts = roster.laneCounts;
  const activeLane = roster.activeLane;
  const rosterPage = roster.paged;
  // A read that could not prove it reached every row — said on screen, never
  // shown as a shorter list. `blocksRead` joined with the outside clients.
  const rosterIncomplete =
    !threadsRead.complete || !evRead.complete || Boolean(evRead.error) || eventRowsErrorSeen || !blocksRead.complete;

  // Filter option sets (real data · presentational for now).
  const serviceOptions: FilterOption[] = [
    ...new Map(
      services.map((s) => [
        s.category,
        { value: s.category, label: categoryLabel(s.category) } as FilterOption,
      ]),
    ).values(),
  ];
  const eventTypeOptions: FilterOption[] = (profile.event_types ?? []).map((t) => ({
    value: t,
    label: t.charAt(0).toUpperCase() + t.slice(1),
  }));
  // Agent labels need users.email/display_name, which is owner-only RLS
  // (Pattern A) — resolve via the admin client. Fail-soft: if enrichment throws
  // we fall back to the team labels so the select never blocks the page.
  let agentOptions: FilterOption[] = [];
  if (teamRows.length > 0) {
    try {
      const teamWithUser = await enrichTeamWithUsers(createAdminClient(), teamRows);
      agentOptions = teamWithUser.map((m) => ({
        value: m.vendor_team_member_id,
        label: m.display_name?.trim() || m.email || m.team_label?.trim() || 'Team member',
      }));
    } catch {
      agentOptions = teamRows.map((m) => ({
        value: m.vendor_team_member_id,
        label: m.team_label?.trim() || 'Team member',
      }));
    }
  }

  const dayHrefBase = '/vendor-dashboard/calendar';

  /*
    Filter ▾ — each option is a LINK the server builds (a filter you can share,
    Back works). Picking resets to page 1 and keeps everything else on the page.
  */
  const pickHref = (value: string | null): string => {
    const q = new URLSearchParams(keepParamsFrom(search as Record<string, string | undefined>, ['page', 'lane', 'add', 'notice']));
    if (value) q.set('lane', value);
    const qs = q.toString();
    return qs ? `?${qs}#customers` : '?#customers';
  };
  const outsideNotice = search.notice ? OUTSIDE_NOTICES[search.notice] : undefined;

  /*
    ➕ THE SHIPPED OUTSIDE-CLIENT FORM, in the Add sheet (owner 2026-10-01,
    answer 3: "+ on Customers adds an outside client"). Same action, same
    fields, same free — it lived in the retired Clients fold; nothing new takes
    the client. An outside client holds a date on one of the shop's schedules,
    so with none set up there is nowhere to hold it: said, with the way in.
  */
  const addForm =
    pools.length > 0 ? (
      <form action={importExternalClient} className="grid gap-2" data-people-add-form="">
        <h2 id="people-add-title" className="pr-10 text-lg font-semibold text-ink">
          Add an outside client · free
        </h2>
        <p className="text-[13px] text-ink/60">
          A date you sold outside Setnayan. They hold it on your schedule, so that day is never double-booked.
        </p>
        <input type="hidden" name="return_to" value="clients" />
        <label className="sr-only" htmlFor="people-add-pool">
          Schedule
        </label>
        <select id="people-add-pool" name="pool_id" required defaultValue={pools[0]?.poolId} className={shopInputClass}>
          {pools.map((p) => (
            <option key={p.poolId} value={p.poolId}>
              {p.label}
            </option>
          ))}
        </select>
        <input type="text" name="client_name" required placeholder="Client name" aria-label="Client name" maxLength={120} className={shopInputClass} />
        <input type="text" name="client_contact" placeholder="Contact (optional)" aria-label="Contact" maxLength={160} className={shopInputClass} />
        <input type="text" name="client_note" placeholder="Note (optional)" aria-label="Note" maxLength={500} className={shopInputClass} />
        <div className="flex flex-wrap items-center gap-2">
          <input type="date" name="start_date" required aria-label="First day" className={shopInputClass} />
          <span className="text-sm text-ink/50">to</span>
          <input type="date" name="end_date" aria-label="Last day" className={shopInputClass} />
        </div>
        <div className="mt-1 flex justify-end">
          <SupplierSubmit tone="brand" main icon={<Plus aria-hidden="true" strokeWidth={1.9} />} label="Add · free" pendingLabel="Adding…" />
        </div>
      </form>
    ) : (
      <div className="grid gap-3" data-people-add-form="no-schedule">
        <h2 id="people-add-title" className="pr-10 text-lg font-semibold text-ink">
          Add an outside client · free
        </h2>
        <p className="text-sm text-ink/65">
          To add an outside client, set up a schedule first — it holds the date for them.
        </p>
        <div>
          <ActionButton
            tone="neutral"
            icon={<CalendarDays aria-hidden="true" strokeWidth={1.9} />}
            label="Set up a schedule"
            href="/vendor-dashboard/customers?seg=dates&open=availability#customer-tools"
          />
        </div>
      </div>
    );

  return (
    // Glass PR-7: the opaque `--m-paper` body wrapper is dropped — the Atelier
    // wash (`.sn-ambient`, inherited from the shell) shows through the glass tiles.
    <section className="min-h-full">
      <div className={`mx-auto w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl px-4 sm:px-6 lg:px-8 ${onPeople ? 'space-y-1 pb-36 pt-3 sm:pt-8' : 'space-y-6 py-8 sm:py-10'}`}>
        {/*
          PEOPLE · DATES · MONEY — one page, three views of the same bookings
          (S-PR2). The segment is `?seg=`; `customers/anchors.ts` says which
          segment every id and fold lives on.
        */}
        <CustomersSegments active={seg} waiting={laneCounts.waiting} />
        <SegmentHashLander active={seg} />

        {/*
          PEOPLE — the list, and nothing under it. Customers opens on who is
          waiting.
        */}
        {onPeople ? (
          <>
            {outsideNotice ? <SupplierToast text={outsideNotice.text} refused={outsideNotice.refused} /> : null}
            <CustomersRoster
              rows={rosterPage.items}
              paged={rosterPage}
              query={search.q ?? ''}
              incomplete={rosterIncomplete}
              closedLinesUnread={!closedLines.complete}
              pagerKeepParams={keepParamsFrom(search as Record<string, string | undefined>, ['page', 'add', 'notice'])}
              clearSearchHref={(() => {
                const keep = keepParamsFrom(search as Record<string, string | undefined>, ['page', 'q', 'add', 'notice']);
                return keep ? `?${keep}#customers` : '?#customers';
              })()}
              counts={laneCounts}
              holdingPerDate={holdingPerDate}
              keptNotes={keptNotes}
              removeOutside={removeBlock}
              filter={
                <CustomersPick
                  label="Filter"
                  value={activeLane ?? 'all'}
                  dataAttr="data-customers-filter"
                  options={[
                    { key: 'all', label: `Everyone · ${formatCount(CUSTOMER_LANES.reduce((n, l) => n + laneCounts[l], 0))}`, href: pickHref(null) },
                    ...CUSTOMER_LANES.map((l) => ({
                      key: l,
                      label: `${LANE_FILTER_LABEL[l]} · ${formatCount(laneCounts[l])}`,
                      href: pickHref(l),
                    })),
                  ]}
                />
              }
            />
            <PeopleThumb
              query={search.q ?? ''}
              addForm={addForm}
              // `?add=outside` is the old round +'s link; a refused save reopens the form.
              addOpen={search.add === 'outside' || Boolean(outsideNotice?.refused)}
            />
          </>
        ) : null}

        {/*
          DATES — the shipped month calendar, the day-full note per service and
          the QR codes, as they were. S-PR3 redraws this segment.
        */}
        {seg === 'dates' ? (
          <>
        {/* Sections 1 + 2 — filter row + month calendar (centrepiece).
            `id="calendar"` is where every bare /vendor-dashboard/calendar link
            lands (`customers/anchors.ts`). */}
        <div id="calendar" className="scroll-mt-24">
        {blocksIncomplete ? (
          <p role="status" className="mb-3 rounded-xl border border-warn-200 bg-warn-50 px-4 py-3 text-sm text-warn-900">
            Some of your blocked dates couldn&rsquo;t load, so a date you closed may show as open
            here. Reload the page to try again.
          </p>
        ) : null}
        <CustomersCalendar
          initialDayStates={dayStates}
          initialWaitlist={waitlist}
          inquiries={inquiryDates}
          initialMonth={month}
          todayIso={todayIso}
          pools={pools}
          // Ship only the fields the client-side rebuild reads — raw block
          // client-contact fields (clientName/clientContact/clientNote) never
          // cross the wire. Bookings also carry event_type (for the Type
          // filter), resolved via the admin events lookup above.
          bookings={bookings.map((b) => ({
            poolId: b.poolId,
            bookedDate: b.bookedDate,
            eventName: b.eventName,
            eventType: eventTypeByEvent.get(b.eventId) ?? null,
          }))}
          blocks={blocks.map((k) => ({
            poolId: k.poolId,
            source: k.source,
            startDate: k.startDate,
            endDate: k.endDate,
          }))}
          dayHrefBase={dayHrefBase}
          types={eventTypeOptions}
          services={serviceOptions}
          agents={agentOptions}
          agentsEnabled={agentsEnabled}
          agentCategories={agentCategories}
        />
        </div>

        {/* How many dates each service is full on this month — a fact about
            DATES (it was one of three summary tiles under the roster). Kept as it
            was until S-PR3 redraws the segment. */}
        <div className="grid gap-4 md:grid-cols-3">
          {/* Service coverage */}
          <article className="sn-tile">
            <p className="sn-eye">
              <span
                aria-hidden
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
                style={{ background: 'var(--sn-gold-100)', color: 'var(--sn-gold-800)' }}
              >
                <Sparkles className="h-4 w-4" strokeWidth={1.75} />
              </span>
              Service coverage
            </p>
            {serviceCoverage.length === 0 ? (
              <p className="mt-3 text-sm" style={{ color: 'var(--m-slate-2)' }}>
                No services yet. Add a service to set your coverage so couples can
                find and book you.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {serviceCoverage.map((s) => (
                  <li key={s.key} className="flex items-start justify-between gap-3 text-sm">
                    <span className="min-w-0 flex-1 truncate" style={{ color: 'var(--m-ink)' }}>
                      {s.label}
                    </span>
                    <span className="shrink-0 text-right">
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
                        style={{
                          background: 'rgba(79,107,74,0.12)',
                          color: 'var(--m-sage-deep)',
                        }}
                      >
                        Covered
                      </span>
                      {s.fullDates > 0 ? (
                        <span className="mt-0.5 block text-[11px]" style={{ color: 'var(--m-slate-2)' }}>
                          full {s.fullDates} date{s.fullDates === 1 ? '' : 's'}
                        </span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <Link
              href="/vendor-dashboard/services"
              className="mt-3 inline-flex items-center gap-1 text-sm font-medium"
              style={{ color: 'var(--m-orange-2)' }}
            >
              My Services{' '}
              <ChevronRight className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            </Link>
          </article>
        </div>

        {/* QR codes — Shortlist ↔ Locked (relocated from My Shop 2026-07-02). */}
        <VendorQrSection
          vendorProfileId={vendorProfileId}
          slug={profile.business_slug ?? null}
          profileServices={(profile.services ?? []) as string[]}
          rawEt={search.et}
          rawCat={search.cat}
          month={month}
        />
          </>
        ) : null}

        {/*
          MONEY — this month's payments, as they were. The payday timeline and
          the bookings list render under this, from the hub. S-PR4 redraws this
          segment.

          🗑 The "Messages" tile that sat between these two is gone: the unread
          count and the door to the inbox are the envelope in the top bar now.
        */}
        {seg === 'money' ? (
          <div className="grid gap-4 md:grid-cols-3">
          {/* Ongoing payments */}
          <article className="sn-tile">
            <p className="sn-eye">
              <span
                aria-hidden
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
                style={{ background: 'rgba(79,107,74,0.12)', color: 'var(--m-sage-deep)' }}
              >
                <PhilippinePeso className="h-4 w-4" strokeWidth={1.75} />
              </span>
              Ongoing payments
            </p>
            {paydayIncomplete ? (
              <p role="status" className="mt-3 text-sm" style={{ color: 'var(--sn-warning-deep)' }}>
                Some payments couldn&rsquo;t load, so this month&rsquo;s totals and
                your customers&rsquo; payment notes aren&rsquo;t shown. Reload the
                page to try again.
              </p>
            ) : payments.isEmpty ? (
              <p className="mt-3 text-sm" style={{ color: 'var(--m-slate-2)' }}>
                No payments due this month. Amounts appear here once a couple
                books you on a service with a payment schedule.
              </p>
            ) : (
              <>
                <p className="mt-3 font-mono text-2xl font-bold tracking-tight" style={{ color: 'var(--m-ink)' }}>
                  {formatPhp(payments.collectedPhp)}{' '}
                  <span className="text-base font-normal" style={{ color: 'var(--m-slate-2)' }}>
                    / {formatPhp(payments.expectedPhp)}
                  </span>
                </p>
                <p className="mt-1 text-xs" style={{ color: 'var(--m-slate-2)' }}>
                  collected of expected this month
                </p>
                <div
                  className="mt-3 h-2 w-full overflow-hidden rounded-full"
                  style={{ background: 'var(--m-paper-2)' }}
                  role="progressbar"
                  aria-valuenow={collectPct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${collectPct}%`, background: 'var(--m-sage-deep)' }}
                  />
                </div>
                {/* The "N installments have no set amount yet" caveat lives once,
                    on the Payday timeline this card links down to — not repeated
                    here. */}
              </>
            )}
            <Link
              href="#payday"
              scroll
              className="mt-3 inline-flex items-center gap-1 text-sm font-medium"
              style={{ color: 'var(--m-orange-2)' }}
            >
              Money in timeline <ChevronRight className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            </Link>
          </article>
          </div>
        ) : null}
      </div>
    </section>
  );
}

/* ── My Customers hub (owner 5-page IA, 2026-07-12) ─────────────────────────
 * One menu item, every people-facing feature integrated as a tab: the
 * pipeline (this file's original body), Bookings, Clients, Calendar, Payday,
 * Messages. The old routes redirect in with their params preserved. */
import { Suspense } from 'react';
import { SlidersHorizontal, FileSignature, FileText } from 'lucide-react';
import {
  FeatureAccordion,
  AccordionSkeleton,
  type AccordionSection,
} from '../_components/feature-accordion';
import BookingsSurface from '../bookings/surface';
import CalendarSurface from '../calendar/surface';
import PaydaySurface from '../payday/surface';
import MessagesSurface from '../messages/surface';
import ContractsSurface from '../contracts/surface';
import ProposalsSurface from '../proposals/surface';
import { formatCount } from '@/lib/format-number';

// Folded sections below the pipeline (which already shows the ONE month
// calendar + summary cards + QR + customers list). No "Calendar" section —
// the grid lives in the pipeline; its EDIT tools live in "Availability &
// capacity" (owner dedup 2026-07-12: "calendar already on the page").
// Owner editorial pick 2026-07-12 — which sections stay ALWAYS-ON vs collapse.
// Rule: always-on = glanced almost every visit AND light to render; collapse =
// heavy / configure-once / already summarised elsewhere.
//   ALWAYS-ON (rendered eagerly below the pipeline): Bookings (new inquiries —
//   the daily heartbeat) + Payday (cash-flow timeline, 1 query, shown nowhere
//   else). COLLAPSE: Clients (the pipeline list already covers the roster),
//   Messages (unread count is on the pipeline's summary card), Availability
//   (config).
//
//   DEDUP 2026-07-16: Messages moved back to COLLAPSE. It had been promoted to
//   always-on, but BookingsSurface (also always-on) renders the SAME
//   fetchVendorThreads() set as a work queue — so two full thread lists showed
//   on one page. Messages now folds here (its unread count already lives on the
//   pipeline's Messages summary card, which links straight to this section).
//   ⚠ Reverses the owner 2026-07-12 "promote Messages to always-on" — see PR.
const CUSTOMER_SECTIONS: AccordionSection[] = [
  {
    key: 'messages',
    label: 'Messages',
    sub: 'Your conversations — reply, reveal, and log outcomes',
    icon: <MessageSquare className="h-4 w-4" strokeWidth={1.75} />,
  },
  /*
    🗑 `clients` ("Booked · in conversation · outside clients") IS GONE — S-PR2.
    Those three lists, and the kept notes under them, are the People list now:
    one list, not two. `?open=clients` (and the `/vendor-dashboard/clients`
    stub's `?tab=clients`) land on People (`SECTION_SEGMENT`).
  */
  {
    key: 'availability',
    label: 'Availability & capacity',
    sub: 'Set daily limits, block dates, import clients, manage the waitlist',
    icon: <SlidersHorizontal className="h-4 w-4" strokeWidth={1.75} />,
  },
  /*
    MOVED HERE FROM MY SHOP 2026-08-26 (owner re-cut, "yes i agree"). A quote
    and a contract are papers about a deal with one customer; they belong in
    the room where that customer is, not beside the shop's opening hours.
    ⚠ The keys `contracts` / `proposals` are the SAME words the old My Shop
    accordion used, and both hubs read `?open=` / the legacy `?tab=` alias — so
    the forwarding stubs need no new vocabulary and every old deep-link lands
    on the same section it always named.
  */
  {
    key: 'proposals',
    label: 'Quotes',
    sub: 'Build quotes and reusable quote templates',
    icon: <FileText className="h-4 w-4" strokeWidth={1.75} />,
  },
  {
    key: 'contracts',
    label: 'Contracts',
    sub: 'Send, sign, and track your booking contracts',
    icon: <FileSignature className="h-4 w-4" strokeWidth={1.75} />,
  },
];

async function CustomerSectionBody({
  open,
  sp,
}: {
  open: string;
  sp: Record<string, string | string[] | undefined>;
}) {
  const pass = Promise.resolve(sp);
  switch (open) {
    case 'messages':
      return <MessagesSurface searchParams={pass as never} />;
    case 'availability':
      // Management tools only — the month grid stays in the pipeline above.
      return <CalendarSurface searchParams={pass as never} variant="manage" />;
    case 'proposals':
      return <ProposalsSurface searchParams={pass as never} />;
    case 'contracts':
      return <ContractsSurface />;
    default:
      return null;
  }
}

export default async function VendorCustomersHub({
  searchParams,
}: {
  searchParams: Props['searchParams'];
}) {
  const sp = (await searchParams) as Record<string, string | string[] | undefined>;
  const seg = customersSegment(sp);
  const openRaw =
    (typeof sp.open === 'string' && sp.open) ||
    // Legacy alias: old /calendar deep-links redirect with ?tab=calendar →
    // land on Availability. Everything else maps 1:1.
    (typeof sp.tab === 'string' && (sp.tab === 'calendar' ? 'availability' : sp.tab)) ||
    null;
  /*
    EACH SEGMENT KEEPS THE FOLDS THAT ARE ITS OWN (`SECTION_SEGMENT`):
      · Dates  — Availability & capacity;
      · Money  — Quotes · Contracts (papers about a deal; the plan moves them
                 onto the customer's card in S-PR5);
      · People — Messages, and ONLY when a link asked for it (`?open=messages`,
                 which is where the envelope in the top bar lands). People is
                 the list and nothing under it; the inbox is one tap away on
                 every page, so it has no closed fold sitting below the roster.
  */
  const segSections = CUSTOMER_SECTIONS.filter(
    (s) => SECTION_SEGMENT[s.key] === seg && (seg !== 'people' || s.key === openRaw),
  );
  const open = openRaw && segSections.some((s) => s.key === openRaw) ? openRaw : null;

  return (
    <>
      {/* The segment's own blocks: People's list · Dates' calendar · Money's month. */}
      <CustomersPipeline searchParams={Promise.resolve(sp) as never} seg={seg} />

      {/* MONEY (until S-PR4 redraws it): the bookings list and the cash-flow
          timeline, as shipped. `#bookings` and `#payday` are where the old
          links land (`ANCHOR_SEGMENT`). */}
      {seg === 'money' ? (
        <>
          <div id="bookings" className="scroll-mt-24">
            <BookingsSurface searchParams={Promise.resolve(sp) as never} />
          </div>
          <div id="payday" className="scroll-mt-24">
            <PaydaySurface />
          </div>
        </>
      ) : null}

      {/* `#customer-tools` is where a fold's link lands. */}
      {segSections.length > 0 ? (
        <div id="customer-tools" className="scroll-mt-24">
          <FeatureAccordion sections={segSections} openKey={open}>
            {open ? (
              <Suspense fallback={<AccordionSkeleton />}>
                <CustomerSectionBody open={open} sp={sp} />
              </Suspense>
            ) : null}
          </FeatureAccordion>
        </div>
      ) : null}

      {/* First visit only — the shipped MiniTour (every feature gets one). */}
      <MiniTour tourKey="vendor_customers_v1" after="vendor_welcome_v1" />
    </>
  );
}
