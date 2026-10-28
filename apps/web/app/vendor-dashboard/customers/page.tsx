import { redirect } from 'next/navigation';
import { Suspense, type ReactNode } from 'react';
import { ClipboardList, FileSignature, FileText } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { logQueryError } from '@/lib/supabase/error-detect';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { formatPhp } from '@/lib/orders';
import { fetchVendorThreadsDetailed } from '@/lib/chat';
import { readAllPages, readInChunks } from '@/lib/read-all-pages';
import {
  fetchVendorBlocksDetailed,
  fetchVendorDayStates,
  fetchVendorPoolBookings,
  fetchVendorPools,
} from '@/lib/vendor-schedule';
import {
  asksByDate,
  clockWords,
  dayAnswerOfGroups,
  dayGroupsOf,
  daySheetHref,
  daysFrom,
  nearWord,
  openAsksOf,
  rangeWords,
  seatsByPool,
  type DatesAsk,
} from '@/lib/vendor-dates';
import { blockClosesDay, repeatWords } from '@/lib/not-available';
import { hallGuests, hallsAnswer, hallsOnDay, joinedCardOnDay } from '@/lib/vendor-halls';
import { fetchEffectiveCaps } from '@/lib/vendor-effective-caps';
import { vendorAllowance } from '@/lib/vendor-feature-gate';
import { DAILY_CAPACITY_MAX, entryTierAllowance, tierCaps } from '@/lib/vendor-tier-caps';
import { fetchVendorWaitlist } from '@/lib/vendor-waitlist';
import { fetchVendorServices } from '@/lib/vendor-services';
import {
  fetchVendorTeam,
  enrichTeamWithUsers,
  fetchAgentServiceAssignments,
} from '@/lib/vendor-team';
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
import {
  KeptNotesFold,
  OtherChatsFold,
  OutsideClientRows,
  type OtherChat,
  type OutsideClient,
  type OutsideCode,
} from './_components/people-more';
import { CustomersPin, type CustomersDoor } from './_components/customers-pin';
import { CUSTOMERS_DOORS, type CustomersDoorKey } from './segments';
import { CustomersSettings } from './_components/customers-settings';
import { CustomersSettingsBody } from './_components/customers-settings-body';
import { InquiryOutcomesRollup } from '../messages/_components/inquiry-outcomes-rollup';
import { fetchVendorOutcomeRollup } from '@/lib/inquiry-outcomes';
import { eventChatTitle } from '@/lib/event-chat-title';
import { ChatOriginMark } from '@/app/_components/chat/chat-back';
import { OutsideClientAdd } from './_components/outside-client-add';
import { MiniTour } from '@/app/_components/mini-tour';
import { SearchBox } from '@/app/_components/search-box';
import { ThumbRow } from '@/components/thumb-row';
import { rosterView } from './roster-view';
import { CustomersCalendar } from './_components/customers-calendar';
import { DatesFolds } from './_components/dates-folds';
import { BlockDateAdd } from './_components/dates-sheets';
import { CheckADate } from './_components/check-a-date';
import { DaySheet, type DaySheetData } from './_components/day-sheet';
import { CUSTOMER_SEGMENT_HREFS, customersSegmentOf, foldsOf } from './segments';
import { keepParamsFrom } from '../_components/list-pager';
import { SupplierThumbRow } from '../_components/supplier-thumb-row';
import { SupplierToast, type SupplierOutcomeTone } from '../_components/supplier-toast';
import {
  addManualBlock,
  importExternalClient,
  notifyWaitlistSlot,
  pickWaitlistCouple,
  removeBlock,
  setCalendarDayState,
  updateWaitlistSettings,
} from '../calendar/actions';
import {
  FeatureAccordion,
  AccordionSkeleton,
  type AccordionSection,
} from '../_components/feature-accordion';
import BookingsSurface from '../bookings/surface';
import { CustomersMoney } from './_components/money-segment';
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
    /** Dates › one day (frame 35). */
    day?: string;
    /** People's door (`asking · talking · booked · done`) a pager link keeps. */
    door?: string;
    /** The archived-and-closed chats' page. */
    opage?: string;
    /** An outside booking just added (or a code just made for it) — its row opens. */
    block?: string;
    /** Customers ⚙ is open (`customers-settings.tsx`) — the sheet's rows are read and drawn. */
    gear?: string;
    /** A save inside the ⚙ — its answer (`calendar/actions.ts` · `payment-options/actions.ts`). */
    gnotice?: string;
    gmsg?: string;
    gerror?: string;
  }>;
};

type SP = Record<string, string | string[] | undefined>;

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
  client_imported: { tone: 'ok', text: 'Booking from outside added — free. It holds that date on your schedule now.' },
  block_removed: { tone: 'ok', text: 'Booking from outside removed. The date is open again.' },
  bad_dates: { tone: 'bad', text: 'Those dates don’t work. Check the first and last day.', retry: true },
  bad_name: { tone: 'bad', text: 'The client needs a name. Nothing was added.', retry: true },
  bad_pool: { tone: 'bad', text: 'Pick which schedule this client belongs to. Nothing was added.', retry: true },
  save_failed: { tone: 'bad', text: 'That did not go through. Nothing changed — please try again.', retry: true },
};

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

  /*
    📦 ARCHIVED CHATS LEAVE THE LIST — the retired Messages fold's split, kept (owner 2026-10-28: the event list IS
    the messages). A conversation the shop archived (or the couple withdrew) steps out of Talking / Holding into
    "Archived and closed chats" at the foot of the page. ⛔ NEVER a row that waits on the shop (Asking — the same
    question Today counts) and never a booking (Booked / Done — a customer is a fact, not a chat state).
  */
  const archivedOff = new Set<string>();
  for (const r of derived) {
    if (r.lane !== 'talking' && r.lane !== 'holding') continue;
    const t = threadByEvent.get(r.eventId);
    if (t && (t.archived || t.archived_at != null)) archivedOff.add(r.eventId);
  }
  const listed = derived.filter((r) => !archivedOff.has(r.eventId));

  const lanes = groupByLane(listed);
  /*
    Computed over EVERY listed customer, never over the door on screen —
    filtering to a door must not make a date clash disappear. That is the
    difference between a warning and a decoration.
  */
  const holdingPerDate = holdingByDate(listed);

  /*
    OUTSIDE CLIENTS — the shop's `external_client` blocks: dates sold outside
    Setnayan, held on one of its schedules. Searched by name with the roster's
    own word, paged on their own (`copage`). They are BOOKED customers, so they
    sit under the Booked door, after the Setnayan rows.
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
  const outsidePage = paginate(outsideMatched, search.copage);

  /*
    🎟 THEIR ONE-TIME CODE, for the outside rows ON THIS PAGE only (owner 2026-10-28: "a booked-outside customer's
    row holds THEIR one-time code — Linked / Code sent / Not linked"). The code is the shipped Locked QR; its
    `block_id` names the outside booking it was made for. ONE read for the page's rows.
    ⚠ A REFUSED READ IS NOT "NOT LINKED": every row then says it could not check, and offers nothing.
  */
  const codeByBlock = new Map<string, OutsideCode>();
  let codesMeasured = true;
  const pageBlockIds = outsidePage.items.map((c) => c.blockId);
  if (pageBlockIds.length > 0) {
    const { data: codeRows, error: codeError } = await supabase
      .from('vendor_locked_qr_tokens')
      .select('block_id, token, status, created_at, claimed_at')
      .eq('vendor_profile_id', vendorProfileId)
      .in('block_id', pageBlockIds)
      .order('created_at', { ascending: false });
    if (codeError) {
      codesMeasured = false;
      logQueryError('VendorCustomersPage.outsideCodes', codeError, { vendorProfileId }, 'graceful_degrade');
    }
    for (const c of (codeRows ?? []) as { block_id: string; token: string; status: string; created_at: string; claimed_at: string | null }[]) {
      const had = codeByBlock.get(c.block_id);
      // Used beats waiting; the newest waiting code is the one to send again; a voided one is no code.
      if (c.status === 'claimed') codeByBlock.set(c.block_id, { state: 'linked', usedAt: c.claimed_at });
      else if (c.status === 'pending' && (!had || had.state === 'none')) codeByBlock.set(c.block_id, { state: 'sent', token: c.token, madeAt: c.created_at });
    }
  }
  const outsidePaged = {
    ...outsidePage,
    items: outsidePage.items.map((c) => ({
      ...c,
      code: codesMeasured ? (codeByBlock.get(c.blockId) ?? ({ state: 'none' } as const)) : ({ state: 'unread' } as const),
    })),
  };

  /*
    📌 THE FOUR DOORS (owner 2026-10-28, prototype `custRows()`): Asking · Talking · Booked · Done. Each is a filter
    drawn IN PLACE (`CustomersPin`) — the server draws all four lists and the door shows one. A door is the roster's
    lanes, read by the ONE derivation, never re-decided here:
      Asking  = waiting (a question or a booking ask waits on the shop)
      Talking = holding + talking (holding first — they have gone quiet)
      Booked  = booked + the outside bookings
      Done    = finished
  */
  const DOOR_LANES: Record<CustomersDoorKey, CustomerLane[]> = {
    asking: ['waiting'],
    talking: ['holding', 'talking'],
    booked: ['booked'],
    done: ['finished'],
  };
  const laneCounts = Object.fromEntries(CUSTOMER_LANES.map((l) => [l, lanes[l].length])) as Record<CustomerLane, number>;
  const doorCount = (k: CustomersDoorKey) =>
    DOOR_LANES[k].reduce((n, l) => n + laneCounts[l], 0) + (k === 'booked' ? outsideAll.length : 0);

  // A read that could not prove it reached every row — said on screen, never shown as a shorter list.
  const rosterIncomplete =
    !threadsRead.complete || !evRead.complete || Boolean(evRead.error) || eventRowsErrorSeen;
  const outsideIncomplete = !blocksRead.complete;
  /** "3" · "12+" when a read fell short · null (couldn't load) when it fell short with nothing to show. */
  const doorValue = (k: CustomersDoorKey): string | null => {
    const n = doorCount(k);
    const short = rosterIncomplete || (k === 'booked' && outsideIncomplete);
    if (!short) return formatCount(n);
    return n > 0 ? `${formatCount(n)}+` : null;
  };

  const LANE_DOOR: Record<string, CustomersDoorKey> = {
    waiting: 'asking',
    holding: 'talking',
    talking: 'talking',
    booked: 'booked',
    outside: 'booked',
    finished: 'done',
  };
  const urlDoor = (CUSTOMERS_DOORS as readonly string[]).includes(search.door ?? '')
    ? (search.door as CustomersDoorKey)
    : search.lane && LANE_DOOR[search.lane]
      ? LANE_DOOR[search.lane]
      : search.block
        ? 'booked'
        : null;

  const sp = search as Record<string, string | undefined>;
  const decorate = (r: PipelineCustomer): RosterRow => {
    const t = threadByEvent.get(r.eventId);
    const type = eventTypeByEvent.get(r.eventId);
    return {
      ...r,
      note: moneyNote(r, moneyByEvent.get(r.eventId) ?? null, paydayIncomplete),
      kind: type && type !== 'unspecified' ? eventTypeLabel(type) : null,
      quoted: false,
      returning: Boolean(t?.is_returning),
    };
  };
  const noLanes = Object.fromEntries(CUSTOMER_LANES.map((l) => [l, [] as PipelineCustomer[]])) as Record<CustomerLane, PipelineCustomer[]>;
  /*
    COUNT, NARROW, SEARCH, PAGE — per door, in that order, in the one pure step (`./roster-view.ts`). Only the door the
    address names (`?door=`) takes `?page=`; the others draw their first page. Each door's pager keeps the door.
  */
  const views = Object.fromEntries(
    CUSTOMERS_DOORS.map((k) => {
      const subset = { ...noLanes };
      for (const l of DOOR_LANES[k]) subset[l] = lanes[l];
      return [
        k,
        rosterView(subset, {
          lane: undefined,
          q: search.q,
          page: urlDoor === k ? search.page : undefined,
          decorate,
        }),
      ];
    }),
  ) as Record<CustomersDoorKey, ReturnType<typeof rosterView<RosterRow>>>;

  /*
    QUOTED — which of the TALKING rows on screen already have a quote out with the couple (sent / viewed, not a
    draft). ONE batched read, never one per row. Refused, the rows' quote word is withheld ("couldn't load").
  */
  const talkingIds = views.talking.paged.items.filter((r) => r.lane === 'talking').map((r) => r.eventId);
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
    for (const r of views.talking.paged.items) {
      if (quotedIds.has(r.eventId)) r.quoted = true;
      else if (quotedRead === 'failed' && r.lane === 'talking') r.note = { text: 'couldn’t load', tone: 'quiet' };
    }
  }

  /*
    The door a visit opens on: the one the address names (a pager link, an old `?lane=` filter, a new outside
    booking's `?block=`), else — under a search — the first door with a match, else Asking when anyone is waiting
    ("the roster opens on who is waiting"), else the first door with anyone in it.
  */
  const q = (search.q ?? '').trim();
  const firstHit = q
    ? CUSTOMERS_DOORS.find((k) => views[k].paged.total > 0 || (k === 'booked' && outsideMatched.length > 0))
    : undefined;
  const initialDoor: CustomersDoorKey =
    urlDoor ?? firstHit ?? (doorCount('asking') > 0 ? 'asking' : (CUSTOMERS_DOORS.find((k) => doorCount(k) > 0) ?? 'asking'));

  const DOOR_EMPTY: Record<CustomersDoorKey, string> = {
    asking: 'Nobody is waiting on you. When somebody asks about a date, they show up here first.',
    talking: 'No one you are talking with right now.',
    booked: 'No bookings yet. A booking from outside Setnayan goes here too — add it with Add.',
    done: 'No finished events yet.',
  };
  const pagerKeep = (k: CustomersDoorKey) =>
    [keepParamsFrom(sp, ['page', 'notice', 'add', 'door', 'lane', 'block', 'gear']), `door=${k}`].filter(Boolean).join('&');
  const doorTotal = (k: CustomersDoorKey) => doorCount(k);

  const panels = Object.fromEntries(
    CUSTOMERS_DOORS.map((k) => {
      const v = views[k];
      const isBooked = k === 'booked';
      const counts = { ...Object.fromEntries(CUSTOMER_LANES.map((l) => [l, 0])), ...Object.fromEntries(DOOR_LANES[k].map((l) => [l, laneCounts[l]])) } as Record<CustomerLane, number>;
      return [
        k,
        <>
          <CustomersRoster
            rows={v.paged.items}
            paged={v.paged}
            query={search.q ?? ''}
            incomplete={rosterIncomplete}
            pagerKeepParams={pagerKeep(k)}
            counts={counts}
            nowMs={rosterNowMs}
            holdingPerDate={holdingPerDate}
            otherMatches={isBooked ? outsideMatched.length : 0}
            otherTotal={isBooked ? outsideAll.length : 0}
            anchor={null}
            emptyLine={doorTotal(k) === 0 ? DOOR_EMPTY[k] : undefined}
          />
          {isBooked ? (
            <OutsideClientRows
              paged={outsidePaged}
              incomplete={outsideIncomplete}
              keepParams={[keepParamsFrom(sp, ['copage', 'notice', 'add', 'door', 'lane', 'gear']), 'door=booked'].filter(Boolean).join('&')}
              removeBlock={removeBlock}
              headed={v.paged.items.length > 0}
              nowMs={rosterNowMs}
              openBlock={search.block ?? null}
            />
          ) : null}
        </>,
      ];
    }),
  ) as Record<CustomersDoorKey, ReactNode>;

  /*
    ARCHIVED AND CLOSED CHATS — every chat that is not a row above, so retiring the Messages fold leaves no chat
    unreachable: the ones the shop archived, and the closed ones (turned down, booked someone else, withdrawn, an older
    chat on the same event). Newest first (the threads read is), paged on `opage`.
  */
  const listedThreads = new Set(listed.map((r) => r.threadId).filter(Boolean) as string[]);
  const others: OtherChat[] = threads
    .filter((t) => !listedThreads.has(t.thread_id))
    .map((t) => {
      const type = eventTypeByEvent.get(t.event_id);
      return {
        threadId: t.thread_id,
        title: eventChatTitle({
          name: eventNameByEvent.get(t.event_id) ?? null,
          kind: type && type !== 'unspecified' ? eventTypeLabel(type) : null,
          date: eventDateByEvent.get(t.event_id) ?? null,
          nowMs: rosterNowMs,
        }),
        why: t.archived
          ? 'Archived'
          : t.archived_at != null
            ? 'They withdrew'
            : t.inquiry_status === 'displaced'
              ? 'They booked someone else'
              : t.inquiry_status === 'declined'
                ? 'You turned it down'
                : threadByEvent.get(t.event_id)?.thread_id !== t.thread_id
                  ? 'An older chat on this event'
                  : 'Closed',
        archived: Boolean(t.archived),
      };
    });
  const othersPage = paginate(others, search.opage);
  // Won & Lost Reasons roll-up — the shop's own logged outcomes. Ownership-gated RPC; null until any is logged.
  const outcomeRollup = await fetchVendorOutcomeRollup(supabase, vendorProfileId);

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

  const notice = search.notice ? PEOPLE_NOTICES[search.notice] : undefined;
  const doors: CustomersDoor[] = [
    { key: 'asking', value: doorValue('asking'), word: 'asking', hot: doorCount('asking') > 0 },
    { key: 'talking', value: doorValue('talking'), word: 'talking' },
    { key: 'booked', value: doorValue('booked'), word: 'booked' },
    { key: 'done', value: doorValue('done'), word: 'done' },
  ];

  return (
    <>
      {notice ? <SupplierToast text={notice.text} tone={notice.tone} retry={notice.retry} retryHref="/vendor-dashboard/customers?add=outside" /> : null}

      {/* `#customers` is where the search and every old roster link land; the chats this list opens come back here. */}
      <div id="customers" className="scroll-mt-24" data-customers-people="">
        <ChatOriginMark />
        <CustomersPin
          seg="people"
          hrefs={CUSTOMER_SEGMENT_HREFS}
          doors={doors}
          panels={panels}
          initial={initialDoor}
          gear={<CustomersSettings body={search.gear === '1' ? <CustomersSettingsBody seg="people" search={search} /> : null} />}
          between={
            paydayIncomplete ? (
              <p role="status" className="mb-2 text-[13px] text-ink/70">
                Some payments couldn&rsquo;t load, so your customers&rsquo; money lines say so instead of a figure. Reload
                the page to try again.
              </p>
            ) : null
          }
        />
      </div>

      {/* Drawn only from a threads read that happened — after a refusal it would be a false "none". */}
      {threadsRead.complete || others.length > 0 ? (
        <OtherChatsFold
          paged={othersPage}
          keepParams={keepParamsFrom(sp, ['opage', 'notice', 'add', 'gear'])}
          returnTo="/vendor-dashboard/customers?door=talking"
          rollup={<InquiryOutcomesRollup rollup={outcomeRollup} />}
          incomplete={!threadsRead.complete}
        />
      ) : null}

      {/* KEPT NOTES — drawn ONLY from a read that happened AND found some: an
          empty fold would be noise, and after a refused read a false "none". */}
      {keptNotesMeasured && keptNotes.length > 0 ? (
        <KeptNotesFold notes={keptNotes.map((n) => ({ noteId: n.note_id, body: n.body, createdAt: n.created_at }))} />
      ) : null}

      {/* 📱 THE THUMB ROW — the ONE row (owner 2026-10-22): "Search customers" · ＋ Add, each its own glass, no band. */}
      <SupplierThumbRow
        name="people"
        label="Customer tools"
        row={
          <ThumbRow
            name="customers"
            field={{
              node: (
                <SearchBox
                  placeholder="Search customers"
                  defaultValue={search.q ?? ''}
                  keep={keepParamsFrom(sp, ['q', 'page', 'copage', 'notice', 'add', 'door', 'lane', 'block', 'gear'])}
                  hash="#customers"
                  data="customers"
                  tour="customers-search"
                />
              ),
            }}
            action={{
              node: (
                <OutsideClientAdd
                  pools={pools.map((p) => ({ poolId: p.poolId, label: p.label }))}
                  action={importExternalClient}
                  startOpen={search.add === 'outside'}
                  today={todayIso}
                  setupHref="/vendor-dashboard/customers?seg=dates&gear=1"
                  tour="customers-add"
                />
              ),
            }}
          />
        }
      />
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

/* ═══ DATES (S-PR3) ═══════════════════════════════════════════════════════ */

/** Every calendar action's outcome, said once by the toast and kept as the status line (`?notice=`). */
const DATES_NOTICES: Record<string, { tone: SupplierOutcomeTone; text: string; retry?: boolean }> = {
  block_added: { tone: 'ok', text: 'Marked not available. Couples see only “unavailable”.' },
  block_removed: { tone: 'ok', text: 'Open again — bookable on Setnayan.' },
  client_imported: { tone: 'ok', text: 'Booking from outside added — free. It holds that date on your schedule now.' },
  capacity_saved: { tone: 'ok', text: 'How many a day — saved.' },
  capacity_clamped: { tone: 'note', text: `Saved at ${DAILY_CAPACITY_MAX} a day — the most a calendar takes.` },
  pool_saved: { tone: 'ok', text: 'Saved — those services share that schedule now.' },
  waitlist_notified: { tone: 'ok', text: 'Told them — the couples waiting know the date is open.' },
  waitlist_settings_saved: { tone: 'ok', text: 'Waiting list saved.' },
  waitlist_picked: { tone: 'ok', text: 'Picked — they hold their place for that date.' },
  waitlist_full: { tone: 'note', text: 'That date’s waiting list is full. Raise how many a date to pick more.' },
  waitlist_not_in_plan: { tone: 'note', text: 'A waiting list comes with the paid plans. Nothing changed.' },
  waitlist_none: { tone: 'note', text: 'No one is waiting on that date yet.' },
  day_state_saved: { tone: 'ok', text: 'Day updated. Couples see only “unavailable”.' },
  day_state_cleared: { tone: 'ok', text: 'Day reopened — it’s bookable again.' },
  calendar_created: { tone: 'ok', text: 'Schedule made.' },
  calendar_saved: { tone: 'ok', text: 'Schedule saved.' },
  bad_dates: { tone: 'bad', text: 'Those dates don’t work. Check the first and last day.', retry: true },
  bad_name: { tone: 'bad', text: 'It needs a name. Nothing was saved.', retry: true },
  bad_pool: { tone: 'bad', text: 'Pick which schedule it belongs to. Nothing was saved.', retry: true },
  bad_capacity: { tone: 'bad', text: 'How many a day must be 1 or more. Nothing was saved.', retry: true },
  save_failed: { tone: 'bad', text: 'That did not go through. Nothing changed — please try again.', retry: true },
};

/** The calendar actions every Dates view hands to its rows (this page names them once). */
const DATES_ACTIONS = {
  removeBlock,
  updateWaitlistSettings,
  pickWaitlistCouple,
  notifyWaitlistSlot,
};

/**
 * The shop's open conversations about unbooked, dated events — "Holding" (amber). The thread's own `event` embed is
 * always null for a supplier, so the dates come from ONE admin `events` read scoped to this shop's own threads.
 */
async function readOpenAsks(
  threads: { thread_id: string; event_id: string; inquiry_status: string | null; created_at: string }[],
  bookedEventIds: ReadonlySet<string>,
): Promise<{ asks: DatesAsk[]; measured: boolean }> {
  const ids = [
    ...new Set(
      threads
        .filter((t) => (t.inquiry_status === 'pending' || t.inquiry_status === 'accepted') && !bookedEventIds.has(t.event_id))
        .map((t) => t.event_id),
    ),
  ];
  if (ids.length === 0) return { asks: [], measured: true };
  const { rows, error } = await readInChunks(ids, (part) =>
    createAdminClient().from('events').select('event_id, display_name, event_date').in('event_id', part),
  );
  if (error) logQueryError('VendorCustomersPage.openAsks', error, {}, 'graceful_degrade');
  const events = new Map(
    ((rows ?? []) as { event_id: string; display_name: string | null; event_date: string | null }[]).map((e) => [
      e.event_id,
      { date: e.event_date, name: e.display_name },
    ]),
  );
  return { asks: openAsksOf(threads, events, bookedEventIds), measured: !error };
}

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
  const notice = search.notice ? DATES_NOTICES[search.notice] : undefined;
  const openFold = search.open === 'availability' ? 'capacity' : (search.open ?? null);

  const [pools, bookings, blocksRead, dayStates, monthWaitlist, upcomingWaitlist, threadsRead, services, teamRows, settingsRead, pickedRead] =
    await Promise.all([
      fetchVendorPools(supabase, vendorProfileId),
      // CAPACITY, not the room: the month counts these against each pool's seats (pool-grain, as
      // `acquire_schedule_pools` enforces). A booking with no pool cannot consume a pool seat.
      fetchVendorPoolBookings(supabase, vendorProfileId),
      // Paged to the server's count; `complete` drives a note over the month and the Block days line.
      fetchVendorBlocksDetailed(supabase, vendorProfileId),
      fetchVendorDayStates(supabase, vendorProfileId, `${month}-01`, `${month}-31`),
      // The month's waiting list (its amber marks) and every date ahead (the Waitlist fold).
      fetchVendorWaitlist(supabase, vendorProfileId, `${month}-01`),
      fetchVendorWaitlist(supabase, vendorProfileId, todayIso),
      fetchVendorThreadsDetailed(supabase, vendorProfileId),
      fetchVendorServices(supabase, vendorProfileId),
      fetchVendorTeam(supabase, vendorProfileId),
      // ONE read for the plan and the waitlist settings (tier_state is excluded from the profile select).
      supabase
        .from('vendor_profiles')
        .select('waitlist_enabled, max_waitlist_acceptances, tier_state')
        .eq('vendor_profile_id', vendorProfileId)
        .maybeSingle(),
      // The couples this shop already picked off a waiting list, per date ahead.
      supabase
        .from('vendor_date_waitlist')
        .select('requested_date')
        .eq('vendor_profile_id', vendorProfileId)
        .gte('requested_date', todayIso)
        .not('accepted_at', 'is', null),
    ]);

  const blocks = blocksRead.blocks;
  const blocksIncomplete = !blocksRead.complete;

  // ⚠ THIS ROW CARRIES THEIR PLAN. Refused, nothing below may claim what the plan holds (the Waitlist fold says so).
  if (settingsRead.error) logQueryError('VendorCustomersPage.waitlistSettings', settingsRead.error, { vendorProfileId }, 'graceful_degrade');
  if (pickedRead.error) logQueryError('VendorCustomersPage.waitlistPicked', pickedRead.error, { vendorProfileId }, 'graceful_degrade');
  const settings = (settingsRead.data ?? null) as { waitlist_enabled?: boolean; max_waitlist_acceptances?: number; tier_state?: string | null } | null;
  const tier = settings?.tier_state ?? null;
  // 💳 THE SWITCH. A 0 here is the paywall, asked through the same flag-aware allowance updateWaitlistSettings
  // enforces — off, the entry plan's places. The EFFECTIVE cap (a Custom plan can buy the ceiling away).
  const waitlistTierCap = vendorAllowance(
    (await fetchEffectiveCaps(supabase, vendorProfileId, tier)).waitlistAcceptances,
    entryTierAllowance('waitlistAcceptances'),
  );
  const unlimited = !Number.isFinite(waitlistTierCap);
  const storedCap = Number(settings?.max_waitlist_acceptances) || 1;
  const pickedByDate = new Map<string, number>();
  for (const r of (pickedRead.data ?? []) as { requested_date: string }[]) {
    pickedByDate.set(r.requested_date, (pickedByDate.get(r.requested_date) ?? 0) + 1);
  }

  // Team (Pro+): one person's calendars in the month's dropdown — the services they are assigned narrow the pools.
  const agentsEnabled = tierCaps(tier).agentAccounts > 0;
  const agentCategories: Record<string, string[]> = {};
  let agents: { value: string; label: string }[] = [];
  if (agentsEnabled && teamRows.length > 0) {
    try {
      const assignments = await fetchAgentServiceAssignments(supabase, vendorProfileId);
      const categoryByServiceId = new Map(services.map((s) => [s.vendor_service_id, s.category]));
      for (const [memberId, serviceIds] of Object.entries(assignments)) {
        agentCategories[memberId] = [...new Set(serviceIds.map((sid) => categoryByServiceId.get(sid)).filter(Boolean) as string[])];
      }
      const withUser = await enrichTeamWithUsers(createAdminClient(), teamRows);
      agents = withUser.map((m) => ({ value: m.vendor_team_member_id, label: m.display_name?.trim() || m.team_label?.trim() || 'Team member' }));
    } catch {
      // Fail-soft: the dropdown keeps the calendars; a person's work is simply not offered.
      agents = [];
    }
  }

  // Holding (amber): open conversations about unbooked, dated events — a COUNT per date crosses to the browser.
  const bookedEventIds = new Set(bookings.map((b) => b.eventId));
  const { asks } = await readOpenAsks(threadsRead.threads, bookedEventIds);

  const poolLabelOf = new Map(pools.map((p) => [p.poolId, p.label]));
  // Every closure still ahead: a one-off not yet over, or a REPEAT with no end or an end still ahead. Repeats first —
  // "Every Sunday morning" is the line a parish reads before any one-off date.
  const closures = blocks
    .filter(
      (b) =>
        (b.source === 'manual' || b.source === 'synced_calendar') &&
        (b.repeat === 'once' ? b.endDate >= todayIso : !b.repeatUntil || b.repeatUntil >= todayIso),
    )
    .sort((a, b) => Number(a.repeat === 'once') - Number(b.repeat === 'once') || a.startDate.localeCompare(b.startDate))
    .map((b) => ({
      blockId: b.blockId,
      label: b.label?.trim() && b.label.trim() !== 'Unavailable' ? b.label.trim() : 'Not available',
      startDate: b.startDate,
      endDate: b.endDate,
      repeat: b.repeat,
      repeatUntil: b.repeatUntil,
      dayPart: b.dayPart,
      scope: b.poolId === null ? 'every schedule' : (poolLabelOf.get(b.poolId) ?? 'one schedule'),
    }));
  const initialDay = todayIso.startsWith(month) ? todayIso : `${month}-01`;

  return (
    <>
      {notice ? <SupplierToast text={notice.text} tone={notice.tone} retry={notice.retry} retryHref="/vendor-dashboard/customers?seg=dates" /> : null}
      {/* `id="calendar"` is where every bare /vendor-dashboard/calendar link lands (`customers/anchors.ts`). */}
      <div id="calendar" className="scroll-mt-24">
        {blocksIncomplete ? (
          <p role="status" className="mb-3 text-[13px]" style={{ color: 'rgb(var(--color-warn))' }}>
            Some of your blocked dates couldn&rsquo;t load, so a date you closed may show as open
            here. Reload the page to try again.
          </p>
        ) : null}
        {pools.length === 0 ? (
          <p className="mb-2 text-[13.5px] text-ink/70" data-dates-no-calendar="">
            Schedule not set — open ⚙ › How many a day to make one.
          </p>
        ) : null}
        <CustomersCalendar
          initialDayStates={dayStates}
          initialWaitlist={monthWaitlist}
          inquiries={asksByDate(asks)}
          initialMonth={month}
          initialDay={initialDay}
          todayIso={todayIso}
          pools={pools}
          // Only what the month and the day's rows read — a block's contact and note never cross the wire.
          bookings={bookings.map((b) => ({ poolId: b.poolId, bookedDate: b.bookedDate, eventName: b.eventName }))}
          blocks={blocks.map((k) => ({
            // A closure's id (the day switch reopens a one-day closure by it); an outside booking's never crosses.
            blockId: k.source === 'manual' ? k.blockId : undefined,
            poolId: k.poolId,
            source: k.source,
            startDate: k.startDate,
            endDate: k.endDate,
            label: k.source === 'external_client' ? null : k.label,
            clientName: k.source === 'external_client' ? k.clientName : null,
            clientTime: k.source === 'external_client' ? k.clientTime : null,
            repeat: k.repeat,
            repeatUntil: k.repeatUntil,
            dayPart: k.dayPart,
          }))}
          agents={agents}
          agentCategories={agentCategories}
          halls={pools.every((p) => p.isHall) && pools.length > 0}
          dayActions={{ addManualBlock, removeBlock }}
        />
      </div>

      <DatesFolds
        today={todayIso}
        month={month}
        open={openFold}
        closures={closures}
        closuresIncomplete={blocksIncomplete}
        waitlist={{
          tierCap: waitlistTierCap,
          unlimited,
          on: Boolean(settings?.waitlist_enabled) && waitlistTierCap > 0,
          cap: unlimited ? storedCap : Math.min(storedCap, Math.max(waitlistTierCap, storedCap)),
          grandfathered: !unlimited && storedCap > waitlistTierCap ? storedCap : 0,
          settingsMeasured: !settingsRead.error,
          pickedMeasured: !pickedRead.error,
          dates: upcomingWaitlist.map((w) => ({ ...w, picked: pickedByDate.get(w.requestedDate) ?? 0 })),
        }}
        qrHref="/vendor-dashboard/invite"
        blockAdd={<BlockDateAdd pools={pools.map((p) => ({ poolId: p.poolId, label: p.label }))} action={addManualBlock} today={todayIso} month={month} />}
        actions={DATES_ACTIONS}
      />

      {/* 📱 THE THUMB ROW (prototype thumb(), owner call 1 2026-10-14): Check a date · Add (brand — a booking from
          outside holds a date). "Mark days not available" lives in its fold and on the day. */}
      <SupplierThumbRow
        name="dates"
        label="Date tools"
        row={
          <ThumbRow
            name="dates"
            field={pools.length > 0 ? { node: <CheckADate /> } : null}
            action={{
              node: (
                <OutsideClientAdd
                  pools={pools.map((p) => ({ poolId: p.poolId, label: p.label }))}
                  action={importExternalClient}
                  today={todayIso}
                  setupHref="/vendor-dashboard/customers?seg=dates&gear=1"
                  returnTo="dates"
                  tour="dates-add"
                  halls={pools.length > 0 && pools.every((p) => p.isHall)}
                  seats={seatsByPool(pools, bookings, blocks, todayIso)}
                />
              ),
            }}
          />
        }
      />
    </>
  );
}

/** "Wedding" · "Tagaytay" — an event's words for a booked row. */
function eventWords(e: { venue_name: string | null; event_type: string | null } | undefined): string[] {
  if (!e) return [];
  return [e.venue_name?.trim() || null, e.event_type ? eventTypeLabel(e.event_type) : null].filter(Boolean) as string[];
}

/** One day (frame 35) — `?seg=dates&day=YYYY-MM-DD`; the old `/calendar/[date]` route forwards here. */
async function CustomersDay({ day, search }: { day: string; search: Awaited<Props['searchParams']> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');

  const vendorProfileId = profile.vendor_profile_id;
  const todayIso = manilaTodayIso();
  const notice = search.notice ? DATES_NOTICES[search.notice] : undefined;

  const [pools, bookings, blocksRead, dayStates, waitlist, threadsRead, tierProbe] = await Promise.all([
    fetchVendorPools(supabase, vendorProfileId),
    // CAPACITY, not the room: the day's seats are counted per pool (pool-grain, as `acquire_schedule_pools` enforces),
    // and an event with a seat is booked — the holders are the open conversations without one.
    fetchVendorPoolBookings(supabase, vendorProfileId),
    fetchVendorBlocksDetailed(supabase, vendorProfileId),
    fetchVendorDayStates(supabase, vendorProfileId, day, day),
    fetchVendorWaitlist(supabase, vendorProfileId, day),
    fetchVendorThreadsDetailed(supabase, vendorProfileId),
    supabase.from('vendor_profiles').select('tier_state').eq('vendor_profile_id', vendorProfileId).maybeSingle(),
  ]);
  const poolLabel = new Map(pools.map((p) => [p.poolId, p.label]));
  const namePools = pools.length > 1;
  const bookedToday = bookings.filter((b) => b.bookedDate === day);

  // The booked events' place and kind (admin: the supplier holds no `events` RLS) — and the holders' names and dates.
  const bookedEventIds = new Set(bookings.map((b) => b.eventId));
  const [{ asks, measured: asksMeasured }, eventsRead, caps] = await Promise.all([
    readOpenAsks(threadsRead.threads, bookedEventIds),
    bookedToday.length > 0
      ? readInChunks([...new Set(bookedToday.map((b) => b.eventId))], (part) =>
          createAdminClient().from('events').select('event_id, venue_name, event_type').in('event_id', part),
        )
      : Promise.resolve({ rows: [], error: null }),
    // "Holding this date · N of M" — the plan's ceiling, read live (a Custom plan may lift it; reads only then).
    fetchEffectiveCaps(supabase, vendorProfileId, (tierProbe.data as { tier_state?: string } | null)?.tier_state ?? null),
  ]);
  if (eventsRead.error) logQueryError('VendorCustomersPage.dayEvents', eventsRead.error, {}, 'graceful_degrade');
  const eventById = new Map(
    ((eventsRead.rows ?? []) as { event_id: string; venue_name: string | null; event_type: string | null }[]).map((e) => [e.event_id, e]),
  );

  // Who works it — READ from the team's service assignments (no per-day roster exists to pick from).
  let whoWorks: string | null = null;
  const tier = (tierProbe.data as { tier_state?: string } | null)?.tier_state ?? null;
  if (bookedToday.length > 0) {
    whoWorks = 'You';
    if (tierCaps(tier).agentAccounts > 0) {
      try {
        const [team, assignments, services] = await Promise.all([
          fetchVendorTeam(supabase, vendorProfileId),
          fetchAgentServiceAssignments(supabase, vendorProfileId),
          fetchVendorServices(supabase, vendorProfileId),
        ]);
        const catById = new Map(services.map((s) => [s.vendor_service_id, s.category]));
        const todayCats = new Set(bookedToday.flatMap((b) => pools.find((p) => p.poolId === b.poolId)?.categories ?? []));
        const names = (await enrichTeamWithUsers(createAdminClient(), team))
          .filter((m) => (assignments[m.vendor_team_member_id] ?? []).some((sid) => todayCats.has(catById.get(sid) ?? '')))
          .map((m) => m.display_name?.trim() || m.team_label?.trim() || 'Team member');
        if (names.length > 0) whoWorks = names.join(', ');
      } catch {
        // Fail-soft: "You" stays — the owner works every day the team is not named for.
      }
    }
  }

  const askedOn = (iso: string) => {
    const d = iso.slice(0, 10);
    return `asked ${rangeWords(d, d, todayIso)}`;
  };
  const holds = dayStates.filter((s) => s.stateDate === day);
  // The day, schedule by schedule — every block through the ONE rule (`lib/not-available.ts`, repeats + hours).
  const groups = dayGroupsOf(day, {
    today: todayIso,
    pools: pools.map((p) => ({ poolId: p.poolId, label: p.label, capacity: p.capacity })),
    bookings: bookedToday.map((b) => ({
      key: b.poolBookingId,
      poolId: b.poolId,
      title: b.eventName,
      line: [...eventWords(eventById.get(b.eventId)), 'Booked here'].filter(Boolean).join(' · '),
      href: `/vendor-dashboard/clients/${b.eventId}`,
    })),
    blocks: blocksRead.blocks,
    holds: holds.map((h) => ({ poolId: h.poolId, stateDate: h.stateDate, dayState: h.dayState })),
  });
  // 🏛 A VENUE'S DAY, PER HALL (prototype "the day per hall"): each hall booked · outside · not available · free, and
  // under "Joined halls" each card that uses several halls, free or saying which hall is taken.
  let venueDay: DaySheetData['venue'] = null;
  const hallPools = pools.filter((p) => p.isHall);
  if (hallPools.length > 0 && hallPools.length === pools.length) {
    const hallList = hallPools.map((p) => ({ poolId: p.poolId, name: p.label, capacity: p.capacity, seated: p.seatedCapacity ?? null, standing: p.standingCapacity ?? null }));
    const joinedIds = new Map<string, string[]>();
    for (const p of hallPools) for (const sid of p.hallServiceIds ?? []) joinedIds.set(sid, [...(joinedIds.get(sid) ?? []), p.poolId]);
    const multi = [...joinedIds.entries()].filter(([, ids]) => ids.length > 1);
    const cardNames = multi.length > 0 ? new Map((await fetchVendorServices(supabase, vendorProfileId)).map((s) => [s.vendor_service_id, s.title ?? s.category])) : new Map<string, string>();
    const state = hallsOnDay(
      day,
      hallList,
      bookedToday.map((b) => ({ poolId: b.poolId, eventId: b.eventId, title: b.eventName })),
      blocksRead.blocks,
    );
    const joinedOf = (eventId: string) => state.filter((x) => x.used.some((u) => u.eventId === eventId)).map((x) => x.hall.name);
    venueDay = {
      answer: hallsAnswer(state),
      halls: state.map((x) => {
        const first = x.used[0];
        const joined = first && !first.outside ? joinedOf(first.eventId) : [];
        return {
          key: x.hall.poolId,
          title: x.hall.name,
          line: first
            ? [first.time ? clockWords(first.time) : '', first.title, joined.length > 1 ? `joined ${joined.join(' + ')}` : ''].filter(Boolean).join(' · ')
            : x.closedBy ?? (hallGuests(x.hall) || 'Free'),
          badge: first ? (first.outside ? { tone: 'quiet' as const, word: 'Outside' } : { tone: 'ok' as const, word: 'Booked' }) : x.closedBy ? { tone: 'quiet' as const, word: 'Not available' } : { tone: 'ok' as const, word: 'Free' },
          href: first && !first.outside ? `/vendor-dashboard/clients/${first.eventId}` : null,
        };
      }),
      joined: multi.map(([sid, ids]) => {
        const j = joinedCardOnDay({ serviceId: sid, name: cardNames.get(sid) ?? 'Joined halls', poolIds: ids }, state, hallList);
        return { key: sid, title: cardNames.get(sid) ?? ids.map((id) => hallList.find((h) => h.poolId === id)?.name).join(' + '), line: j.line, free: j.free };
      }),
    };
  }

  const holders = asks
    .filter((a) => a.date === day)
    .map((a) => ({ threadId: a.threadId, title: a.name ?? 'A couple', line: `${askedOn(a.askedAt)} · not booked` }));
  const near = daysFrom(todayIso, day);
  const ceiling = caps.whitelistPerDate;
  const data: DaySheetData = {
    day,
    today: todayIso,
    sub: [
      nearWord(todayIso, day) || (near !== null && near > 0 ? `in ${near < 14 ? `${near} days` : near < 63 ? `${Math.round(near / 7)} weeks` : `${Math.round(near / 30)} months`}` : ''),
      namePools ? '' : pools[0] ? `${pools[0].label} schedule` : '',
    ]
      .filter(Boolean)
      .join(' · '),
    backHref: `/vendor-dashboard/customers?seg=dates&m=${day.slice(0, 7)}`,
    answer: dayAnswerOfGroups(groups, holders.length),
    groups,
    holders,
    holdersMeasured: asksMeasured && threadsRead.complete,
    holdingCeiling: Number.isFinite(ceiling) ? ceiling : null,
    waiting: waitlist.find((w) => w.requestedDate === day)?.pendingCount ?? 0,
    closures: blocksRead.blocks
      .filter((b) => (b.source === 'manual' || b.source === 'synced_calendar') && blockClosesDay(b, day))
      .map((b) => ({
        blockId: b.blockId,
        label: b.label?.trim() && b.label.trim() !== 'Unavailable' ? b.label.trim() : 'Not available',
        startDate: b.startDate,
        endDate: b.endDate,
        scope: b.poolId === null ? 'every schedule' : (poolLabel.get(b.poolId) ?? 'one schedule'),
        repeatWords: repeatWords(b),
      })),
    holds: holds.map((s) => ({
      key: s.dayStateId,
      scope: s.poolId ?? 'org',
      title: s.dayState === 'locked' ? 'Held by you' : 'You approve each ask',
      line: s.poolId === null ? 'Every schedule' : (poolLabel.get(s.poolId) ?? 'One schedule'),
    })),
    whoWorks,
    qrHref: `/vendor-dashboard/invite?mode=locked&date=${day}`,
    venue: venueDay,
  };

  return (
    <>
      {notice ? <SupplierToast text={notice.text} tone={notice.tone} retry={notice.retry} retryHref={daySheetHref(day)} /> : null}
      {!blocksRead.complete ? (
        <p role="status" className="mb-3 text-[13px]" style={{ color: 'rgb(var(--color-warn))' }}>
          Some of your blocked dates couldn&rsquo;t load, so this day may show as open. Reload the page to try again.
        </p>
      ) : null}
      <DaySheet data={data} actions={{ addManualBlock, removeBlock, setCalendarDayState, notifyWaitlistSlot }} />
      {/* 📱 The day's thumb row (prototype SCREENS.day): "Add a booking" — from outside, this date filled. */}
      <SupplierThumbRow
        name="dates"
        label="Date tools"
        row={
          <ThumbRow
            name="day"
            action={{
              node: (
                <OutsideClientAdd
                  pools={pools.map((p) => ({ poolId: p.poolId, label: p.label }))}
                  action={importExternalClient}
                  today={todayIso}
                  setupHref="/vendor-dashboard/customers?seg=dates&gear=1"
                  returnTo="dates"
                  halls={pools.length > 0 && pools.every((p) => p.isHall)}
                  day={day}
                  seats={seatsByPool(pools, bookings, blocksRead.blocks, todayIso)}
                  label="Add a booking"
                />
              ),
            }}
          />
        }
      />
    </>
  );
}

/* ═══ THE FOLDS — one accordion, each fold under its own segment ══════════ */

// Quotes and Contracts fold under Money (papers about a deal; S-PR5 moves them onto the customer card).
// 🗑 MESSAGES IS NO LONGER A FOLD (owner 2026-10-28: "the event list IS the messages" — one row per event, each opening
// its chat full screen). What only it held lives on People now: archived and closed chats + the won/lost roll-up in
// "Archived and closed chats", and Archive itself in each chat's ⋮ menu.
// Dates has no accordion: its tools are its own folds (S-PR3, `dates-folds.tsx`).
const CUSTOMER_SECTIONS: AccordionSection[] = [
  {
    // 📋 THE BOOKINGS QUEUE, FOLDED (S-PR4). Its money moved into Money's rows; the queue stays one tap away because
    // it alone carries "Add to prep schedule" (`VendorPrepForBooking`) — S-PR5 moves that onto the customer card.
    key: 'bookings',
    label: 'Bookings',
    sub: 'Each booking’s status and prep items',
    icon: <ClipboardList className="h-4 w-4" strokeWidth={1.75} />,
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
    case 'bookings':
      return <BookingsSurface searchParams={pass as never} />;
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
        <div
          className={`mx-auto w-full max-w-3xl space-y-4 px-4 pb-6 pt-4 sm:px-6 lg:px-8 ${seg === 'money' ? 'tab:max-w-3xl' : 'tab:max-w-5xl'}`}
          data-customers-seg-open={seg}
        >
          <h1 className="sr-only">Customers</h1>
          {/* 📌 People draws its own pinned row (with the four counts); Dates and Money draw the same row — the view ▾
              and the ⚙ — over their own figures. One day (Dates › a day) has its own back-headed sheet instead. */}
          {seg === 'people' || (seg === 'dates' && search.day) ? null : (
            <CustomersPin
              seg={seg}
              hrefs={CUSTOMER_SEGMENT_HREFS}
              gear={<CustomersSettings body={search.gear === '1' ? <CustomersSettingsBody seg={seg} search={search} /> : null} />}
            />
          )}
          {seg === 'people' ? (
            <div className="pb-24">
              <CustomersPipeline search={search} />
            </div>
          ) : seg === 'dates' ? (
            <div className="pb-24">
              {/^\d{4}-\d{2}-\d{2}$/.test(search.day ?? '') ? (
                <CustomersDay day={search.day as string} search={search} />
              ) : (
                <CustomersDates search={search} />
              )}
            </div>
          ) : (
            // 💰 Money (S-PR4): payday + earnings + the booking-fee bills, as rows. `#payday` is where every "to come
            // in" door lands (`customers/anchors.ts`).
            <div id="payday" className="scroll-mt-24">
              <CustomersMoney search={sp} />
            </div>
          )}
        </div>
      </section>


      {/* `#customer-tools` is where every fold's door lands (`customers/anchors.ts`); `#bookings` is the old Bookings
          link's landing — the Bookings fold sits in this accordion under Money. */}
      {seg === 'money' ? <span id="bookings" aria-hidden className="block scroll-mt-24" /> : null}
      <div id="customer-tools" className="scroll-mt-24">
        {sections.length > 0 ? (
          <FeatureAccordion sections={sections} openKey={open} measure={seg === 'money' ? 'reading' : 'wide'}>
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
