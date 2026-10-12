import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { FileSignature, FileText, MessageSquare, SlidersHorizontal } from 'lucide-react';
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
import { computeEventMoneyPositions, type EventMoneyPosition } from '@/lib/vendor-customers';
import {
  customerLaneOf,
  groupByLane,
  holdingByDate,
  CUSTOMER_LANES,
  type CustomerLane,
  type PipelineCustomer,
} from '@/lib/vendor-customer-pipeline';
import { rowReadsCompleted } from '@/lib/vendor-thread-stage';
import { eventTypeLabel } from '@/lib/demand-radar';
import { filterBySearch, paginate, parseSearchParam } from '@/lib/paginate';
import { isLockHandshakeEnabled } from '@/lib/lock-handshake-flag';
import { formatCount } from '@/lib/format-number';
import { CustomersRoster, type RosterRow } from './_components/customers-roster';
import { CustomersPick } from './_components/customers-pick';
import { KeptNotesFold, OutsideClientRows, type OutsideClient } from './_components/people-more';
import { OutsideClientAdd } from './_components/outside-client-add';
import { MiniTour } from '@/app/_components/mini-tour';
import { SearchBox } from '@/app/_components/search-box';
import { rosterView } from './roster-view';
import { CustomersCalendar } from './_components/customers-calendar';
import type { FilterOption } from './_components/customers-filter-bar';
import { customersSegmentOf, foldsOf } from './segments';
import { CustomersSegments } from './_components/customers-segments';
import { VendorQrSection } from '../_components/qr-section';
import { keepParamsFrom } from '../_components/list-pager';
import { SupplierThumbRow } from '../_components/supplier-thumb-row';
import { SupplierToast, type SupplierOutcomeTone } from '../_components/supplier-toast';
import { importExternalClient, removeBlock } from '../calendar/actions';
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

export const metadata = { title: 'Customers' };

/**
 * /vendor-dashboard/customers — Customers = People · Dates · Money (S-PR2,
 * corpus `SUPPLIER_DASHBOARD_REDESIGN_2026-10-08_fable.md` § 3; owner-approved
 * 2026-10-08, layout "B").
 *
 * ONE segmented control (the Guests/Suppliers shape, the shared pill track),
 * three views of the same bookings, each with its own address (`?seg=`):
 *
 *   People — who the shop's customers are, waiting first: the roster, the
 *            outside clients and the kept notes (the retired Clients page),
 *            search + Add in the thumb row. The page's FIRST view.
 *   Dates  — the month (`#calendar`), its availability tools and the QR codes.
 *            Redrawn by S-PR3; moved here unchanged.
 *   Money  — Bookings (`#bookings`) and Payday (`#payday`), with Quotes and
 *            Contracts. Redrawn by S-PR4; moved here unchanged.
 *
 * 🔑 EACH SEGMENT READS ONLY WHAT IT DRAWS (owner 2026-10-08: "the fewest
 * requests"). People no longer pays for the month grid's day states, waitlist,
 * pools, services and team; Dates no longer pays for the roster.
 *
 * Every number resolves from a real query/RPC. Where a value has no source
 * (the couple's venue when they have not set one) the row says less, never
 * something invented.
 */

type Props = {
  searchParams: Promise<{
    seg?: string;
    m?: string;
    et?: string;
    cat?: string;
    lane?: string;
    /** The roster's page (1-based). Paged after the lane order, never before. */
    page?: string;
    /** The outside clients' page. */
    copage?: string;
    /** Name search over the roster and the outside clients, applied before paging. */
    q?: string;
    /** An outcome of an outside client's Add / Remove (`calendar/actions.ts`). */
    notice?: string;
    /** `?add=outside` — an older link that named the Add form opens it. */
    add?: string;
    open?: string;
    tab?: string;
  }>;
};

type SP = Record<string, string | string[] | undefined>;

/** Filter ▾'s words — the stage, as the row's badge says it. */
const LANE_FILTER_LABEL: Record<CustomerLane, string> = {
  waiting: 'Waiting on you',
  holding: 'Holding',
  talking: 'Talking',
  booked: 'Booked',
  finished: 'Done',
};

/*
  🗑 `STATUS_PILL` LIVED HERE AND IS DELETED. It mapped five statuses —
  booked · locked · whitelist · waitlist · in_conversation — to pill colours,
  and the assembly loop could only ever produce TWO of them.

  ⛔ AND NO `waitlist` LANE REPLACES IT. Picking somebody off the waitlist does
  nothing today and still reports success — a chip whose only action is a lie
  is a fake door. The waitlist queue surfaces on the month (Dates), where it
  says something true.
*/

/** An outside client's Add / Remove, said once by the toast and kept as the status line. */
const PEOPLE_NOTICES: Record<string, { tone: SupplierOutcomeTone; text: string; retry?: boolean }> = {
  client_imported: { tone: 'ok', text: 'Outside client added — free. They now hold that date on your schedule.' },
  block_removed: { tone: 'ok', text: 'Outside client removed. The date is open again.' },
  bad_dates: { tone: 'bad', text: 'Those dates don’t work. Check the first and last day.', retry: true },
  bad_name: { tone: 'bad', text: 'The client needs a name. Nothing was added.', retry: true },
  bad_pool: { tone: 'bad', text: 'Pick which schedule this client belongs to. Nothing was added.', retry: true },
  save_failed: { tone: 'bad', text: 'That did not go through. Nothing changed — please try again.', retry: true },
};

function categoryLabel(key: string): string {
  return (VENDOR_CATEGORY_LABEL as Record<string, string>)[key] ?? key.replace(/_/g, ' ');
}

/* ═══ PEOPLE ═══════════════════════════════════════════════════════════════ */

async function CustomersPipeline({ search }: { search: Awaited<Props['searchParams']> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');

  const vendorProfileId = profile.vendor_profile_id;
  const todayIso = manilaTodayIso();

  // The roster's reads, in parallel. Each helper is the SAME one the
  // dedicated pages use — one source of truth per surface.
  const [pools, bookings, blocksRead, threadsRead, paydayRes] = await Promise.all([
    // The schedules an outside client can hold a date on (the Add sheet).
    fetchVendorPools(supabase, vendorProfileId),
    // LEFT ON THE POOL READ — CAPACITY, not the room: `poolBooked` below is the
    // floor that keeps a held date on the roster whatever else is missing.
    fetchVendorPoolBookings(supabase, vendorProfileId),
    // The outside clients are the shop's `external_client` blocks. Paged to the
    // server's count; `complete` says so under their list when it falls short.
    fetchVendorBlocksDetailed(supabase, vendorProfileId),
    // Detailed: the roster says so on screen when the read could not prove it
    // reached every thread (`fetchVendorThreadsDetailed`).
    fetchVendorThreadsDetailed(supabase, vendorProfileId),
    // Frozen installment plan across all booked events (ownership-gated RPC),
    // paged to the server's exact count — see `lib/vendor-payday-read.ts`.
    readVendorPaydayInstallments(supabase),
  ]);

  const threads = threadsRead.threads;

  // ⚠ MONEY. A payday read that did not reach the server's count is NOT added
  // up: the status line says some payments couldn't load and every booked
  // row's money line says "couldn't load" — never "No plan yet", which would be
  // a claim about a plan nobody read.
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

  // ── The customers roster ─────────────────────────────────────────────────
  //
  // 🔑 THE LANES ARE DERIVED IN ONE PURE MODULE, not here. This block's job is
  // to gather the three inputs — the shop's bookings, its threads, and the
  // facts a row needs — and hand them over.
  const moneyByEvent = computeEventMoneyPositions(paydayRows);
  const handshakeEnabled = isLockHandshakeEnabled();
  // ONE "now" for the whole derivation and the render, so a customer cannot sit
  // one side of the quiet boundary in the lane count and the other on the row.
  const rosterNowMs = Date.now();

  /*
    THE SHOP'S OWN `event_vendors` ROWS — read with the ADMIN CLIENT, SCOPED BY
    THE CALLER'S OWN PROFILE ID.

    🔴 NOT AN OPTIMISATION. `event_vendors` carries four policies — couple read,
    couple write, moderator read, moderator write — and NOT ONE admits a vendor
    (measured against production 2026-08-28). A vendor SELECT policy is
    deliberately not opened: it would hand suppliers the couple's whole booking
    row, budget figures included. The id it filters on came from this caller's
    own session above.

    ⚠ AN UNREADABLE BOOKING SET IS NOT AN EMPTY ONE — the error is logged and
    said under the list, never swallowed by `?? []`.

    🏁 `completion_status` + `customer_confirmed_received_at` ride along (S-PR2):
    the retired Clients page asked "is it finished?" with the shared
    `rowReadsCompleted`; the roster now asks it too, through the derivation.
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
        // asked — and folding one in would put the same event on the roster
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
  // returns them newest-first. A second thread on the same event is one
  // customer, not two rows.
  const threadByEvent = new Map<string, (typeof threads)[number]>();
  for (const t of threads) if (!threadByEvent.has(t.event_id)) threadByEvent.set(t.event_id, t);

  // Live pool reservations grouped by event — the floor (`poolBooked`).
  const bookedByEvent = new Map<string, { eventName: string }>();
  for (const b of bookings) {
    if (!bookedByEvent.has(b.eventId)) bookedByEvent.set(b.eventId, { eventName: b.eventName });
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
    // ⚠ THE EVENT DATE, VENUE AND TYPE for every customer. Refused, all three
    // ⚠ go null and the list SORTS DIFFERENTLY — rows without a date fall to
    // ⚠ the bottom. An absence that quietly re-orders is worse than one that
    // ⚠ empties, so it is said under the list (`rosterIncomplete`).
    if (eventRowsError) {
      eventRowsErrorSeen = true;
      logQueryError('VendorCustomersPage.eventRows', eventRowsError, {}, 'graceful_degrade');
    }
    for (const e of (eventRows ?? []) as {
      event_id: string;
      display_name: string | null;
      event_date: string | null;
      venue_name: string | null;
      event_type: string | null;
    }[]) {
      venueByEvent.set(e.event_id, e.venue_name);
      eventTypeByEvent.set(e.event_id, e.event_type);
      eventNameByEvent.set(e.event_id, e.display_name);
      eventDateByEvent.set(e.event_id, e.event_date);
    }
  }

  /*
    NO MASK (owner ruling 2026-09-08 — "we do not need to hide anything, since
    no more tokens"). The roster always held the couple's real display name;
    the derivation names every row that has one.
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
              // The couple confirmed it was received (or it auto-confirmed) —
              // the shared "is it finished?", never a local copy of it.
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
        // A live hold in this shop's own pool. Carrying it forward is what stops
        // a customer whose `event_vendors` row is archived, or was never stamped
        // with a marketplace id, from silently leaving the roster.
        poolBooked: bookedByEvent.has(eventId),
      },
      handshakeEnabled,
      rosterNowMs,
    );
    if (row) derived.push(row);
  }

  const lanes = groupByLane(derived);
  /*
    Computed over EVERY derived customer, never over the page on screen —
    filtering to a lane must not make a date clash disappear. That is the
    difference between a warning and a decoration.
  */
  const holdingPerDate = holdingByDate(derived);

  /*
    COUNT, NARROW, SEARCH, PAGE — in that order, in one pure step
    (`./roster-view.ts`, executed by `the-roster-pages.test.ts`). The Filter ▾
    options count EVERYONE; only one page of 20 reaches the render.
  */
  const outsideOnly = search.lane === 'outside';
  const roster = rosterView(lanes, {
    lane: search.lane,
    q: search.q,
    page: search.page,
    decorate: (r): RosterRow => {
      const t = threadByEvent.get(r.eventId);
      const type = eventTypeByEvent.get(r.eventId);
      return {
        ...r,
        note: moneyNote(r, moneyByEvent.get(r.eventId) ?? null, paydayIncomplete),
        kind: type && type !== 'unspecified' ? eventTypeLabel(type) : null,
        quoted: false,
        returning: Boolean(t?.is_returning),
      };
    },
  });
  const laneCounts = roster.laneCounts;
  const activeLane = roster.activeLane;
  const rosterPage = roster.paged;

  /*
    QUOTED — which of the rows ON THIS PAGE already have a quote out with the
    couple (sent / viewed, not a draft). ONE batched read over the page's
    talking rows, never one per row. The retired Clients page drew this; the
    roster says it now ("Quoted · quote pending").
    ⚠ Refused, the set stays empty and every such row says "no quote yet" —
    so the refusal is logged, and the rows' quote word is withheld instead of
    claiming one way or the other.
  */
  const talkingIds = rosterPage.items.filter((r) => r.lane === 'talking').map((r) => r.eventId);
  let quotedRead: 'ok' | 'failed' = 'ok';
  if (talkingIds.length > 0) {
    const { data: quoted, error: quotedError } = await supabase
      .from('vendor_proposals')
      .select('event_id')
      .eq('vendor_profile_id', vendorProfileId)
      .in('event_id', talkingIds)
      .in('status', ['sent', 'viewed']);
    if (quotedError) {
      quotedRead = 'failed';
      logQueryError('VendorCustomersPage.quoted', quotedError, { vendorProfileId }, 'graceful_degrade');
    }
    const quotedIds = new Set(((quoted ?? []) as { event_id: string }[]).map((q) => q.event_id));
    // The page's own decorated rows (made by `decorate` above, one per row on
    // screen) — filled in place, so the render is still handed the slice.
    for (const r of rosterPage.items) {
      if (quotedIds.has(r.eventId)) r.quoted = true;
      else if (quotedRead === 'failed' && r.lane === 'talking') r.note = { text: 'couldn’t load', tone: 'quiet' };
    }
  }

  // A read that could not prove it reached every row — said on screen, never
  // shown as a shorter list.
  const rosterIncomplete =
    !threadsRead.complete || !evRead.complete || Boolean(evRead.error) || eventRowsErrorSeen;

  /*
    OUTSIDE CLIENTS — the shop's `external_client` blocks: dates sold outside
    Setnayan, held on one of its schedules. Searched by name with the roster's
    own word, paged on their own (`copage`).
  */
  const poolLabel = new Map(pools.map((p) => [p.poolId, p.label]));
  const outsideAll: OutsideClient[] = blocksRead.blocks
    .filter((b) => b.source === 'external_client')
    .map((b) => ({
      blockId: b.blockId,
      name: b.clientName?.trim() || b.label || 'Outside client',
      startDate: b.startDate,
      endDate: b.endDate,
      schedule: b.poolId ? (poolLabel.get(b.poolId) ?? 'Schedule') : 'Schedule',
      contact: b.clientContact ?? null,
      note: b.clientNote ?? null,
    }));
  const outsideMatched = filterBySearch(outsideAll, parseSearchParam(search.q), (c) => c.name);
  const showOutside = outsideOnly || !activeLane;
  const outsidePage = paginate(showOutside ? outsideMatched : [], search.copage);

  /*
    KEPT NOTES — the supplier's own CRM notes whose event was deleted.

    Owner 2026-08-24: "the supplier keeps the note, but it stops being filed
    under that person's name. They keep their working history."

    ⚠ WITHOUT THIS READ THE KEEPING IS A FICTION. The only other reader is
    `/vendor-dashboard/clients/[eventId]`, which filters `.eq('event_id', …)` —
    so a severed note would be preserved and permanently invisible.

    🔑 A FAILED READ IS NOT AN EMPTY ONE. The error is checked and the fold is
    HIDDEN on failure rather than saying "nothing kept".
  */
  const { data: keptNoteRows, error: keptNotesError } = await supabase
    .from('vendor_client_notes')
    .select('note_id, body, created_at')
    .eq('vendor_profile_id', profile.vendor_profile_id)
    .is('event_id', null)
    .order('created_at', { ascending: false })
    .limit(50);
  if (keptNotesError) {
    logQueryError('VendorCustomersPage.keptNotes', keptNotesError, { vendorProfileId }, 'graceful_degrade');
  }
  const keptNotesMeasured = !keptNotesError;
  const keptNotes = (keptNoteRows ?? []) as Array<{ note_id: string; body: string; created_at: string }>;

  /*
    Filter ▾ — each option is a LINK the server builds (a filter you can share,
    Back works). Picking resets both pages and keeps the search.
  */
  const sp = search as Record<string, string | undefined>;
  const pickHref = (value: string | null): string => {
    const q = new URLSearchParams(keepParamsFrom(sp, ['page', 'copage', 'lane', 'notice', 'add']));
    if (value) q.set('lane', value);
    const qs = q.toString();
    return qs ? `?${qs}#customers` : '?#customers';
  };
  const everyone = CUSTOMER_LANES.reduce((n, l) => n + laneCounts[l], 0) + outsideAll.length;
  const notice = search.notice ? PEOPLE_NOTICES[search.notice] : undefined;

  return (
    <>
      <CustomersSegments seg="people" waiting={laneCounts.waiting} />
      {notice ? <SupplierToast text={notice.text} tone={notice.tone} retry={notice.retry} retryHref="/vendor-dashboard/customers?add=outside" /> : null}

      {paydayIncomplete ? (
        <p role="status" className="mb-2 text-[13px] text-ink/70">
          Some payments couldn&rsquo;t load, so your customers&rsquo; money lines say so instead of a figure. Reload the
          page to try again.
        </p>
      ) : null}

      <CustomersRoster
        rows={rosterPage.items}
        paged={rosterPage}
        query={search.q ?? ''}
        incomplete={rosterIncomplete}
        pagerKeepParams={keepParamsFrom(sp, ['page', 'notice', 'add'])}
        counts={laneCounts}
        nowMs={rosterNowMs}
        holdingPerDate={holdingPerDate}
        hidden={outsideOnly}
        otherMatches={outsidePage.total}
        filter={
          <CustomersPick
            label="Filter"
            value={outsideOnly ? 'outside' : (activeLane ?? 'all')}
            dataAttr="data-customers-filter"
            compact
            options={[
              { key: 'all', label: `Everyone · ${formatCount(everyone)}`, href: pickHref(null) },
              ...CUSTOMER_LANES.map((l) => ({
                key: l,
                label: `${LANE_FILTER_LABEL[l]} · ${formatCount(laneCounts[l])}`,
                href: pickHref(l),
              })),
              { key: 'outside', label: `Outside · ${formatCount(outsideAll.length)}`, href: pickHref('outside') },
            ]}
          />
        }
      />

      {showOutside ? (
        <OutsideClientRows
          paged={outsidePage}
          incomplete={!blocksRead.complete}
          keepParams={keepParamsFrom(sp, ['copage', 'notice', 'add'])}
          removeBlock={removeBlock}
          headed={!outsideOnly && rosterPage.items.length > 0}
        />
      ) : null}

      {/* KEPT NOTES — drawn ONLY from a read that happened AND found some: an
          empty fold would be noise, and after a refused read a false "none". */}
      {keptNotesMeasured && keptNotes.length > 0 ? (
        <KeptNotesFold notes={keptNotes.map((n) => ({ noteId: n.note_id, body: n.body, createdAt: n.created_at }))} />
      ) : null}

      {/* 📱 THE THUMB ROW (frame 03): search a customer (kind 30, ≥ 60 %) + Add (brand). */}
      <SupplierThumbRow name="people" label="Customer tools">
        <SearchBox
          placeholder="Search a customer"
          defaultValue={search.q ?? ''}
          keep={keepParamsFrom(sp, ['q', 'page', 'copage', 'notice', 'add'])}
          hash="#customers"
          data="customers"
        />
        <OutsideClientAdd
          pools={pools.map((p) => ({ poolId: p.poolId, label: p.label }))}
          action={importExternalClient}
          startOpen={search.add === 'outside'}
          today={todayIso}
          setupHref="/vendor-dashboard/customers?seg=dates&open=availability#customer-tools"
        />
      </SupplierThumbRow>
    </>
  );
}

/**
 * The money line on a booked or finished row.
 *
 * ⚠ IT SAYS NOTHING ON A WAITING ROW, and that is not tidiness: a balance is a
 * fact about a specific couple's booking, and a waiting row's line is the
 * question it owes.
 *
 * ⚠ "Downpayment in" IS NOT SAID WHEN NOTHING IS KNOWN. A booking with no plan
 * says "No plan yet" — and only when the payday read happened: an unread
 * payday says "couldn't load", never a plan it did not read.
 */
function moneyNote(
  r: PipelineCustomer,
  m: EventMoneyPosition | null,
  unread: boolean,
): RosterRow['note'] {
  if (r.lane === 'waiting') return null;
  if (r.lane === 'talking' || r.lane === 'holding') return null;
  if (unread) return { text: 'couldn’t load', tone: 'quiet' };
  if (!m || m.allUnresolved || m.installmentCount === 0) {
    return { text: 'No plan yet', tone: 'quiet' };
  }
  if (m.fullyPaid) return { text: 'paid in full', tone: 'ok' };
  if (m.balancePhp > 0) return { text: `Balance ${formatPhp(m.balancePhp)}`, tone: 'quiet' };
  return { text: 'Settled', tone: 'ok' };
}

/* ═══ DATES (S-PR3 redraws; moved here unchanged) ══════════════════════════ */

async function CustomersDates({ search }: { search: Awaited<Props['searchParams']> }) {
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

  const [pools, bookings, blocksRead, dayStates, waitlist, threadsRead, services, teamRows, tierProbe] =
    await Promise.all([
      fetchVendorPools(supabase, vendorProfileId),
      // CAPACITY, not the room: the month counts these against each pool's seats.
      // A booking with no pool cannot consume a pool seat.
      fetchVendorPoolBookings(supabase, vendorProfileId),
      // Paged to the server's count; `complete` drives a note over the calendar.
      fetchVendorBlocksDetailed(supabase, vendorProfileId),
      fetchVendorDayStates(supabase, vendorProfileId, `${month}-01`, `${month}-31`),
      // Waitlist for the visible month (a past month returns nothing pending).
      fetchVendorWaitlist(supabase, vendorProfileId, `${month}-01`),
      // The dates couples are ASKING about — a COUNT only (`pendingInquiryDates`).
      fetchVendorThreadsDetailed(supabase, vendorProfileId),
      fetchVendorServices(supabase, vendorProfileId),
      fetchVendorTeam(supabase, vendorProfileId),
      // tier_state is excluded from the profile select → isolated probe. Gates the Agent filter.
      supabase.from('vendor_profiles').select('tier_state').eq('vendor_profile_id', vendorProfileId).maybeSingle(),
    ]);

  const blocks = blocksRead.blocks;
  const blocksIncomplete = !blocksRead.complete;

  // Agent filtering is a subscription feature — enabled only when the tier
  // grants agent accounts (Pro+, agentAccounts > 0).
  const tier = (tierProbe.data as { tier_state?: string } | null)?.tier_state ?? null;
  const agentsEnabled = tierCaps(tier).agentAccounts > 0;
  const agentCategories: Record<string, string[]> = {};
  if (agentsEnabled && teamRows.length > 0) {
    try {
      const assignments = await fetchAgentServiceAssignments(supabase, vendorProfileId);
      const categoryByServiceId = new Map(services.map((s) => [s.vendor_service_id, s.category]));
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

  // The dates couples are ASKING about — derived from threads already read; a
  // COUNT only: a pending enquiry is pre-accept, so no identity reaches the month.
  const inquiryDates = pendingInquiryDates(threadsRead.threads);

  // The event type of each booked event, for the calendar's Type filter (admin
  // read: the vendor holds no `events` RLS).
  const eventTypeByEvent = new Map<string, string | null>();
  const bookedIds = [...new Set(bookings.map((b) => b.eventId))];
  if (bookedIds.length > 0) {
    const { rows: typeRows, error: typeError } = await readInChunks(bookedIds, (part) =>
      createAdminClient().from('events').select('event_id, event_type').in('event_id', part),
    );
    if (typeError) logQueryError('VendorCustomersPage.calendarTypes', typeError, {}, 'graceful_degrade');
    for (const e of (typeRows ?? []) as { event_id: string; event_type: string | null }[]) {
      eventTypeByEvent.set(e.event_id, e.event_type);
    }
  }

  const serviceOptions: FilterOption[] = [
    ...new Map(services.map((s) => [s.category, { value: s.category, label: categoryLabel(s.category) } as FilterOption])).values(),
  ];
  const eventTypeOptions: FilterOption[] = (profile.event_types ?? []).map((t) => ({
    value: t,
    label: t.charAt(0).toUpperCase() + t.slice(1),
  }));
  // Agent labels need users.email/display_name (owner-only RLS) — the admin
  // client. Fail-soft to the team labels so the filter never blocks the page.
  let agentOptions: FilterOption[] = [];
  if (teamRows.length > 0) {
    try {
      const teamWithUser = await enrichTeamWithUsers(createAdminClient(), teamRows);
      agentOptions = teamWithUser.map((m) => ({
        value: m.vendor_team_member_id,
        label: m.display_name?.trim() || m.email || m.team_label?.trim() || 'Team member',
      }));
    } catch {
      agentOptions = teamRows.map((m) => ({ value: m.vendor_team_member_id, label: m.team_label?.trim() || 'Team member' }));
    }
  }

  return (
    <>
      {/* `id="calendar"` is where every bare /vendor-dashboard/calendar link lands (`customers/anchors.ts`). */}
      <div id="calendar" className="scroll-mt-24">
        {blocksIncomplete ? (
          <p role="status" className="mb-3 text-[13px]" style={{ color: 'rgb(var(--color-warn))' }}>
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
          // client-contact fields never cross the wire.
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
          dayHrefBase="/vendor-dashboard/calendar"
          types={eventTypeOptions}
          services={serviceOptions}
          agents={agentOptions}
          agentsEnabled={agentsEnabled}
          agentCategories={agentCategories}
        />
      </div>

      {/* QR codes — Shortlist ↔ Locked (relocated from My Shop 2026-07-02). */}
      <VendorQrSection
        vendorProfileId={vendorProfileId}
        slug={profile.business_slug ?? null}
        profileServices={(profile.services ?? []) as string[]}
        rawEt={search.et}
        rawCat={search.cat}
        month={month}
        seg="dates"
      />
    </>
  );
}

/* ═══ THE FOLDS — one accordion, each fold under its own segment ══════════ */

// Messages folds under People (the envelope lands on it); Availability under
// Dates (its EDIT tools — the grid itself is above); Quotes and Contracts under
// Money (papers about a deal; S-PR5 moves them onto the customer card).
const CUSTOMER_SECTIONS: AccordionSection[] = [
  {
    key: 'messages',
    label: 'Messages',
    sub: 'Your conversations — reply, reveal, and log outcomes',
    icon: <MessageSquare className="h-4 w-4" strokeWidth={1.75} />,
  },
  {
    key: 'availability',
    label: 'Availability & capacity',
    sub: 'Set daily limits, block dates, import clients, manage the waitlist',
    icon: <SlidersHorizontal className="h-4 w-4" strokeWidth={1.75} />,
  },
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

async function CustomerSectionBody({ open, sp }: { open: string; sp: SP }) {
  const pass = Promise.resolve(sp);
  switch (open) {
    case 'messages':
      return <MessagesSurface searchParams={pass as never} />;
    case 'availability':
      // Management tools only — the month grid is above, on Dates.
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
  const search = await searchParams;
  const sp = search as SP;
  const seg = customersSegmentOf(sp);
  const openRaw =
    (typeof sp.open === 'string' && sp.open) ||
    // Legacy alias: old /calendar deep-links redirect with ?tab=calendar →
    // land on Availability. Everything else maps 1:1.
    (typeof sp.tab === 'string' && (sp.tab === 'calendar' ? 'availability' : sp.tab)) ||
    null;
  const folds = foldsOf(seg);
  const sections = CUSTOMER_SECTIONS.filter((s) => folds.includes(s.key));
  const open = openRaw && sections.some((s) => s.key === openRaw) ? openRaw : null;

  return (
    <>
      <section className="min-h-full">
        <div className="mx-auto w-full max-w-3xl space-y-4 px-4 pb-6 pt-4 sm:px-6 lg:max-w-4xl lg:px-8" data-customers-seg-open={seg}>
          <h1 className="sr-only">Customers</h1>
          {seg === 'people' ? null : <CustomersSegments seg={seg} />}
          {seg === 'people' ? (
            <div className="pb-24">
              <CustomersPipeline search={search} />
            </div>
          ) : seg === 'dates' ? (
            <CustomersDates search={search} />
          ) : null}
        </div>
      </section>

      {seg === 'money' ? (
        <>
          {/* Bookings = the work queue of conversations; Payday = the cash-flow
              timeline. S-PR4 redraws both as Money's rows. */}
          <div id="bookings" className="scroll-mt-24">
            <BookingsSurface searchParams={Promise.resolve(sp) as never} />
          </div>
          <div id="payday" className="scroll-mt-24">
            <PaydaySurface />
          </div>
        </>
      ) : null}

      {/* `#customer-tools` is where every fold's door lands (`customers/anchors.ts`). */}
      <div id="customer-tools" className="scroll-mt-24">
        {sections.length > 0 ? (
          <FeatureAccordion sections={sections} openKey={open}>
            {open ? (
              <Suspense fallback={<AccordionSkeleton />}>
                <CustomerSectionBody open={open} sp={sp} />
              </Suspense>
            ) : null}
          </FeatureAccordion>
        ) : null}
      </div>

      {/* First visit only — the shipped MiniTour (every feature gets one). */}
      <MiniTour tourKey="vendor_customers_v1" after="vendor_welcome_v1" />
    </>
  );
}
