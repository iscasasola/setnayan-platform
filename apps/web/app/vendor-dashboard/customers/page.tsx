import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CalendarDays, ChevronRight, MessageSquare, PhilippinePeso, Sparkles } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { formatPhp, VENDOR_CATEGORY_LABEL } from '@/lib/vendors';
import { countUnreadMessages, fetchVendorThreads } from '@/lib/chat';
import {
  fetchVendorBlocks,
  fetchVendorDayStates,
  fetchVendorPoolBookings,
  fetchVendorPools,
} from '@/lib/vendor-schedule';
import { fetchVendorWaitlist } from '@/lib/vendor-waitlist';
import { fetchVendorServices } from '@/lib/vendor-services';
import { fetchVendorTeam, enrichTeamWithUsers } from '@/lib/vendor-team';
import { manilaTodayIso, type PaydayInstallmentRow } from '@/lib/vendor-cashflow';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  buildCustomerCalendarMonth,
  summarizeMonthlyPayments,
  computeEventMoneyPositions,
  type CustomerRow,
  type CustomerStatus,
} from '@/lib/vendor-customers';
import { CustomersCalendar } from './_components/customers-calendar';
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
 *      coverage.
 *   4. Customers list — one row per booked / in-conversation event with a status
 *      pill + a money note.
 *
 * Every number resolves from a real query/RPC. Where a value has no source yet
 * (e.g. the couple's venue when they haven't set one) the row degrades to a
 * clearly-empty state rather than inventing a value.
 */

type Props = { searchParams: Promise<{ m?: string }> };

function fmtDate(iso: string | null): string {
  if (!iso) return 'Date not set';
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'SN';
  if (words.length === 1) return (words[0]!.slice(0, 2) || 'SN').toUpperCase();
  return (words[0]![0]! + words[1]![0]!).toUpperCase();
}

const STATUS_PILL: Record<
  CustomerStatus,
  { label: string; bg: string; fg: string; border: string }
> = {
  booked: {
    label: 'Booked',
    bg: 'rgba(79,107,74,0.12)',
    fg: 'var(--m-sage-deep)',
    border: 'rgba(79,107,74,0.28)',
  },
  locked: {
    label: 'Locked',
    bg: 'var(--m-orange-4)',
    fg: 'var(--m-orange-2)',
    border: 'var(--m-orange-3)',
  },
  whitelist: {
    label: 'Whitelist',
    bg: 'rgba(139,123,184,0.12)',
    fg: '#6D5C9C',
    border: 'rgba(139,123,184,0.30)',
  },
  waitlist: {
    label: 'Waitlist',
    bg: 'rgba(184,134,47,0.12)',
    fg: '#946A17',
    border: 'rgba(184,134,47,0.28)',
  },
  in_conversation: {
    label: 'In conversation',
    bg: 'var(--m-paper-2)',
    fg: 'var(--m-slate)',
    border: 'var(--m-line)',
  },
};

function categoryLabel(key: string): string {
  return (VENDOR_CATEGORY_LABEL as Record<string, string>)[key] ?? key.replace(/_/g, ' ');
}

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
  ]);

  const paydayRows = (
    paydayRes.error ? [] : ((paydayRes.data ?? []) as unknown as PaydayInstallmentRow[])
  );

  // ── Section 2: month calendar ────────────────────────────────────────────
  const calendar = buildCustomerCalendarMonth(
    pools,
    bookings,
    blocks,
    dayStates,
    waitlist,
    month,
    todayIso,
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

  // ── Section 4: customers list ────────────────────────────────────────────
  const moneyByEvent = computeEventMoneyPositions(paydayRows);

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
  // event_type per booked event — feeds the calendar's Type filter (bookings
  // themselves carry no event_type). Same admin lookup, one extra column.
  const eventTypeByEvent = new Map<string, string | null>();
  const bookedEventIds = [...bookedByEvent.keys()];
  if (bookedEventIds.length > 0) {
    const admin = createAdminClient();
    const { data: eventRows } = await admin
      .from('events')
      .select('event_id, event_date, venue_name, event_type')
      .in('event_id', bookedEventIds);
    for (const e of (eventRows ?? []) as {
      event_id: string;
      event_date: string | null;
      venue_name: string | null;
      event_type: string | null;
    }[]) {
      const g = bookedByEvent.get(e.event_id);
      if (g) g.eventDate = e.event_date;
      venueByEvent.set(e.event_id, e.venue_name);
      eventTypeByEvent.set(e.event_id, e.event_type);
    }
  }

  const rows: CustomerRow[] = [];
  for (const [eventId, g] of bookedByEvent) {
    rows.push({
      eventId,
      eventName: g.eventName,
      eventDate: g.eventDate,
      place: venueByEvent.get(eventId) ?? null,
      status: 'booked',
      threadId: g.threadId,
      money: moneyByEvent.get(eventId) ?? null,
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
      money: moneyByEvent.get(t.event_id) ?? null,
    });
  }

  // Sort: soonest event date first, undated last.
  rows.sort((a, b) => {
    if (a.eventDate && b.eventDate) return a.eventDate.localeCompare(b.eventDate);
    if (a.eventDate) return -1;
    if (b.eventDate) return 1;
    return a.eventName.localeCompare(b.eventName);
  });

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
    <section
      className="min-h-full"
      style={{ background: 'var(--m-paper)' }}
    >
      <div className="mx-auto w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl space-y-6 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        {/* Sections 1 + 2 — filter row + month calendar (centrepiece). */}
        <CustomersCalendar
          initialDayStates={dayStates}
          initialWaitlist={waitlist}
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
        />

        {/* Section 3 — three summary cards. */}
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
                No installments due this month. Amounts appear here once a couple
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

          {/* Service coverage */}
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
                Service coverage
              </h3>
            </div>
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

        {/* Section 4 — customers list. */}
        <div
          className="rounded-xl border"
          style={{ borderColor: 'var(--m-line)', background: '#fff' }}
        >
          <div
            className="flex items-center justify-between gap-2 border-b px-4 py-3"
            style={{ borderColor: 'var(--m-line)' }}
          >
            <h2 className="text-base font-semibold" style={{ color: 'var(--m-ink)' }}>
              Customers
            </h2>
            <Link
              href="/vendor-dashboard/clients"
              className="inline-flex items-center gap-1 text-sm font-medium"
              style={{ color: 'var(--m-orange-2)' }}
            >
              <CalendarDays className="h-4 w-4" strokeWidth={1.75} aria-hidden />
              Book of business
            </Link>
          </div>
          {rows.length === 0 ? (
            <p className="px-4 py-8 text-sm" style={{ color: 'var(--m-slate-2)' }}>
              No customers yet. When a couple books you, or you accept an inquiry,
              they show up here with their event, date, and where they&rsquo;re at
              with payments.
            </p>
          ) : (
            <ul className="divide-y" style={{ borderColor: 'var(--m-line)' }}>
              {rows.map((r) => {
                const pill = STATUS_PILL[r.status];
                const note = moneyNote(r);
                const inner = (
                  <>
                    <span
                      aria-hidden
                      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
                      style={{ background: 'var(--m-orange-4)', color: 'var(--m-orange-2)' }}
                    >
                      {initialsOf(r.eventName)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-medium" style={{ color: 'var(--m-ink)' }}>
                          {r.eventName}
                        </span>
                        <span
                          className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
                          style={{ background: pill.bg, color: pill.fg, border: `1px solid ${pill.border}` }}
                        >
                          {pill.label}
                        </span>
                      </span>
                      <span className="mt-0.5 block truncate text-xs" style={{ color: 'var(--m-slate-2)' }}>
                        {fmtDate(r.eventDate)}
                        {r.place ? ` · ${r.place}` : ''}
                      </span>
                    </span>
                    <span className="shrink-0 text-right text-xs" style={{ color: note.tone }}>
                      {note.text}
                    </span>
                  </>
                );
                return (
                  <li key={`${r.status}:${r.eventId}`}>
                    {r.threadId ? (
                      <Link
                        href={`/vendor-dashboard/messages/${r.threadId}`}
                        className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--m-paper-2)]"
                      >
                        {inner}
                      </Link>
                    ) : (
                      <div className="flex items-center gap-3 px-4 py-3">{inner}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

/** The right-aligned money note for a customer row. */
function moneyNote(r: CustomerRow): { text: string; tone: string } {
  if (r.status === 'in_conversation') {
    return { text: 'Quote pending', tone: 'var(--m-slate-2)' };
  }
  const m = r.money;
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
