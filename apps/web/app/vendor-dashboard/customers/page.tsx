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
import { vendorAllowance } from '@/lib/vendor-feature-gate';
import { entryTierAllowance, tierCaps } from '@/lib/vendor-tier-caps';
import { fetchCapsWithAddOns } from '@/lib/vendor-ultra-addons';
import { datesBlocksForWire, datesBookingsForWire } from './dates-wire';
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
import { buildCustomerCalendarMonth, computeEventMoneyPositions, type EventMoneyPosition } from '@/lib/vendor-customers';
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
import { CustomersRoster, EventsHeading, type RosterRow } from './_components/customers-roster';
import { readSupplierEventLines } from '@/lib/supplier-event-lines.server';
import { stageOfLane } from '@/lib/supplier-event-lines';
import { acceptInquiry, declineInquiry } from '@/lib/chat-actions';
import {
  KeptNotesFold,
  OtherChatsFold,
  OutsideClientRows,
  type OtherChat,
  type OutsideClient,
  type OutsideCode,
} from './_components/people-more';
import { CustomersPin, type CustomersDoor, type CustomersQuick } from './_components/customers-pin';
import { MeetingsList, PaymentsList, UnreadList } from './_components/clients-tile-lists';
import { countWords, overdueRead, toCollectTileWords, unreadEvents, type ClientMeeting, type CountRead } from './clients-tiles';
import { moneyPicture } from '@/lib/vendor-money';
import { ClientsShowSort } from './_components/clients-show-sort';
import { clientsChoiceOf, groupKeyOf, narrowClients, orderClients, type ClientsContext } from './clients-show-sort';
import { readUnreadChatCountsByThread } from '@/lib/vendor-unread-threads';
import { resolveAppointmentLabel } from '@/lib/appointments';
import {
  CUSTOMERS_DOORS,
  CUSTOMERS_LISTS,
  CUSTOMERS_LIST_LANES,
  customersDoorOf,
  type CustomersDoorKey,
  type CustomersListKey,
} from './segments';
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
import { DatesFolds } from './_components/dates-folds';
import { BlockDateAdd } from './_components/dates-sheets';
import { DaySheet, type DaySheetData } from './_components/day-sheet';
import { readOpenAsks } from './open-asks';
import { CUSTOMER_SEGMENT_HREFS, customersSegmentOf, foldsOf, oldPeopleAddressForward } from './segments';
import { keepParamsFrom } from '../_components/list-pager';
import { SupplierThumbRow } from '../_components/supplier-thumb-row';
import { SupplierToast, type SupplierOutcomeTone } from '../_components/supplier-toast';
import { DATES_NOTICES } from '../calendar/dates-notices';
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

export const metadata = { title: 'Clients' };

/**
 * /vendor-dashboard/customers — Customers = Events · Dates · Money (S-PR2,
 * corpus `SUPPLIER_DASHBOARD_REDESIGN_2026-10-08_fable.md` § 3; owner-approved
 * 2026-10-08, layout "B"; the first view renamed People → Events 2026-10-30).
 *
 * 🗂 CUSTOMERS ARE EVENTS, NOT PEOPLE (owner 2026-10-29: *"a people can have
 * multiple events? and in one event, can have multiple cohost?"* ⇒ DECISION_LOG
 * "CUSTOMERS ARE EVENTS, NOT PEOPLE"; re-reported 2026-10-30: *"supplier
 * dashboard>Customers still show people and not events"*). The first view is
 * EVENTS: one row per event ("Indalecio & Claire · Wedding · Dec 18"), a host
 * with two events is two rows, and an opened row lists everyone hosting it.
 * The old `?seg=people` address forwards here (`oldPeopleAddressForward`).
 *
 * ONE segmented control (the Guests/Suppliers shape, the shared pill track),
 * three views of the same bookings, each with its own address (`?seg=`):
 *
 *   Events — the shop's customers' events, waiting first: one row per event,
 *            the outside bookings and the kept notes (the retired Clients
 *            page), search + Add in the thumb row. The page's FIRST view.
 *   Dates  — the month (`#calendar`), its availability tools and the QR codes.
 *            Redrawn by S-PR3; moved here unchanged.
 *   Money  — Bookings (`#bookings`) and Payday (`#payday`), with Quotes and
 *            Contracts. Redrawn by S-PR4; moved here unchanged.
 *
 * 🔑 EACH SEGMENT READS ONLY WHAT IT DRAWS (owner 2026-10-08: "the fewest
 * requests"). Events no longer pays for the month grid's day states, waitlist,
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
    /** Events' door (`asking · talking · booked · done`) a pager link keeps. */
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
const EVENTS_NOTICES: Record<string, { tone: SupplierOutcomeTone; text: string; retry?: boolean }> = {
  client_imported: { tone: 'ok', text: 'Booking from outside added — free. It holds that date on your schedule now.' },
  block_removed: { tone: 'ok', text: 'Booking from outside removed. The date is open again.' },
  bad_dates: { tone: 'bad', text: 'Those dates don’t work. Check the first and last day.', retry: true },
  bad_name: { tone: 'bad', text: 'The client needs a name. Nothing was added.', retry: true },
  bad_pool: { tone: 'bad', text: 'Pick which schedule this client belongs to. Nothing was added.', retry: true },
  save_failed: { tone: 'bad', text: 'That did not go through. Nothing changed — please try again.', retry: true },
};

/* ═══ EVENTS (People until 2026-10-30 — "Customers are events") ═══════════ */

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
  // 📅 The month on top (Build 2 #43a): its own reads start NOW, beside the list's — one round, not a waterfall.
  const month = /^\d{4}-\d{2}$/.test(search.m ?? '') ? (search.m as string) : todayIso.slice(0, 7);
  const monthReads = startMonthReads(supabase, vendorProfileId, month, todayIso);

  // The roster's reads, in parallel. Each helper is the SAME one the
  // dedicated pages use — one source of truth per surface.
  /*
    ⚡ STARTED NOW, AWAITED WHERE THEY ARE DRAWN (owner 2026-10-29, "fastest load and fewest requests"): the won/lost
    roll-up and the kept notes depend on nothing else on this page, so they ride alongside the roster's reads instead
    of waiting behind them — one round of parallel reads, not a waterfall.
  */
  const outcomeRollupRead = fetchVendorOutcomeRollup(supabase, vendorProfileId);
  const keptNotesRead = supabase
    .from('vendor_client_notes')
    .select('note_id, body, created_at')
    .eq('vendor_profile_id', profile.vendor_profile_id)
    .is('event_id', null)
    .order('created_at', { ascending: false })
    .limit(50);
  const [pools, bookings, blocksRead, threadsRead, paydayRes, meetingsRead, unreadRead] = await Promise.all([
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
    /*
      🗓 SCHEDULES (v113 tile, spec §9 #7) — the shop's meetings still to come: tastings, ocular visits, run-throughs
      (`event_appointments`, its own vendor-read policy). Counted exactly; the first 200 are listed.
    */
    supabase
      .from('event_appointments')
      .select('appointment_id, event_id, type, custom_label, scheduled_at, status', { count: 'exact' })
      .eq('vendor_profile_id', vendorProfileId)
      .in('status', ['proposed', 'confirmed'])
      .or(`scheduled_at.gte.${new Date(`${todayIso}T00:00:00+08:00`).toISOString()},scheduled_at.is.null`)
      .order('scheduled_at', { ascending: true, nullsFirst: false })
      .limit(200),
    // 💬 UNREAD (v113 button) — the shop's unread chat notices, per thread; matched to the list's events below.
    readUnreadChatCountsByThread(supabase, user.id),
  ]);
  /*
    👥 HANDLED BY (Show & sort, spec §9 #7) — the team and its service assignments, the shop's own pair
    (`vendor_service_agents`, what `agent_customer_event_ids()` scopes an agent by). Refused → null: Handled by says
    the team couldn't load, and nobody is narrowed by a guess.
  */
  const [teamRead, assignmentsRead, servicesRead] = await Promise.all([
    fetchVendorTeam(supabase, vendorProfileId).catch(() => null),
    fetchAgentServiceAssignments(supabase, vendorProfileId).catch(() => null),
    fetchVendorServices(supabase, vendorProfileId).catch(() => null),
  ]);

  const threads = threadsRead.threads;
  const monthPart = await customersMonth({
    supabase,
    vendorProfileId,
    todayIso,
    month,
    openFold: search.open === 'availability' ? 'capacity' : (search.open ?? null),
    pools,
    bookings,
    blocksRead,
    threads,
    services: servicesRead ?? [],
    teamRows: teamRead ?? [],
    reads: monthReads,
  });
  if (meetingsRead.error) logQueryError('VendorCustomersPage.meetings', meetingsRead.error, { vendorProfileId }, 'graceful_degrade');
  if (unreadRead.error) logQueryError('VendorCustomersPage.unread', { message: unreadRead.error }, { vendorProfileId }, 'graceful_degrade');
  const meetings: ClientMeeting[] = ((meetingsRead.data ?? []) as {
    appointment_id: string;
    event_id: string;
    type: string;
    custom_label: string | null;
    scheduled_at: string | null;
    status: 'proposed' | 'confirmed';
  }[]).map((a) => ({
    appointmentId: a.appointment_id,
    eventId: a.event_id,
    label: resolveAppointmentLabel(a, {}),
    scheduledAt: a.scheduled_at,
    status: a.status,
  }));
  const meetingsFailed = Boolean(meetingsRead.error);
  const meetingsCount: CountRead = {
    n: meetingsFailed ? meetings.length : (meetingsRead.count ?? meetings.length),
    complete: !meetingsFailed && meetingsRead.count !== null,
    failed: meetingsFailed,
  };

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
          'vendor_id, event_id, status, lock_request_state, lock_requested_at, lock_request_expires_at, completion_status, customer_confirmed_received_at, service_id',
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
    service_id: string | null;
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

  /*
    ⇅ SHOW & SORT (v113; spec §9 #7) — Service · Status · Client · Handled by narrow EVERY event before the lists are
    counted and paged; Group by and Sort order each list (`clients-show-sort.ts`). The plain address is the shipped list.
  */
  const choice = clientsChoiceOf(search as Record<string, string | undefined>);
  const meRow = teamRead?.find((m) => m.user_id === user.id) ?? null;
  const viewerIsAgent = meRow?.role === 'agent';
  const seatsByService = new Map<string, string[]>();
  for (const [memberId, serviceIds] of Object.entries(assignmentsRead ?? {})) {
    for (const sid of serviceIds) seatsByService.set(sid, [...(seatsByService.get(sid) ?? []), memberId]);
  }
  const teamKnown = teamRead !== null && assignmentsRead !== null;
  const seatNames = teamKnown && teamRead.length > 0 ? await enrichTeamWithUsers(rosterAdmin, teamRead).catch(() => null) : [];
  const seatName = (id: string) => {
    const m = seatNames?.find((t) => t.vendor_team_member_id === id);
    return id === meRow?.vendor_team_member_id ? 'You' : m?.display_name?.trim() || m?.team_label?.trim() || 'Team member';
  };
  const clientsCtx: ClientsContext = {
    serviceOf: (eventId) => bookingByEvent.get(eventId)?.service_id ?? null,
    seatsOf: (eventId) => {
      const sid = bookingByEvent.get(eventId)?.service_id;
      return sid ? (seatsByService.get(sid) ?? []) : [];
    },
    meSeat: meRow?.vendor_team_member_id ?? null,
    // An agent is held to their own seat only when the team was read — never narrowed by a refused read.
    agent: teamKnown && viewerIsAgent,
    lastActivity: (eventId) => threadByEvent.get(eventId)?.updated_at ?? null,
    today: todayIso,
  };
  const narrowed = teamKnown || !choice.who ? narrowClients(listed, choice, clientsCtx) : narrowClients(listed, { ...choice, who: null }, clientsCtx);
  const groupKey = groupKeyOf(choice.group, clientsCtx, seatName);
  const lanes = groupByLane(narrowed);
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
    📌 EVERY EVENT, THEN THREE COUNTS (approved v13 + DECISION_LOG 2026-10-29 "Customers › Events → Asking · Booked ·
    Done"; controller call 2026-10-30 — they were four, Talking a door of its own). The list OPENS WITH EVERY EVENT; each
    count is a filter drawn IN PLACE (`CustomersPin`) — the server draws all four lists and the row shows one. A list is
    the roster's lanes, read by the ONE derivation, never re-decided here (`CUSTOMERS_LIST_LANES`):
      All     = every lane, waiting first + the outside bookings
      Asking  = waiting + holding + talking (not booked yet — the row's badge says which)
      Booked  = booked + the outside bookings
      Done    = finished
  */
  const DOOR_LANES = CUSTOMERS_LIST_LANES;
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

  // The count the address names (`?door=` — the old `talking` is Asking now —, an older `?lane=`, a new outside
  // booking's `?block=`), else none: every event.
  const urlDoor = customersDoorOf(search);

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
    COUNT, NARROW, SEARCH, PAGE — per list, in that order, in the one pure step (`./roster-view.ts`). Only the list the
    address names (`?door=`, none = every event) takes `?page=`; the others draw their first page. Each pager keeps its
    list.
  */
  const views = Object.fromEntries(
    CUSTOMERS_LISTS.map((k) => {
      const subset = { ...noLanes };
      for (const l of DOOR_LANES[k]) subset[l] = lanes[l];
      return [
        k,
        rosterView(subset, {
          lane: undefined,
          q: search.q,
          page: (urlDoor ?? 'all') === k ? search.page : undefined,
          decorate,
          order: (rows) => orderClients(rows, choice, clientsCtx, groupKey),
        }),
      ];
    }),
  ) as Record<CustomersListKey, ReturnType<typeof rosterView<RosterRow>>>;

  /*
    QUOTED — which of the TALKING rows on screen already have a quote out with the couple (sent / viewed, not a
    draft). ONE batched read, never one per row. Refused, the rows' quote word is withheld ("couldn't load").
  */
  // The talking rows on screen — under Asking and on the every-event list (each list decorates its own copy of a row).
  const talkingRows = [...views.asking.paged.items, ...views.all.paged.items].filter((r) => r.lane === 'talking');
  const talkingIds = [...new Set(talkingRows.map((r) => r.eventId))];
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
    for (const r of talkingRows) {
      if (quotedIds.has(r.eventId)) r.quoted = true;
      else if (quotedRead === 'failed') r.note = { text: 'couldn’t load', tone: 'quiet' };
    }
  }

  /*
    📋 EVERY ROW OPENS TO ITS EVENT (supplier dashboard v13, APPROVED 2026-10-29: "One row per event; opened = the fixed
    lines + For your service"). The lines of every row ON SCREEN — each door's one page, never the whole roster — in ONE
    batched read (`readSupplierEventLines`: one parallel round + the names). Opening a row reads nothing. Refused → each
    row says its details couldn't load, and its chat still opens.
  */
  const onScreen = CUSTOMERS_LISTS.flatMap((k) => views[k].paged.items);
  const linesRead = await readSupplierEventLines(rosterAdmin, {
    vendorProfileId,
    shopServices: (profile.services ?? null) as string[] | null,
    events: onScreen.map((r) => ({ eventId: r.eventId, stage: stageOfLane(r.lane) })),
    vouched: new Set(bookedByEvent.keys()),
  }).catch(() => null);
  const lines = linesRead ? Object.fromEntries(linesRead) : {};

  /*
    🗂 THE LIST A VISIT OPENS ON: the count the address names (a pager link, an old `?lane=` filter, a new outside
    booking's `?block=`), else NONE — every event, waiting first (approved v13; controller call 2026-10-30: opening on
    Asking alone made a supplier's booked events look gone). A search narrows every list; the every-event one shows all
    its matches.
  */
  const initialDoor: CustomersDoorKey | null = urlDoor;
  const allTotal = CUSTOMERS_DOORS.reduce((n, k) => n + doorCount(k), 0);

  const DOOR_EMPTY: Record<CustomersListKey, string> = {
    all: 'No events yet. When somebody asks about a date, or books you, their event shows up here — the ones waiting on you first.',
    asking: 'Nobody is asking right now. When somebody asks about a date, their event shows up here first.',
    booked: 'No bookings yet. A booking from outside Setnayan goes here too — add it with Add.',
    done: 'No finished events yet.',
  };
  const pagerKeep = (k: CustomersListKey) =>
    [keepParamsFrom(sp, ['page', 'notice', 'add', 'door', 'lane', 'block', 'gear']), k === 'all' ? '' : `door=${k}`]
      .filter(Boolean)
      .join('&');
  const doorTotal = (k: CustomersListKey) => (k === 'all' ? allTotal : doorCount(k));

  const rosterPanels = Object.fromEntries(
    CUSTOMERS_LISTS.map((k) => {
      const v = views[k];
      // The outside bookings are booked events: under Booked, and on the every-event list after the Setnayan rows.
      const isBooked = k === 'booked' || k === 'all';
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
            lines={lines}
            answers={{ acceptInquiry, declineInquiry }}
            list={k === 'all' ? null : k}
            groupOf={groupKey}
          />
          {isBooked ? (
            <OutsideClientRows
              paged={outsidePaged}
              incomplete={outsideIncomplete}
              keepParams={[keepParamsFrom(sp, ['copage', 'notice', 'add', 'door', 'lane', 'gear']), k === 'all' ? '' : 'door=booked'].filter(Boolean).join('&')}
              removeBlock={removeBlock}
              headed={v.paged.items.length > 0}
              nowMs={rosterNowMs}
              // A just-added booking opens under Booked (where `?block=` lands); the every-event list keeps it shut and
              // leaves the page's one `#outside` to Booked.
              openBlock={k === 'booked' ? (search.block ?? null) : null}
              anchor={k === 'booked' ? 'outside' : null}
            />
          ) : null}
        </>,
      ];
    }),
  ) as Record<CustomersListKey, ReactNode>;

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
  const outcomeRollup = await outcomeRollupRead;

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
  const { data: keptNoteRows, error: keptNotesError } = await keptNotesRead;
  if (keptNotesError) {
    logQueryError('VendorCustomersPage.keptNotes', keptNotesError, { vendorProfileId }, 'graceful_degrade');
  }
  const keptNotesMeasured = !keptNotesError;
  const keptNotes = (keptNoteRows ?? []) as Array<{ note_id: string; body: string; created_at: string }>;

  // One screen, one toast: an outside client's Add / Remove, or any of the month's tools (Build 2 #43a).
  const notice = search.notice ? (EVENTS_NOTICES[search.notice] ?? DATES_NOTICES[search.notice]) : undefined;
  /*
    🧮 THE TILES (v113, spec §9 #7; owner 2026-11-08): Booked · Schedules · Asked · To collect, then Overdue (n) › and
    Unread (n) › under the row. Each shows its list IN PLACE. "Done" left the row and stays a list — Show & sort's Done
    (spec §10). Money's figures are Money's own picture (`moneyPicture`), never re-added here.
  */
  const picture = moneyPicture(paydayIncomplete ? null : paydayRows, 'all', todayIso);
  const unreadRows = unreadEvents(narrowed, unreadRead.countByThread);
  const unreadFailed = Boolean(unreadRead.error) || !unreadRead.complete;
  const doors: CustomersDoor[] = [
    { key: 'booked', value: doorValue('booked'), word: 'booked', dot: 'booked' },
    { key: 'schedules', value: countWords(meetingsCount), word: 'schedules' },
    { key: 'asking', value: doorValue('asking'), word: 'asked', hot: doorCount('asking') > 0, dot: 'asking' },
    { key: 'collect', value: toCollectTileWords(picture.totals), word: 'to collect' },
  ];
  // 📌 The pinned row's two figures (Build 2 #43b, v113 "6 booked · ₱48,000 to collect") — the SAME reads as the tiles.
  const pinCounts = `${doorValue('booked') ?? '—'} booked · ${picture.totals ? formatPhp(picture.totals.toComePhp) : '—'} to collect`;
  const overdue = overdueRead(picture.totals);
  const quick: CustomersQuick[] = [
    { key: 'overdue', word: 'Overdue', value: overdue ? countWords(overdue) : null, zero: overdue?.n === 0 },
    {
      key: 'unread',
      word: 'Unread',
      value: countWords({ n: unreadRows.length, complete: !unreadFailed, failed: unreadFailed }),
      zero: !unreadFailed && unreadRows.length === 0,
    },
  ];
  const nameOfEvent = (eventId: string) =>
    listed.find((r) => r.eventId === eventId)?.title ?? eventNameByEvent.get(eventId) ?? 'A client';
  const tilePanels: Record<string, ReactNode> = {
    schedules: <MeetingsList meetings={meetings} nameOf={nameOfEvent} failed={meetingsFailed} />,
    collect: (
      <PaymentsList
        rows={picture.rows}
        failed={picture.totals === null}
        data="collect"
        empty="Nothing to collect — every payment is in."
      />
    ),
    overdue: (
      <PaymentsList
        rows={picture.rows.filter((r) => r.badge?.word === 'Overdue')}
        failed={picture.totals === null}
        data="overdue"
        empty="Nothing overdue."
      />
    ),
    unread: (
      <UnreadList
        rows={unreadRows}
        countOf={(t) => unreadRead.countByThread.get(t) ?? 0}
        failed={unreadFailed}
      />
    ),
  };
  const panels: Record<string, ReactNode> = { ...rosterPanels, ...tilePanels };

  return (
    <>
      {notice ? <SupplierToast text={notice.text} tone={notice.tone} retry={notice.retry} retryHref="/vendor-dashboard/customers" /> : null}

      {/* 🖥 MAXIMIZE THE SCREEN (owner 2026-10-29) — THE TWO COLUMNS (supplier dashboard v13): from 701 the events sit
          left and the opened event is drawn right (`CustomersPin` → `SupplierOpenScope`); the chats not on the list and
          the kept notes follow the list in the left column. On a phone, one column and a row opens in place. */}
      {/* `#customers` is where the search and every old roster link land; the chats this list opens come back here. */}
      <div id="customers" className="min-w-0 scroll-mt-24" data-customers-events="">
        <ChatOriginMark />
        {monthPart.head}
        <CustomersPin
          seg="events"
          hrefs={CUSTOMER_SEGMENT_HREFS}
          title={{ counts: pinCounts }}
          month={monthPart.month}
          doors={doors}
          panels={panels}
          quick={quick}
          initial={initialDoor}
          gear={<CustomersSettings body={search.gear === '1' ? <CustomersSettingsBody seg="events" search={search} /> : null} />}
          columns={{ rest: 'No events here yet. When somebody asks about a date, or books you, their event shows up here.' }}
          between={
            <>
              <EventsHeading />
              {paydayIncomplete ? (
                <p role="status" className="mb-2 text-[13px] text-ink/70">
                  Some payments couldn&rsquo;t load, so your customers&rsquo; money lines say so instead of a figure.
                  Reload the page to try again.
                </p>
              ) : null}
            </>
          }
          after={
            <div className="mt-6 space-y-2" data-customers-side="">
              {/* Drawn only from a threads read that happened — after a refusal it would be a false "none". */}
              {threadsRead.complete || others.length > 0 ? (
                <OtherChatsFold
                  paged={othersPage}
                  keepParams={keepParamsFrom(sp, ['opage', 'notice', 'add', 'gear'])}
                  returnTo="/vendor-dashboard/customers?door=asking"
                  rollup={<InquiryOutcomesRollup rollup={outcomeRollup} />}
                  incomplete={!threadsRead.complete}
                />
              ) : null}
              {/* KEPT NOTES — drawn ONLY from a read that happened AND found some: an empty fold would be noise, and
                  after a refused read a false "none". */}
              {keptNotesMeasured && keptNotes.length > 0 ? (
                <KeptNotesFold notes={keptNotes.map((n) => ({ noteId: n.note_id, body: n.body, createdAt: n.created_at }))} />
              ) : null}
              {monthPart.folds}
            </div>
          }
        />
      </div>

      {/* 📱 THE THUMB ROW (v113 `thumb()`, Build 2 #43d): Search clients · ⇅ Show & sort · ＋ Add, each its own glass.
          "Check a date" left it: the month is on this screen and a picked day's bar says what the day holds. */}
      <SupplierThumbRow
        name="events"
        label="Customer tools"
        row={
          <ThumbRow
            name="customers"
            field={{
              node: (
                <SearchBox
                  placeholder="Search clients"
                  defaultValue={search.q ?? ''}
                  keep={keepParamsFrom(sp, ['q', 'page', 'copage', 'notice', 'add', 'door', 'lane', 'block', 'gear'])}
                  hash="#customers"
                  data="customers"
                  tour="customers-search"
                />
              ),
            }}
            right={[
              {
                node: (
                  <ClientsShowSort
                    choice={choice}
                    initialShow={initialDoor}
                    services={(servicesRead ?? []).filter((s) => s.is_active).map((s) => ({ key: s.vendor_service_id, label: s.title?.trim() || 'A service' }))}
                    clients={listed.map((r) => ({ key: r.eventId, label: r.title }))}
                    seats={teamKnown && seatNames ? teamRead.filter((m) => m.vendor_team_member_id !== meRow?.vendor_team_member_id).map((m) => ({ key: m.vendor_team_member_id, label: seatName(m.vendor_team_member_id) })) : null}
                    agent={clientsCtx.agent}
                    shown={narrowed.length}
                    keep={keepParamsFrom(sp, ['svc', 'st', 'client', 'who', 'group', 'sort', 'page', 'notice', 'add', 'gear'])}
                  />
                ),
              },
            ]}
            action={{
              node: (
                <OutsideClientAdd
                  pools={pools.map((p) => ({ poolId: p.poolId, label: p.label }))}
                  action={importExternalClient}
                  startOpen={search.add === 'outside'}
                  today={todayIso}
                  setupHref="/vendor-dashboard/customers?gear=1"
                  tour="customers-add"
                  halls={pools.length > 0 && pools.every((p) => p.isHall)}
                  seats={seatsByPool(pools, bookings, blocksRead.blocks, todayIso)}
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
  /*
    💰 PRICE · PAID · NEXT (owner 2026-10-29, DECISION_LOG "SUPPLIER › CUSTOMERS › EVENTS — THE OPENED EVENT ROW SHOWS A
    FIXED SET OF LINES": "the supplier's own money stays in the row's top line (price · paid · next due)"; v13 draws
    "₱65,000 · ₱25,000 paid · next ₱20,000 Nov 18"). Every figure is the frozen plan's — the same one Money adds up.
  */
  if (m.fullyPaid) return { text: `${formatPhp(m.expectedPhp)} · paid in full`, tone: 'ok' };
  if (m.balancePhp > 0) {
    const next = m.nextDue
      ? `next ${formatPhp(m.nextDue.amountPhp)}${m.nextDue.dueDate ? ` ${shortDay(m.nextDue.dueDate)}` : ''}`
      : null;
    return {
      text: [formatPhp(m.expectedPhp), `${formatPhp(m.collectedPhp)} paid`, next].filter(Boolean).join(' · '),
      tone: 'quiet',
    };
  }
  return { text: 'Settled', tone: 'ok' };
}

/** "Nov 18" — a due day in the row's own short words (the year is the plan's, and the row already names the event's). */
function shortDay(iso: string): string {
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

/* ═══ DATES (S-PR3) ═══════════════════════════════════════════════════════ */

/* Every calendar action's outcome (`DATES_NOTICES`) lives beside the actions now — `calendar/dates-notices.ts`, shared
   with the stay door that says a refusal on the row it was pressed on. */

/** The calendar actions every Dates view hands to its rows (this page names them once). */
const DATES_ACTIONS = {
  removeBlock,
  updateWaitlistSettings,
  pickWaitlistCouple,
  notifyWaitlistSlot,
};

/** The month's own reads — they depend only on the shop and the month, so they start with the list's reads, not after. */
function startMonthReads(
  supabase: Awaited<ReturnType<typeof createClient>>,
  vendorProfileId: string,
  month: string,
  todayIso: string,
) {
  return Promise.all([
    fetchVendorDayStates(supabase, vendorProfileId, `${month}-01`, `${month}-31`),
    // The month's waiting list (its marks) and every date ahead (the Waiting list fold).
    fetchVendorWaitlist(supabase, vendorProfileId, `${month}-01`),
    fetchVendorWaitlist(supabase, vendorProfileId, todayIso),
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
}

/**
 * 📅 THE MONTH ON THE ONE CLIENTS SCREEN (Build 2 row #43a, v113 — was the separate Clients › Dates view, S-PR3).
 *
 * The month is no view of its own any more: it heads Clients, over the tiles and the day-headed list. What Dates read
 * that the list ALREADY reads (pools · bookings · blocks · threads · services · team) is handed in, never read twice; only
 * the month's own five reads (`startMonthReads`) and the asks' event dates are added. Its tools — Not available ·
 * Waiting list · QR codes (`DatesFolds`) — sit at the foot of the screen, unchanged.
 */
async function customersMonth({
  supabase,
  vendorProfileId,
  todayIso,
  month,
  openFold,
  pools,
  bookings,
  blocksRead,
  threads,
  services,
  teamRows,
  reads,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  vendorProfileId: string;
  todayIso: string;
  month: string;
  openFold: string | null;
  pools: Awaited<ReturnType<typeof fetchVendorPools>>;
  bookings: Awaited<ReturnType<typeof fetchVendorPoolBookings>>;
  blocksRead: Awaited<ReturnType<typeof fetchVendorBlocksDetailed>>;
  threads: Awaited<ReturnType<typeof fetchVendorThreadsDetailed>>['threads'];
  services: Awaited<ReturnType<typeof fetchVendorServices>>;
  teamRows: Awaited<ReturnType<typeof fetchVendorTeam>>;
  reads: ReturnType<typeof startMonthReads>;
}) {
  const [dayStates, monthWaitlist, upcomingWaitlist, settingsRead, pickedRead] = await reads;
  const blocks = blocksRead.blocks;
  const blocksIncomplete = !blocksRead.complete;

  // ⚠ THIS ROW CARRIES THEIR PLAN. Refused, nothing below may claim what the plan holds (the Waitlist fold says so).
  if (settingsRead.error) logQueryError('VendorCustomersPage.waitlistSettings', settingsRead.error, { vendorProfileId }, 'graceful_degrade');
  if (pickedRead.error) logQueryError('VendorCustomersPage.waitlistPicked', pickedRead.error, { vendorProfileId }, 'graceful_degrade');
  const settings = (settingsRead.data ?? null) as { waitlist_enabled?: boolean; max_waitlist_acceptances?: number; tier_state?: string | null } | null;
  const tier = settings?.tier_state ?? null;
  // 💳 THE SWITCH. A 0 here is the paywall, asked through the same flag-aware allowance updateWaitlistSettings
  // enforces — off, the entry plan's places. The plan's cap, plus any "+1 wait list" an Ultra shop bought.
  const waitlistTierCap = vendorAllowance(
    (await fetchCapsWithAddOns(supabase, vendorProfileId, tier)).waitlistAcceptances,
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
  const { asks } = await readOpenAsks(threads, bookedEventIds);

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

  return {
    /** The month's props — `CustomersPin` mounts the shipped `CustomersCalendar` with them, on top of the screen. */
    month: {
      initialDayStates: dayStates,
      initialWaitlist: monthWaitlist,
      inquiries: asksByDate(asks),
      initialMonth: month,
      // v113: the one screen opens on its whole list — no day picked until the supplier taps one.
      initialDay: null,
      todayIso,
      pools,
      // Only what the month and the day's rows read — a block's contact and note never cross the wire.
      bookings: datesBookingsForWire(bookings),
      blocks: datesBlocksForWire(blocks),
      agents,
      agentCategories,
      halls: pools.every((p) => p.isHall) && pools.length > 0,
      dayActions: { addManualBlock, removeBlock },
      closuresComplete: !blocksIncomplete,
    },
    /** A status line over the month — a short closures read, or no schedule yet. */
    head: (
      <>
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
      </>
    ),
    /** The month's tools, at the foot of the screen — the same folds Dates drew under its month. */
    folds: (
      // The month's own anchor (`#calendar`) sits on the month itself, in `CustomersPin`.
      <div className="mt-6" data-customers-month-tools="">
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
          qrHref="/vendor-dashboard/invite?mode=locked"
          blockAdd={<BlockDateAdd pools={pools.map((p) => ({ poolId: p.poolId, label: p.label }))} action={addManualBlock} today={todayIso} month={month} />}
          actions={DATES_ACTIONS}
        />
      </div>
    ),
  };
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
    // "Holding this date · N of M" — the plan's ceiling.
    tierCaps((tierProbe.data as { tier_state?: string } | null)?.tier_state ?? null),
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
// its chat full screen). What only it held lives on Events now: archived and closed chats + the won/lost roll-up in
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
  // 🔀 The old `?seg=people` (the first view's address until 2026-10-30) lands on Events — every other param kept.
  const forward = oldPeopleAddressForward(sp);
  if (forward) redirect(forward);
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
          // Events uses the whole width from a tablet up (owner 2026-10-29, "maximize the screen use"); Money keeps its
          // reading measure, Dates its month's.
          className={`mx-auto w-full max-w-3xl space-y-4 px-4 pb-6 pt-4 sm:px-6 lg:px-8 ${seg === 'money' ? 'tab:max-w-3xl' : search.day ? 'tab:max-w-5xl' : 'tab:max-w-none'}`}
          data-customers-seg-open={seg}
        >
          <h1 className="sr-only">Clients</h1>
          {/* 📌 Each view draws its own pinned row, over what it read: Events with its three counts; Dates with the
              month's figures (`CustomersDates`) and Money with Received · To come in · Overdue (`CustomersMoney`) — v13,
              `customers-figures.tsx`. One day (Dates › a day) has its own back-headed sheet instead. */}
          {/* 📅 ONE CLIENTS SCREEN (Build 2 #43a, v113): Events and Dates are no longer two views — `?seg=dates` and the
              plain address both draw the month → tiles → Overdue/Unread → the day-headed list. Only Dates › one day keeps
              its own back-headed sheet (`?seg=dates&day=`). */}
          {seg === 'dates' && /^\d{4}-\d{2}-\d{2}$/.test(search.day ?? '') ? (
            <div className="pb-24">
              <CustomersDay day={search.day as string} search={search} />
            </div>
          ) : seg !== 'money' ? (
            <div className="pb-24">
              <CustomersPipeline search={search} />
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
