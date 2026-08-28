import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CalendarDays, ChevronRight, MessageSquare, PhilippinePeso, Sparkles } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { logQueryError } from '@/lib/supabase/error-detect';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { formatPhp, VENDOR_CATEGORY_LABEL } from '@/lib/vendors';
import { countUnreadMessages, fetchVendorThreads } from '@/lib/chat';
import { pendingInquiryDates } from '@/lib/vendor-inquiry-dates';
import {
  fetchVendorBlocks,
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
import { manilaTodayIso, type PaydayInstallmentRow } from '@/lib/vendor-cashflow';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  buildCustomerCalendarMonth,
  summarizeMonthlyPayments,
  computeEventMoneyPositions,
  type EventMoneyPosition,
} from '@/lib/vendor-customers';
import {
  customerLaneOf,
  groupByLane,
  CUSTOMER_LANES,
  type CustomerLane,
  type PipelineCustomer,
} from '@/lib/vendor-customer-pipeline';
import { isLockHandshakeEnabled } from '@/lib/lock-handshake-flag';
import {
  fetchInquiryMaskMeta,
  inquiryPlaceholderLabel,
  isInquiryRevealed,
  INQUIRY_MASK_UNKNOWN,
} from '@/lib/inquiry-mask.server';
import { CustomersRoster, type RosterRow } from './_components/customers-roster';
import { CustomersCalendar } from './_components/customers-calendar';
import type { FilterOption } from './_components/customers-filter-bar';
import { VendorQrSection } from '../_components/qr-section';

export const metadata = { title: 'My Customers · Vendor' };

/**
 * /vendor-dashboard/customers — "My Customers".
 *
 * The pipeline home of the 6-menu vendor shell: the vendor's calendar, book of
 * business, and the money coming in — all wired to LIVE, vendor-scoped sources
 * (no hard-coded figures). Sections top→bottom:
 *   1. Filter row (types / services / agents + Heat map toggle + info).
 *   2. Month calendar — the 6-state day taxonomy from vendor_calendar_day_states
 *      + bookings + blocks + the couple waitlist queue.
 *   3. Three summary cards — Ongoing payments (this month), Messages, Service
 *      coverage.
 *   4. Customers list — one row per booked / in-conversation event with a status
 *      pill + a money note.
 *
 * Every number resolves from a real query/RPC. Where a value has no source yet
 * (e.g. the couple's venue when they haven't set one) the row degrades to a
 * clearly-empty state rather than inventing a value.
 */

type Props = {
  searchParams: Promise<{ m?: string; et?: string; cat?: string; lane?: string }>;
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

async function CustomersPipeline({ searchParams }: Props) {
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
    blocks,
    dayStates,
    waitlist,
    threads,
    unreadCount,
    services,
    teamRows,
    paydayRes,
    tierProbe,
  ] = await Promise.all([
    fetchVendorPools(supabase, vendorProfileId),
    // CAPACITY, not the room: fullDatesForPool() counts these against each pool's
    // seat count. A booking with no pool cannot consume a pool seat.
    fetchVendorPoolBookings(supabase, vendorProfileId),
    fetchVendorBlocks(supabase, vendorProfileId),
    fetchVendorDayStates(supabase, vendorProfileId, `${month}-01`, `${month}-31`),
    // Waitlist for the visible month (the lib bounds by a from-date; a past
    // month simply returns nothing pending, which is correct).
    fetchVendorWaitlist(supabase, vendorProfileId, `${month}-01`),
    fetchVendorThreads(supabase, vendorProfileId),
    countUnreadMessages(supabase, user.id),
    fetchVendorServices(supabase, vendorProfileId),
    fetchVendorTeam(supabase, vendorProfileId),
    // Frozen installment plan across all booked events (ownership-gated RPC).
    supabase.rpc('vendor_payday_installments'),
    // tier_state is excluded from the profile select → isolated probe (matches
    // the chat-send / proposal-send convention). Gates the Agent filter.
    supabase
      .from('vendor_profiles')
      .select('tier_state')
      .eq('vendor_profile_id', vendorProfileId)
      .maybeSingle(),
  ]);

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

  const paydayRows = (
    paydayRes.error ? [] : ((paydayRes.data ?? []) as unknown as PaydayInstallmentRow[])
  );

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

  // ── Section 3b: messages ─────────────────────────────────────────────────
  const conversationCount = threads.length;

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
  const { data: evRows, error: evRowsError } = await rosterAdmin
    .from('event_vendors')
    .select(
      'vendor_id, event_id, status, lock_request_state, lock_requested_at, lock_request_expires_at',
    )
    .eq('marketplace_vendor_id', vendorProfileId)
    .is('archived_at', null)
    // A covered cascade line carries no request of its own — only the anchor is
    // asked — and folding one in would put the same celebration on the roster
    // twice. Same filter the Answers Desk applies to the identical question.
    .or('package_role.is.null,package_role.eq.anchor');
  if (evRowsError) {
    logQueryError(
      'VendorCustomersPage.rosterBookings',
      evRowsError,
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
  if (rosterEventIds.length > 0) {
    const { data: eventRows, error: eventRowsError } = await rosterAdmin
      .from('events')
      .select('event_id, display_name, event_date, venue_name, event_type')
      .in('event_id', rosterEventIds);
    // ⚠ THE EVENT DATE, VENUE AND TYPE for every booked client. Refused, all
    // ⚠ three go null: the date column empties, the venue disappears, and the
    // ⚠ list SORTS DIFFERENTLY — rows without a date fall to the bottom, so the
    // ⚠ wedding happening next week stops being at the top of the supplier's
    // ⚠ own client list. An absence that quietly re-orders is worse than one
    // ⚠ that empties, because nothing on screen looks missing.
    if (eventRowsError) {
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
    THE MASK. Every row that is NOT entitled to the couple's identity renders
    the same neutral placeholder the Answers Desk uses — "A couple planning a
    wedding in Metro Manila" — built from event type + city only.

    🔑 THE SHIPPED HELPER, NOT A NEW ONE. `fetchInquiryMaskMeta` selects ONLY
    `event_type` + `region`; there is no input path through which a display name
    can reach the placeholder. A second mask written here would be a second
    chance to get anonymisation-until-accept wrong.
  */
  const maskMeta = await fetchInquiryMaskMeta(rosterAdmin, rosterEventIds);

  const derived: PipelineCustomer[] = [];
  for (const eventId of rosterEventIds) {
    const t = threadByEvent.get(eventId);
    const b = bookingByEvent.get(eventId);
    const mask = maskMeta.get(eventId) ?? INQUIRY_MASK_UNKNOWN;
    const row = customerLaneOf(
      {
        eventId,
        thread: t
          ? {
              threadId: t.thread_id,
              inquiryStatus: t.inquiry_status ?? null,
              createdAt: t.created_at ?? null,
              revealed: isInquiryRevealed(t),
            }
          : null,
        booking: b
          ? {
              eventVendorId: b.vendor_id,
              status: b.status,
              lock_request_state: b.lock_request_state,
              requestedAt: b.lock_requested_at,
              expiresAt: b.lock_request_expires_at,
            }
          : null,
        // The name is SUPPLIED for every event; whether it is USED is decided by
        // the pure derivation, never here.
        eventName:
          eventNameByEvent.get(eventId) ?? bookedByEvent.get(eventId)?.eventName ?? null,
        // ⚠ THE THREE FIELDS ARE SPELLED OUT, NOT SPREAD. `hostNoun` is a
        // REQUIRED parameter with no default precisely so a new call site
        // cannot silently keep saying "A couple planning a funeral", and
        // `inquiry-mask-every-host.test.ts` enforces that by reading the CALL —
        // passing an object it cannot see inside defeats the check even when
        // the value is correct.
        descriptor: inquiryPlaceholderLabel({
          eventType: mask.eventType,
          city: mask.city,
          hostNoun: mask.hostNoun,
        }),
        eventDate: eventDateByEvent.get(eventId) ?? null,
        place: venueByEvent.get(eventId) ?? null,
        // A live hold in this shop's own pool. The roster this replaced derived
        // "booked" from THIS ALONE; carrying it forward is what stops the
        // rewrite from silently dropping a customer whose `event_vendors` row is
        // archived or was never stamped with a marketplace id.
        poolBooked: bookedByEvent.has(eventId),
      },
      handshakeEnabled,
    );
    if (row) derived.push(row);
  }

  const lanes = groupByLane(derived);
  const laneCounts = {
    waiting: lanes.waiting.length,
    talking: lanes.talking.length,
    booked: lanes.booked.length,
    finished: lanes.finished.length,
  } as Record<CustomerLane, number>;
  const activeLane =
    (CUSTOMER_LANES as readonly string[]).includes(search.lane ?? '')
      ? (search.lane as CustomerLane)
      : null;
  // Waiting first, always — that is what "opens on who is waiting" means. The
  // chip narrows the same list; it never reorders it.
  const rosterRows: RosterRow[] = (
    activeLane ? lanes[activeLane] : CUSTOMER_LANES.flatMap((l) => lanes[l])
  ).map((r) => ({ ...r, note: moneyNote(r, moneyByEvent.get(r.eventId) ?? null) }));

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

  return (
    // Glass PR-7: the opaque `--m-paper` body wrapper is dropped — the Atelier
    // wash (`.sn-ambient`, inherited from the shell) shows through the glass tiles.
    <section className="min-h-full">
      <div className="mx-auto w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl space-y-6 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        {/*
          THE ROSTER IS THE PAGE'S FIRST BLOCK NOW.

          It used to sit at the bottom, under the month calendar, three summary
          tiles and the QR panel — so a shop opening "Customers" met a grid of
          dates before it met a person, and the one thing it could actually be
          late on was the last thing on the screen. The brief is one sentence:
          Customers opens on who is waiting.

          ⛔ Nothing was DELETED to make room. The calendar, the tiles and the
          QR panel all still render, in the same order, immediately below.
        */}
        {/*
          🔑 "Book of business" IS BACK, DELIBERATELY. It lived in the old
          Section-4 header, which this block replaced, and it opens a DIFFERENT
          view of the same people (the Clients accordion below, with outside
          clients the roster does not carry). Dropping it would have been a lost
          control — the thing `lint-port-no-lost-controls` exists to catch, and
          a redesign is exactly when it happens.
        */}
        <div className="-mb-1 flex justify-end">
          <Link
            href="?open=clients"
            scroll={false}
            className="inline-flex items-center gap-1 text-sm font-semibold"
            style={{ color: 'var(--sn-gold-700)' }}
          >
            <CalendarDays className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            Book of business
          </Link>
        </div>

        <CustomersRoster
          rows={rosterRows}
          activeLane={activeLane}
          counts={laneCounts}
          nowMs={Date.now()}
          keepParams={new URLSearchParams(
            Object.entries({ m: search.m, et: search.et, cat: search.cat }).filter(
              (e): e is [string, string] => typeof e[1] === 'string',
            ),
          ).toString()}
        />

        {/* Sections 1 + 2 — filter row + month calendar (centrepiece). */}
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

        {/* Section 3 — three summary cards (glass `.sn-tile` bento). */}
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
            {payments.isEmpty ? (
              <p className="mt-3 text-sm" style={{ color: 'var(--m-slate-2)' }}>
                No installments due this month. Amounts appear here once a couple
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
              Payday timeline <ChevronRight className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            </Link>
          </article>

          {/* Messages */}
          <article className="sn-tile">
            <p className="sn-eye">
              <span
                aria-hidden
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
                style={{ background: 'var(--sn-gold-100)', color: 'var(--sn-gold-800)' }}
              >
                <MessageSquare className="h-4 w-4" strokeWidth={1.75} />
              </span>
              Messages
            </p>
            <p className="mt-3 font-mono text-2xl font-bold tracking-tight" style={{ color: 'var(--m-ink)' }}>
              {unreadCount}{' '}
              <span className="text-base font-normal" style={{ color: 'var(--m-slate-2)' }}>
                new
              </span>
            </p>
            <p className="mt-1 text-xs" style={{ color: 'var(--m-slate-2)' }}>
              {conversationCount} conversation{conversationCount === 1 ? '' : 's'}
            </p>
            <Link
              href="?open=messages"
              scroll={false}
              className="mt-3 inline-flex items-center gap-1 text-sm font-medium"
              style={{ color: 'var(--m-orange-2)' }}
            >
              Open messages{' '}
              <ChevronRight className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            </Link>
          </article>

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

      </div>
    </section>
  );
}

/**
 * The right-aligned money note on a roster row.
 *
 * ⚠ IT SAYS NOTHING ON A MASKED ROW, and that is not tidiness. A balance is a
 * fact about a specific couple's booking; printing one beside "A couple planning
 * a wedding in Metro Manila" would narrow an anonymous row to a person by the
 * money attached to it. `waiting` therefore carries no figure at all.
 *
 * ⚠ AND "Downpayment in" IS NOT SAID WHEN NOTHING IS KNOWN. The old version
 * printed it for any booked row with no resolvable plan — including one where
 * the money read had simply come back empty — so a shop that had received
 * nothing was told a downpayment was in. A booking with no plan now says
 * "No plan yet", which is what is true.
 */
function moneyNote(
  r: PipelineCustomer,
  m: EventMoneyPosition | null,
): { text: string; tone: string } | null {
  if (r.lane === 'waiting') return null;
  if (r.lane === 'talking') return { text: 'Quote pending', tone: 'var(--m-slate-2)' };
  if (!m || m.allUnresolved || m.installmentCount === 0) {
    return { text: 'No plan yet', tone: 'var(--m-slate-2)' };
  }
  if (m.fullyPaid) return { text: 'Fully paid', tone: 'var(--m-sage-deep)' };
  if (m.balancePhp > 0) {
    return { text: `Balance ${formatPhp(m.balancePhp)}`, tone: 'var(--m-ink)' };
  }
  return { text: 'Settled', tone: 'var(--m-sage-deep)' };
}


/* ── My Customers hub (owner 5-page IA, 2026-07-12) ─────────────────────────
 * One menu item, every people-facing feature integrated as a tab: the
 * pipeline (this file's original body), Bookings, Clients, Calendar, Payday,
 * Messages. The old routes redirect in with their params preserved. */
import { Suspense } from 'react';
import { Users as UsersIcon, SlidersHorizontal, FileSignature, FileText } from 'lucide-react';
import {
  FeatureAccordion,
  AccordionSkeleton,
  type AccordionSection,
} from '../_components/feature-accordion';
import BookingsSurface from '../bookings/surface';
import ClientsSurface from '../clients/surface';
import CalendarSurface from '../calendar/surface';
import PaydaySurface from '../payday/surface';
import MessagesSurface from '../messages/surface';
import ContractsSurface from '../contracts/surface';
import ProposalsSurface from '../proposals/surface';
import { ShopEmpty } from '../_components/kit';

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
  {
    key: 'clients',
    label: 'Clients',
    sub: 'Booked · in conversation · outside clients',
    icon: <UsersIcon className="h-4 w-4" strokeWidth={1.75} />,
  },
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
    label: 'Proposals',
    sub: 'Build quotes and reusable proposal templates',
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
      return <MessagesSurface />;
    case 'clients':
      return <ClientsSurface searchParams={pass as never} />;
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

export default async function VendorCustomersHub({ searchParams }: Props) {
  const sp = (await searchParams) as Record<string, string | string[] | undefined>;
  const openRaw =
    (typeof sp.open === 'string' && sp.open) ||
    // Legacy alias: old /calendar deep-links redirect with ?tab=calendar →
    // land on Availability. Everything else maps 1:1.
    (typeof sp.tab === 'string' && (sp.tab === 'calendar' ? 'availability' : sp.tab)) ||
    null;
  const open =
    openRaw && CUSTOMER_SECTIONS.some((s) => s.key === openRaw) ? openRaw : null;

  return (
    <>
      {/* The pipeline is the home: month calendar + summary cards + QR + list. */}
      <CustomersPipeline searchParams={Promise.resolve(sp) as never} />

      {/* ALWAYS-ON (owner pick 2026-07-12): Bookings = the daily heartbeat
          (new inquiries), Payday = the cash-flow timeline (1 query, shown
          nowhere else). Rendered eagerly, not behind an accordion. */}
      <div id="bookings">
        <BookingsSurface searchParams={Promise.resolve(sp) as never} />
      </div>
      <div id="payday">
        <PaydaySurface />
      </div>

      {/* The rest folds in — glance-covered or configure-once. Messages folds
          here too (its thread set is already the always-on Bookings queue
          above; opening this section shows the chat/reply view). */}
      <FeatureAccordion sections={CUSTOMER_SECTIONS} openKey={open}>
        {open ? (
          <Suspense fallback={<AccordionSkeleton />}>
            <CustomerSectionBody open={open} sp={sp} />
          </Suspense>
        ) : null}
      </FeatureAccordion>
    </>
  );
}
