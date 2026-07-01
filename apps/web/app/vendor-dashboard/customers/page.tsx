import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ChevronRight, MessageSquare, PhilippinePeso, Sparkles } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { formatPhp, VENDOR_CATEGORY_LABEL } from '@/lib/vendors';
import { countUnreadMessages, fetchVendorThreads } from '@/lib/chat';
import {
  fetchVendorBlocks,
  fetchVendorDayStates,
  fetchVendorPoolBookings,
  fetchVendorPools,
  fetchBookingServiceAgentMeta,
} from '@/lib/vendor-schedule';
import { fetchVendorWaitlist } from '@/lib/vendor-waitlist';
import { fetchVendorServices } from '@/lib/vendor-services';
import { fetchVendorTeam, enrichTeamWithUsers } from '@/lib/vendor-team';
import { manilaTodayIso, type PaydayInstallmentRow } from '@/lib/vendor-cashflow';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  buildCustomerCalendarMonth,
  buildMonthDemandHeat,
  summarizeMonthlyPayments,
  computeEventMoneyPositions,
  type BookingMeta,
  type CustomerStatus,
  type EventMoneyPosition,
} from '@/lib/vendor-customers';
import { CustomersClient, type CustomerRowVM } from './_components/customers-client';
import type { FilterOption } from './_components/customers-filter-bar';

export const metadata = { title: 'My Customers · Vendor · Setnayan' };

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
 *      status.
 *   4. Customers list — one row per booked / in-conversation event with a status
 *      pill + a money note.
 *
 * Every number resolves from a real query/RPC. Where a value has no source yet
 * (e.g. the couple's venue when they haven't set one) the row degrades to a
 * clearly-empty state rather than inventing a value.
 */

type Props = { searchParams: Promise<{ m?: string }> };

function monthLabelOf(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y ?? 2026, (m ?? 1) - 1, 1).toLocaleDateString('en-PH', {
    month: 'long',
    year: 'numeric',
  });
}

function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y ?? 2026, (m ?? 1) - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function categoryLabel(key: string): string {
  return (VENDOR_CATEGORY_LABEL as Record<string, string>)[key] ?? key.replace(/_/g, ' ');
}

/**
 * Human label for a day/customer STATE value — the "All types" filter now keys
 * off booking state (not event type). Kept in sync with the calendar/list chip
 * copy: 'in_conversation' surfaces as "Scheduled".
 */
const STATE_LABEL: Record<string, string> = {
  full: 'Full',
  booked: 'Booked',
  locked: 'Locked',
  whitelist: 'Whitelist',
  blocked: 'Blocked',
  waitlist: 'Waitlist',
  in_conversation: 'Scheduled',
};

/** Canonical display order for the state-type filter options. */
const STATE_ORDER = [
  'full',
  'booked',
  'locked',
  'whitelist',
  'blocked',
  'waitlist',
  'in_conversation',
];

export default async function VendorCustomersPage({ searchParams }: Props) {
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
    demandRes,
  ] = await Promise.all([
    fetchVendorPools(supabase, vendorProfileId),
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
    // Demand Radar buckets (de-identified, min-N gated in SQL) — the source for
    // the Heat map overlay. Errors degrade to no overlay.
    supabase.rpc('demand_radar_for_vendor', { p_vendor_profile_id: vendorProfileId }),
  ]);

  const paydayRows = (
    paydayRes.error ? [] : ((paydayRes.data ?? []) as unknown as PaydayInstallmentRow[])
  );

  // Resolve each booking's leaf service category + assigned agents — the filter
  // index for "All services" / "All agents". Keyed by pool_booking_id.
  const bookingMetaById = await fetchBookingServiceAgentMeta(supabase, bookings);
  // The lib module's BookingMeta is structurally identical; reuse the map.
  const calendarMeta: Map<string, BookingMeta> = bookingMetaById;

  // ── Section 2: month calendar ────────────────────────────────────────────
  const calendar = buildCustomerCalendarMonth(
    pools,
    bookings,
    blocks,
    dayStates,
    waitlist,
    month,
    todayIso,
    calendarMeta,
  );

  // ── Heat map: Demand Radar intensity for the visible month, by event type ──
  const demandBuckets = (
    demandRes.error || !Array.isArray(demandRes.data) ? [] : demandRes.data
  ) as {
    month_bucket: string;
    event_type: string;
    inquiry_count: number;
    unlock_count: number;
    booking_count: number;
  }[];
  const demandHeat = buildMonthDemandHeat(demandBuckets, month);

  // ── Section 3a: this-month payments roll-up ──────────────────────────────
  const payments = summarizeMonthlyPayments(paydayRows, month);
  const collectPct =
    payments.expectedPhp > 0
      ? Math.min(100, Math.round((payments.collectedPhp / payments.expectedPhp) * 100))
      : 0;

  // ── Section 3b: messages ─────────────────────────────────────────────────
  const conversationCount = threads.length;

  // ── Section 3c: service status ───────────────────────────────────────────
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
  const serviceStatus = activeServices.slice(0, 3).map((s) => {
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

  // ── Section 4: customers list ────────────────────────────────────────────
  const moneyByEvent = computeEventMoneyPositions(paydayRows);

  // Per-event filter index: aggregate each event's booked service categories +
  // assigned agent member-ids from the resolved per-booking metadata.
  const categoriesByEvent = new Map<string, Set<string>>();
  const agentsByEvent = new Map<string, Set<string>>();
  for (const b of bookings) {
    const meta = bookingMetaById.get(b.poolBookingId);
    if (!meta) continue;
    if (meta.category) {
      const cats = categoriesByEvent.get(b.eventId) ?? new Set<string>();
      cats.add(meta.category);
      categoriesByEvent.set(b.eventId, cats);
    }
    if (meta.agentMemberIds.length > 0) {
      const agents = agentsByEvent.get(b.eventId) ?? new Set<string>();
      for (const id of meta.agentMemberIds) agents.add(id);
      agentsByEvent.set(b.eventId, agents);
    }
  }

  // Booked events (live pool reservations) grouped by event.
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

  // Enrich booked events with date + venue (place) via the admin client — the
  // vendor is party to the booking but holds no events RLS (same pattern as
  // fetchVendorPoolBookings' name lookup). Request-local map (never module
  // state) so concurrent requests never bleed venues into each other.
  const venueByEvent = new Map<string, string | null>();
  const bookedEventIds = [...bookedByEvent.keys()];
  if (bookedEventIds.length > 0) {
    const admin = createAdminClient();
    const { data: eventRows } = await admin
      .from('events')
      .select('event_id, event_date, venue_name')
      .in('event_id', bookedEventIds);
    for (const e of (eventRows ?? []) as {
      event_id: string;
      event_date: string | null;
      venue_name: string | null;
    }[]) {
      const g = bookedByEvent.get(e.event_id);
      if (g) g.eventDate = e.event_date;
      venueByEvent.set(e.event_id, e.venue_name);
    }
  }

  const rows: CustomerRowVM[] = [];
  for (const [eventId, g] of bookedByEvent) {
    const money = moneyByEvent.get(eventId) ?? null;
    rows.push({
      eventId,
      eventName: g.eventName,
      eventDate: g.eventDate,
      place: venueByEvent.get(eventId) ?? null,
      status: 'booked',
      threadId: g.threadId,
      serviceCategories: [...(categoriesByEvent.get(eventId) ?? [])],
      agentMemberIds: [...(agentsByEvent.get(eventId) ?? [])],
      note: moneyNote('booked', money),
    });
  }

  // In-conversation events — accepted threads without a live booking.
  for (const t of threads) {
    if (t.inquiry_status !== 'accepted') continue;
    if (bookedByEvent.has(t.event_id)) continue;
    rows.push({
      eventId: t.event_id,
      eventName: t.event?.display_name ?? 'A Setnayan event',
      eventDate: t.event?.event_date ?? null,
      place: null,
      status: 'in_conversation',
      threadId: t.thread_id,
      serviceCategories: [],
      agentMemberIds: [],
      note: moneyNote('in_conversation', moneyByEvent.get(t.event_id) ?? null),
    });
  }

  // Sort: soonest event date first, undated last.
  rows.sort((a, b) => {
    if (a.eventDate && b.eventDate) return a.eventDate.localeCompare(b.eventDate);
    if (a.eventDate) return -1;
    if (b.eventDate) return 1;
    return a.eventName.localeCompare(b.eventName);
  });

  // ── Filter option sets (all LIVE, all functional) ────────────────────────
  // "All types" = the booking/day STATE, sourced from what actually appears in
  // this vendor's data (calendar day states + customer statuses) — no invented
  // state is ever offered.
  const presentStates = new Set<string>();
  for (const d of calendar.days) if (d.state) presentStates.add(d.state);
  for (const r of rows) presentStates.add(r.status);
  const typeOptions: FilterOption[] = STATE_ORDER.filter((s) =>
    presentStates.has(s),
  ).map((s) => ({ value: s, label: STATE_LABEL[s] ?? s }));

  // "All services" = the vendor's leaf service CATEGORIES (distinct taxonomy
  // leaves of their vendor_services).
  const serviceOptions: FilterOption[] = [
    ...new Map(
      services.map((s) => [
        s.category,
        { value: s.category, label: categoryLabel(s.category) } as FilterOption,
      ]),
    ).values(),
  ];

  // "All agents" = team-member NAMES (never raw emails). Names come from
  // users.display_name (owner-only RLS → admin client). Last-resort fallback is
  // the local-part of the email or the team label — never the full email.
  let agentOptions: FilterOption[] = [];
  if (teamRows.length > 0) {
    try {
      const teamWithUser = await enrichTeamWithUsers(createAdminClient(), teamRows);
      agentOptions = teamWithUser.map((m) => ({
        value: m.vendor_team_member_id,
        label:
          m.display_name?.trim() ||
          m.team_label?.trim() ||
          (m.email ? m.email.split('@')[0]! : '') ||
          'Team member',
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
    <section
      className="min-h-full"
      style={{ background: 'var(--m-paper)' }}
    >
      <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <header className="space-y-2">
          <h1
            className="text-3xl font-semibold tracking-tight sm:text-4xl"
            style={{ color: 'var(--m-ink)' }}
          >
            My Customers
          </h1>
          <p className="max-w-prose text-base" style={{ color: 'var(--m-slate)' }}>
            Your calendar, book of business, and money in.
          </p>
        </header>

        {/*
          Sections 1+2+3+4 — the filter row + calendar + summary cards + list
          live inside one client island so the three filters (state / service /
          agent) and the Heat map toggle drive BOTH the calendar AND the list
          from a single source of state. The summary cards (month-level roll-ups)
          are slotted through unfiltered.
        */}
        <CustomersClient
          calendar={calendar}
          rows={rows}
          monthLabel={monthLabelOf(month)}
          prevHref={`/vendor-dashboard/customers?m=${shiftMonth(month, -1)}`}
          nextHref={`/vendor-dashboard/customers?m=${shiftMonth(month, 1)}`}
          dayHrefBase={dayHrefBase}
          typeOptions={typeOptions}
          serviceOptions={serviceOptions}
          agentOptions={agentOptions}
          demandHeat={demandHeat}
          summaryCards={
            <div className="grid gap-4 md:grid-cols-3">
          {/* Ongoing payments */}
          <article
            className="rounded-xl border p-4"
            style={{ borderColor: 'var(--m-line)', background: '#fff' }}
          >
            <div className="flex items-center gap-2">
              <span
                aria-hidden
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg"
                style={{ background: 'rgba(79,107,74,0.12)', color: 'var(--m-sage-deep)' }}
              >
                <PhilippinePeso className="h-4 w-4" strokeWidth={1.75} />
              </span>
              <h3 className="text-sm font-semibold" style={{ color: 'var(--m-ink)' }}>
                Ongoing payments
              </h3>
            </div>
            {payments.isEmpty ? (
              <p className="mt-3 text-sm" style={{ color: 'var(--m-slate-2)' }}>
                No payments expected this month. Amounts appear here once a couple
                books you on a service with a payment schedule.
              </p>
            ) : (
              <>
                <p className="mt-3 text-2xl font-semibold tracking-tight" style={{ color: 'var(--m-ink)' }}>
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
                {payments.unresolvedCount > 0 ? (
                  <p className="mt-2 text-[11px]" style={{ color: 'var(--m-slate-3)' }}>
                    {payments.unresolvedCount} installment
                    {payments.unresolvedCount === 1 ? '' : 's'} this month has no set
                    amount yet.
                  </p>
                ) : null}
              </>
            )}
            <Link
              href="/vendor-dashboard/payday"
              className="mt-3 inline-flex items-center gap-1 text-sm font-medium"
              style={{ color: 'var(--m-orange-2)' }}
            >
              Payday <ChevronRight className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            </Link>
          </article>

          {/* Messages */}
          <article
            className="rounded-xl border p-4"
            style={{ borderColor: 'var(--m-line)', background: '#fff' }}
          >
            <div className="flex items-center gap-2">
              <span
                aria-hidden
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg"
                style={{ background: 'var(--m-orange-4)', color: 'var(--m-orange-2)' }}
              >
                <MessageSquare className="h-4 w-4" strokeWidth={1.75} />
              </span>
              <h3 className="text-sm font-semibold" style={{ color: 'var(--m-ink)' }}>
                Messages
              </h3>
            </div>
            <p className="mt-3 text-2xl font-semibold tracking-tight" style={{ color: 'var(--m-ink)' }}>
              {unreadCount}{' '}
              <span className="text-base font-normal" style={{ color: 'var(--m-slate-2)' }}>
                new
              </span>
            </p>
            <p className="mt-1 text-xs" style={{ color: 'var(--m-slate-2)' }}>
              {conversationCount} conversation{conversationCount === 1 ? '' : 's'}
            </p>
            <Link
              href="/vendor-dashboard/messages"
              className="mt-3 inline-flex items-center gap-1 text-sm font-medium"
              style={{ color: 'var(--m-orange-2)' }}
            >
              Open messages{' '}
              <ChevronRight className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            </Link>
          </article>

          {/* Service status */}
          <article
            className="rounded-xl border p-4"
            style={{ borderColor: 'var(--m-line)', background: '#fff' }}
          >
            <div className="flex items-center gap-2">
              <span
                aria-hidden
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg"
                style={{ background: 'var(--m-orange-4)', color: 'var(--m-orange-2)' }}
              >
                <Sparkles className="h-4 w-4" strokeWidth={1.75} />
              </span>
              <h3 className="text-sm font-semibold" style={{ color: 'var(--m-ink)' }}>
                Service status
              </h3>
            </div>
            {serviceStatus.length === 0 ? (
              <p className="mt-3 text-sm" style={{ color: 'var(--m-slate-2)' }}>
                No live services yet. Post a service so couples can find and book you.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {serviceStatus.map((s) => (
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
                        Active
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
          }
        />
      </div>
    </section>
  );
}

/** The right-aligned money note for a customer row (status + money position). */
function moneyNote(
  status: CustomerStatus,
  m: EventMoneyPosition | null,
): { text: string; tone: string } {
  if (status === 'in_conversation') {
    return { text: 'Quote pending', tone: 'var(--m-slate-2)' };
  }
  if (!m || m.allUnresolved || m.installmentCount === 0) {
    // Booked but no resolvable installment plan yet.
    return { text: 'Downpayment in', tone: 'var(--m-slate-2)' };
  }
  if (m.fullyPaid) {
    return { text: 'Fully paid', tone: 'var(--m-sage-deep)' };
  }
  if (m.balancePhp > 0) {
    return { text: `Balance ${formatPhp(m.balancePhp)}`, tone: 'var(--m-ink)' };
  }
  return { text: 'Downpayment in', tone: 'var(--m-slate-2)' };
}
