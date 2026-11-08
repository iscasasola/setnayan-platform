/**
 * /dev/clients-lab — L2's proof lab (THE ONE BUILD, 2026-11-08): the supplier's Clients list and the picked client on
 * fixture data, no sign-in, no database. DEV-ONLY: production builds 404 this route, the same kill-switch as every
 * `/dev/*` lab. It draws the REAL components, so what it shows is what ships; only the data is a fixture.
 *
 *   ?v=events                 Clients › Events (v113 `Clients`): the tiles Booked · Schedules · Asked · To collect, the
 *                             Overdue (n) › · Unread (n) › buttons, and the thumb row's ⇅ Show & sort (tap it for the
 *                             sheet — Service · Status · Client · Handled by · Group by · Sort).
 *     &show=overdue|unread|schedules|collect   that list open, in place ("Viewing all …").
 *     &agent=1                  the sheet as a seat sees it ("Your clients only").
 *   ?v=pick&page=details      the picked client (`PickedClientShell`) on its Details page, v113 order: numbers · Hosts ·
 *                             the brief · Suppliers on this event · Decisions (Build 2 #42: the list, v118's five rows) ·
 *                             Forms sent.
 *     &decisions=none|partial   Decisions empty · a refused card read said in one line.
 *   ?v=pick&page=schedule     its Schedule page: the Clients month itself (`ScheduleCalendar` → `CustomersCalendar`
 *                             place="schedule", lab inputs, no request), then the supplier's part in v113 order.
 *     &cal=fail                 the month's one read refused — said, never an empty month.
 *
 * 📅 Build 2 #43 (B2-A): `?v=events` is the ONE Clients screen — "Clients · 4 booked · ₱18,000 to collect · ⚙", the
 * month (the shipped `CustomersCalendar`, lab inputs, no request), the tiles as their own row, Overdue / Unread, then
 * the day-headed list ("SUN 8 NOV"). Tap a day for its head, the day bar and its rows; × lets it go.
 *
 * Every action here is a stand-in that writes nothing.
 */
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { CustomersPin, type CustomersDoor, type CustomersQuick } from '@/app/vendor-dashboard/customers/_components/customers-pin';
import { MeetingsList, PaymentsList, UnreadList } from '@/app/vendor-dashboard/customers/_components/clients-tile-lists';
import { ClientsShowSort } from '@/app/vendor-dashboard/customers/_components/clients-show-sort';
import { DatesRow } from '@/app/vendor-dashboard/customers/_components/dates-row';
import { clientsChoiceOf } from '@/app/vendor-dashboard/customers/clients-show-sort';
import type { ClientMeeting } from '@/app/vendor-dashboard/customers/clients-tiles';
import { ThumbRow } from '@/components/thumb-row';
import { ActionButton } from '@/components/action-button';
import { Plus, Settings } from 'lucide-react';
import { SearchBox } from '@/app/_components/search-box';
import { dayHeadWords } from '@/lib/vendor-dates';
import { PickedClientShell } from '@/app/vendor-dashboard/clients/[eventId]/_components/picked-client-shell';
import { pickedMenuFor, type PickedClientPage } from '@/app/vendor-dashboard/clients/[eventId]/_components/picked-client-menu';
import { clientLandingPage } from '@/lib/upcoming-schedule-door';
import { DetailsNumbersRow } from '@/app/vendor-dashboard/clients/[eventId]/_components/details-numbers-row';
import { detailsNumbers } from '@/app/vendor-dashboard/clients/[eventId]/_components/details-numbers';
import { HostsList } from '@/app/vendor-dashboard/clients/[eventId]/_components/hosts-list';
import { hostRows } from '@/app/vendor-dashboard/clients/[eventId]/_components/hosts-rows';
import { SuppliersList } from '@/app/vendor-dashboard/clients/[eventId]/_components/suppliers-list';
import { supplierRows } from '@/app/vendor-dashboard/clients/[eventId]/_components/suppliers-rows';
import { LabDetailsDecisions } from './lab-decisions';
import { DetailsFormsDoor } from '@/app/vendor-dashboard/clients/[eventId]/_components/details-forms-door';
import { ScheduleCalendar } from '@/app/vendor-dashboard/clients/[eventId]/_components/schedule-calendar';
import { SupplierSchedule } from '@/app/vendor-dashboard/clients/[eventId]/_components/supplier-schedule';
import { buildSupplierDay, type SupplierBlockRow } from '@/lib/supplier-schedule';
import { supplierOwnWhere, whereChaptersFrom } from '@/lib/supplier-where';
import type { ScheduleAsk } from '@/lib/schedule-ask';
import type { MoneyRow } from '@/lib/vendor-money';
import { LAB_CALENDAR, LAB_TODAY } from './lab-calendar';
import { BookedQrsList, type BookedQrRow } from '@/app/vendor-dashboard/invite/_components/booked-qrs-list';
import { LockedQrGenerator, type LockedQrInitial } from '@/app/vendor-dashboard/invite/_components/locked-qr-generator';

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const peso = (php: number) => `₱${php.toLocaleString('en-PH')}`;

// ── The v113 fixture shop: four booked clients, three asking ─────────────────────────────────────────────────────────
const CLIENTS = [
  { key: 'ev-reyes', label: 'Reyes & Santos wedding' },
  { key: 'ev-villa', label: 'Villanueva debut' },
  { key: 'ev-lim', label: 'Lim christening' },
  { key: 'ev-garcia', label: 'Garcia corporate party' },
];
const MEETINGS: ClientMeeting[] = [
  { appointmentId: 'ap1', eventId: 'ev-reyes', label: 'Ocular visit', scheduledAt: '2026-11-08T02:00:00.000Z', status: 'confirmed' },
  { appointmentId: 'ap2', eventId: 'ev-garcia', label: 'Food tasting', scheduledAt: '2026-11-12T06:00:00.000Z', status: 'proposed' },
  { appointmentId: 'ap3', eventId: 'ev-lim', label: 'Call about the venue', scheduledAt: null, status: 'proposed' },
];
const MONEY: MoneyRow[] = [
  { key: 'm1', eventId: 'ev-reyes', title: 'Reyes & Santos wedding', line: 'Final payment · due today', amountPhp: 8000, badge: { tone: 'wait', word: 'Due today' } },
  { key: 'm2', eventId: 'ev-lim', title: 'Lim christening', line: 'First payment · due 1 Nov', amountPhp: 5000, badge: { tone: 'no', word: 'Overdue' } },
  { key: 'm3', eventId: 'ev-villa', title: 'Villanueva debut', line: 'Balance · due 30 Oct', amountPhp: 5000, badge: { tone: 'no', word: 'Overdue' } },
];
const UNREAD = [
  { eventId: 'ev-reyes', title: 'Reyes & Santos wedding', threadId: 't-reyes' },
  { eventId: 'ev-garcia', title: 'Garcia corporate party', threadId: 't-garcia' },
];
const DAYS = ['2026-11-08', '2026-11-08', '2026-11-10', '2026-11-12'];
/** The list stand-in, day-headed the way `CustomersRoster` heads a Day group (same classes, same `dayHeadWords`). */
const ROSTER = (lane: string) =>
  CLIENTS.map((c, i) => (
    <div key={`${lane}-${c.key}`}>
      {i === 0 || DAYS[i - 1] !== DAYS[i] ? (
        <p
          className="sticky z-[3] -mx-4 my-0 flex min-h-10 items-center px-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink/60 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
          style={{ top: 'var(--sn-pin-h)', background: 'var(--sn-canvas)' }}
          data-customers-group-heading={DAYS[i]}
        >
          {dayHeadWords(DAYS[i]!, LAB_TODAY)}
        </p>
      ) : null}
      {/* #38: each row lands where the one open path sends that kind — Booked → Details, Asking → Chat. */}
      <DatesRow
        data="booking"
        title={c.label}
        line={['8 Nov · Booked', '8 Nov · Booked', '10 Nov · Booked', '12 Nov · Asked'][i]}
        href={`/dev/clients-lab?v=pick&page=${clientLandingPage(i === 3 ? { asking: true, hasChat: true } : { booked: true, hasChat: true })}`}
      />
    </div>
  ));

// ── The picked client: Reyes & Santos, booked, 8 Nov ────────────────────────────────────────────────────────────────
const ME = 'ev-me';
const T = (hhmm: string, day = '2026-11-08') => `${day}T${hhmm}:00.000Z`;
const row = (b: Partial<SupplierBlockRow> & Pick<SupplierBlockRow, 'block_id' | 'label'>): SupplierBlockRow => ({
  parent_block_id: null,
  start_at: null,
  end_at: null,
  location: 'Taal Vista Hotel',
  spot: null,
  time_tba: false,
  is_optional: false,
  responsible_vendor_ids: [ME],
  created_at: T('00:00', '2026-11-01'),
  updated_at: T('00:00', '2026-11-01'),
  ...b,
});
const BLOCKS: SupplierBlockRow[] = [
  row({ block_id: 'prep', label: 'Preparation · Bride', start_at: T('05:00'), end_at: T('06:30'), spot: 'Suite 1201' }),
  row({ block_id: 'cer', label: 'Ceremony', start_at: T('06:30'), end_at: T('08:00'), spot: 'Garden' }),
  row({ block_id: 'c1', parent_block_id: 'cer', label: 'Entourage photos', start_at: T('06:00'), end_at: T('06:30') }),
  row({ block_id: 'rec', label: 'Reception', start_at: T('09:30'), end_at: T('13:00'), spot: 'Ballroom' }),
];
const ASKED: ScheduleAsk[] = [
  { suggestion_id: 'ask1', block_id: 'c1', vendor_profile_id: 'vp-lab', suggested_by_name: 'Maria', asked_as: 'host', proposed_start_at: T('05:30'), proposed_end_at: T('06:00'), note: 'Arrive 30 min early · entourage photos', status: 'open', answer_note: null, created_at: T('00:00', '2026-11-05') },
];

function pickedBodies(
  page: PickedClientPage,
  calFail: boolean,
  decisions: 'full' | 'none' | 'partial' = 'full',
): Record<PickedClientPage, ReactNode> {
  const day = buildSupplierDay({ blocks: BLOCKS, myBookingIds: [ME], venueBookingIds: [], tasks: [], requests: [] });
  const where = supplierOwnWhere({
    bookings: [{ vendorId: ME, category: 'photographer', status: 'contracted', label: 'Lumina Studio' }],
    chapters: whereChaptersFrom(BLOCKS.filter((b) => !b.parent_block_id).map((b) => ({ ...b, block_type: null }))),
    requests: [],
    tradeDefault: () => ['prep', 'cer'],
  });
  const later = (what: string) => <p className="py-6 text-[14px] text-ink/60">{what} — not part of this lab.</p>;
  return {
    details: (
      <div className="space-y-4" data-details-shipped="">
        <DetailsNumbersRow
          cells={detailsNumbers({ isBooked: true, todayIso: LAB_TODAY, eventDate: '2026-11-08', ledger: { receivedPhp: 30000, expectedPhp: 38000 }, onPlan: false, sentQuotePhp: undefined, peso })}
        />
        <HostsList
          hosts={hostRows([
            { user_id: 'u1', first_name: 'Maria', name: 'Maria Reyes', role: 'bride', label: null },
            { user_id: 'u2', first_name: 'Jose', name: 'Jose Santos', role: 'groom', label: null },
            { user_id: 'u3', first_name: 'Ana', name: 'Ana Cruz', role: null, label: 'Coordinator' },
          ])}
        />
        <section className="space-y-1" data-lab-stand-in="brief">
          <p className="home-k2 pb-1">Details</p>
          <p className="text-[14px] text-ink">Sun 8 Nov 2026 · Taal Vista Hotel, Tagaytay · 150 guests</p>
          <p className="text-[12px] text-ink/55">(the brief — a lab stand-in for the shipped overview)</p>
        </section>
        <SuppliersList
          rows={supplierRows([
            { vendor_name: 'Bloom & Co', category: 'florist' },
            { vendor_name: 'Araw Planners', category: 'coordinator' },
            { vendor_name: 'Kusina ni Lola', category: 'caterer' },
          ])}
        />
        <LabDetailsDecisions mode={decisions} />
        <DetailsFormsDoor />
      </div>
    ),
    schedule: (
      <>
        <ScheduleCalendar eventDate="2026-11-08" todayIso={LAB_TODAY} lab={calFail ? null : LAB_CALENDAR} />
        <div className="mt-4">
          <SupplierSchedule
            eventId="lab"
            lab
            day={day}
            autoAgree={false}
            marks={{ seenAt: T('12:00', '2026-11-07'), confirmedAt: null, lockedAt: null }}
            changed={false}
            finalWeek={false}
            tasksRead
            answered={[]}
            asked={ASKED}
            elsewhere={{}}
            where={where}
          />
        </div>
      </>
    ),
    chat: later('Chat'),
    quote: later('Quotation'),
    payments: later('Payment'),
    forms: later('Forms'),
    files: later('Files'),
    hub: later('Hub'),
    report: later('Report'),
  };
}

/** #34 lab rows — one per group. */
const LAB_BOOKED_QRS: BookedQrRow[] = [
  { token: 'a1b2c3d4e5f60718', title: 'Full-day coverage', line: 'Sat 19 Dec · ₱80,000 · ₱20,000 paid · made today', status: 'pending', openHref: '/dev/clients-lab?v=booked' },
  { token: 'b1b2c3d4e5f60718', title: 'Same-day edit', line: 'Sun 10 Jan · ₱15,000 · ₱5,000 paid · used 2 Nov', status: 'claimed', openHref: '/dev/clients-lab?v=pick&page=details' },
  { token: 'c1b2c3d4e5f60718', title: 'Prenup shoot', line: 'Sat 6 Feb · ₱30,000 · ₱10,000 paid · deleted 1 Nov', status: 'void', openHref: null },
];
const LAB_BOOKED_CHANGE: LockedQrInitial = {
  replaces: 'a1b2c3d4e5f60718',
  eventType: 'wedding',
  eventDate: '2026-12-19',
  description: 'Full-day coverage, two shooters',
  serviceRefs: ['svc-full', 'svc-sde'],
  contractId: '',
  total: '80000',
  initialPaid: '20000',
  schedule: [
    { label: 'First payment', amount: '20000', date: '2026-11-08' },
    { label: 'Balance', amount: '60000', date: '2026-12-12' },
  ],
  lines: [
    { label: 'Full-day coverage', detail: null, amount_centavos: 6_500_000 },
    { label: 'Same-day edit', detail: null, amount_centavos: 1_500_000 },
  ],
  proofRef: '',
  remembranceRef: '',
};

/**
 * #29 The lab's stand-ins for the day bar's two writes: they write NOTHING (no database) and answer, so "Accept
 * bookings" can be flipped and felt on a dummy env. `?refuse=1` hands the refusing one instead — the switch puts itself
 * back and the calendar drops its overlay. Not exported, so no route and no server-action budget.
 */
async function labDayWrite(): Promise<void> {
  'use server';
  if (process.env.NODE_ENV === 'production') throw new Error('clients-lab: not in production');
}
async function labDayRefused(): Promise<void> {
  'use server';
  throw new Error('clients-lab: refused on purpose');
}

export default async function ClientsLabPage({ searchParams }: Props) {
  if (process.env.NODE_ENV === 'production') notFound();
  const sp = await searchParams;
  const v = one(sp.v) ?? 'events';

  // 🎟 #34 THE BOOKED QR, COMPLETED: the Booked QRs list (Waiting · Used · Deleted) and the shipped generator opened to
  // CHANGE a waiting code — its quotation built in place, the Total following the lines. Lab rows; nothing is read.
  if (v === 'booked') {
    return (
      <div className="min-h-screen bg-cream" data-clients-lab="booked">
        <main className="mx-auto w-full max-w-3xl space-y-4 px-4 pb-24 pt-4">
          <h1 className="text-lg font-semibold text-ink">Booked QRs</h1>
          <BookedQrsList rows={LAB_BOOKED_QRS} />
          <LockedQrGenerator
            eventTypes={[{ value: 'wedding', label: 'Wedding' }]}
            services={[
              { value: 'svc-full', label: 'Full-day coverage' },
              { value: 'svc-sde', label: 'Same-day edit' },
            ]}
            servicePrices={{ 'svc-full': 65000, 'svc-sde': 15000 }}
            contracts={[]}
            dateExempt
            initial={LAB_BOOKED_CHANGE}
          />
        </main>
      </div>
    );
  }

  if (v === 'pick') {
    const page = (one(sp.page) ?? 'details') as PickedClientPage;
    return (
      <div className="min-h-screen bg-cream" data-clients-lab="pick">
        <PickedClientShell
          eventId="ev-reyes"
          eventName="Reyes & Santos wedding"
          menu={pickedMenuFor(true)}
          initialPage={page}
          bodies={pickedBodies(
            page,
            one(sp.cal) === 'fail',
            one(sp.decisions) === 'none' ? 'none' : one(sp.decisions) === 'partial' ? 'partial' : 'full',
          )}
          settingsLine={{ line: 'This client only', tip: 'Lab.' }}
          settings={null}
        />
      </div>
    );
  }

  const show = one(sp.show) ?? null;
  const agent = one(sp.agent) === '1';
  const doors: CustomersDoor[] = [
    { key: 'booked', value: '4', word: 'booked', dot: 'booked' },
    { key: 'schedules', value: String(MEETINGS.length), word: 'schedules' },
    { key: 'asking', value: '3', word: 'asked', hot: true, dot: 'asking' },
    { key: 'collect', value: peso(18000), word: 'to collect' },
  ];
  const quick: CustomersQuick[] = [
    { key: 'overdue', word: 'Overdue', value: '2', zero: false },
    { key: 'unread', word: 'Unread', value: '2', zero: false },
  ];
  const nameOf = (id: string) => CLIENTS.find((c) => c.key === id)?.label ?? 'A client';
  const panels: Record<string, ReactNode> = {
    all: <div>{ROSTER('all')}</div>,
    asking: <div>{ROSTER('asking').slice(3)}</div>,
    booked: <div>{ROSTER('booked').slice(0, 3)}</div>,
    done: <p className="py-3 text-[14px] text-ink/70">Nothing done yet.</p>,
    schedules: <MeetingsList meetings={MEETINGS} nameOf={nameOf} failed={false} />,
    collect: <PaymentsList rows={MONEY} failed={false} data="collect" empty="Nothing to collect — every payment is in." />,
    overdue: <PaymentsList rows={MONEY.filter((r) => r.badge?.word === 'Overdue')} failed={false} data="overdue" empty="Nothing overdue." />,
    unread: <UnreadList rows={UNREAD} countOf={() => 1} failed={false} />,
  };
  return (
    <div className="min-h-screen bg-cream" data-clients-lab="events">
      <main className="mx-auto w-full max-w-3xl space-y-4 px-4 pb-6 pt-4 sm:px-6 lg:px-8 tab:max-w-none">
        <div className="pb-24">
          <div id="customers" className="min-w-0 scroll-mt-24" data-customers-events="">
            <CustomersPin
              seg="events"
              hrefs={{ events: '/dev/clients-lab', dates: '/dev/supplier-lab?s=dates', money: '/dev/supplier-lab?s=money' }}
              title={{ counts: `4 booked · ${peso(18000)} to collect` }}
              month={{
                initialDayStates: LAB_CALENDAR.dayStates,
                initialWaitlist: LAB_CALENDAR.waitlist,
                inquiries: LAB_CALENDAR.inquiries,
                initialMonth: LAB_TODAY.slice(0, 7),
                initialDay: one(sp.day) ?? null,
                todayIso: LAB_TODAY,
                pools: LAB_CALENDAR.pools,
                bookings: LAB_CALENDAR.bookings,
                blocks: LAB_CALENDAR.blocks,
                dayActions: one(sp.refuse) === '1' ? { addManualBlock: labDayRefused, removeBlock: labDayRefused } : { addManualBlock: labDayWrite, removeBlock: labDayWrite },
                fetchMonth: null,
                closuresComplete: true,
              }}
              doors={doors}
              panels={panels}
              quick={quick}
              initial={show}
              gear={
                <button type="button" aria-label="Clients settings" className="sn-press grid h-11 w-11 shrink-0 place-items-center rounded-full border border-ink/15 text-ink">
                  <Settings aria-hidden className="h-5 w-5" strokeWidth={1.75} />
                </button>
              }
              columns={{ rest: 'No events here yet.' }}
            />
          </div>
        </div>
      </main>
      {/* The supplier's thumb-row plumbing (SupplierThumbRow) is a supplier-route foundation and must not load with a
          /dev route (the-supplier-foundations-hold test 3) — the lab pins the same shared ThumbRow at the foot itself. */}
      <div role="toolbar" aria-label="Customer tools" className="fixed inset-x-0 bottom-0 px-3 pb-4" style={{ zIndex: 'var(--sn-z-nav, 30)' }}>
          <ThumbRow
            name="customers"
            field={{ node: <SearchBox placeholder="Search clients" defaultValue="" keep="v=events" hash="#customers" data="customers" /> }}
            right={[
              {
                node: (
                  <ClientsShowSort
                    choice={clientsChoiceOf(sp)}
                    initialShow={show}
                    services={[
                      { key: 'svc-1', label: 'Wedding photo & video' },
                      { key: 'svc-2', label: 'Photo booth' },
                    ]}
                    clients={CLIENTS}
                    seats={agent ? null : [{ key: 'tm-marco', label: 'Marco' }, { key: 'tm-joy', label: 'Joy' }]}
                    agent={agent}
                    shown={CLIENTS.length}
                    keep="v=events"
                  />
                ),
              },
            ]}
            action={{ node: <ActionButton tone="brand" main icon={<Plus aria-hidden strokeWidth={2} />} label="Add" href="/dev/clients-lab?v=events" /> }}
          />
      </div>
    </div>
  );
}
