/**
 * Customers › Events (People until 2026-10-30) on fixture data (S-PR2) — the REAL components, the prototype's own people
 * (frame 03); `?s=events` draws the approved v13 prototype's own five events (one couple with two of them).
 * Drawn only by `/dev/supplier-lab` (404 in production). The Add sheet and Remove post the SHIPPED actions; with no
 * session both refuse — nothing is written from here.
 */
import {
  CUSTOMER_LANES,
  groupByLane,
  holdingByDate,
  type CustomerLane,
  type PipelineCustomer,
} from '@/lib/vendor-customer-pipeline';
import { filterBySearch, paginate, parseSearchParam } from '@/lib/paginate';
import { formatCount } from '@/lib/format-number';
import { formatPhp } from '@/lib/orders';
import { CustomersRoster, EventsHeading, type RosterRow } from '@/app/vendor-dashboard/customers/_components/customers-roster';
import {
  KeptNotesFold,
  OtherChatsFold,
  OutsideClientRows,
  type OtherChat,
  type OutsideClient,
  type OutsideCode,
} from '@/app/vendor-dashboard/customers/_components/people-more';
import { CustomersPin } from '@/app/vendor-dashboard/customers/_components/customers-pin';
import { CUSTOMERS_DOORS, type CustomersDoorKey } from '@/app/vendor-dashboard/customers/segments';
import { CustomersSettings } from '@/app/vendor-dashboard/customers/_components/customers-settings';
import { DaysSettings } from '@/app/vendor-dashboard/customers/_components/dates-folds';
import { ChatOriginMark } from '@/app/_components/chat/chat-back';
import { createCalendar, editCalendar, reassignCategoryPool, updatePoolCapacity } from '@/app/vendor-dashboard/calendar/actions';
import { OutsideClientAdd } from '@/app/vendor-dashboard/customers/_components/outside-client-add';
import { rosterView } from '@/app/vendor-dashboard/customers/roster-view';
import { ThumbRow } from '@/components/thumb-row';
import { SupplierThumbRow } from '@/app/vendor-dashboard/_components/supplier-thumb-row';
import { SupplierToast } from '@/app/vendor-dashboard/_components/supplier-toast';
import { SearchBox } from '@/app/_components/search-box';
import { importExternalClient, removeBlock } from '@/app/vendor-dashboard/calendar/actions';
import { acceptInquiry, declineInquiry } from '@/lib/chat-actions';
import { eventDayWords, forYourServicePages, stageOfLane, type EventLines } from '@/lib/supplier-event-lines';

/**
 * 📋 Each lab event's FIXED LINES (supplier dashboard v13) — what the page's `readSupplierEventLines` returns, on the
 * prototype's own people. The lab shop is a photo & video studio with a same-day edit it can offer.
 */
const LAB_SERVICES = ['photo_video'];
function labLines(f: Fix): EventLines {
  const stage = stageOfLane(f.lane);
  const hosts: Record<string, Array<[string, boolean, string?]>> = {
    ana: [['Tita Mina Reyes', true], ['Ana Reyes', false], ['Miguel Santos', false]],
    rolando: [['Carmen Villa', true], ['Rolando Villa', false]],
    katrina: [['Katrina Ocampo', true]],
    cruz: [['Liza Cruz', true], ['Jun Cruz', false]],
    // v13's own hosts — one couple, two events, the same people inside each; each with the role the page reads
    // (`hostRoleWord`), and the booked coordinator ("You") once the shop is booked.
    'ic-wedding': [['Claire Buanhog', true, 'Bride'], ['Indalecio Casasola II', false, 'Groom'], ['Ate Lorna Buanhog', false, 'Co-host'], ['You', false, 'Coordinator']],
    'ic-lunch': [['Claire Buanhog', true, 'Host'], ['Indalecio Casasola II', false, 'Co-host']],
    mj: [['Maria Santos', true, 'Bride'], ['Jose Santos', false, 'Groom'], ['You', false, 'Coordinator']],
    kat: [['Tita Mina Arroyo', true, 'Co-host'], ['Kat Arroyo', false, 'Celebrant']],
    reyes: [['Lorna Reyes', true, 'Host']],
  };
  const v13 = V13_LINES[f.eventId];
  return {
    eventId: f.eventId,
    threadId: f.threadId,
    stage,
    read: true,
    type: f.kind,
    celebrant: f.title,
    location: f.place,
    date: eventDayWords(f.eventDate),
    pax: v13 ? v13.pax : f.eventId === 'ana' ? 150 : f.eventId === 'cruz' ? 180 : null,
    hosts: (hosts[f.eventId] ?? [[f.title, true]]).map(([name, askedYou, role]) => (role ? { name, askedYou, role } : { name, askedYou })),
    requested: v13 ? v13.requested.map((name) => ({ name })) : [{ name: 'Photo & video · Full day' }],
    alsoOffer: stage === 'asking' && f.eventId === 'ana' ? [{ serviceId: 'sde', name: 'Same-day edit', from: null }] : [],
    alsoBooked: f.eventId === 'cruz' ? [{ name: 'Casa Alegria Events', service: 'Reception venue' }] : [],
    forYou: forYourServicePages({ eventId: f.eventId, stage, shopServices: LAB_SERVICES, eventTiles: null }),
    firstEvent: null,
  };
}

const NOW = Date.parse('2026-10-02T02:00:00Z'); // Fri Oct 2, 10:00 in Manila

/** v13's own services asked for and guest counts (prototype `?tab=cust&sec=events`). */
const V13_LINES: Record<string, { requested: string[]; pax: number | null }> = {
  'ic-wedding': { requested: ['Coordinator / Planner', 'Styling'], pax: 180 },
  'ic-lunch': { requested: ['Styling'], pax: 40 },
  mj: { requested: ['Coordinator / Planner'], pax: 150 },
  kat: { requested: ['Coordinator / Planner'], pax: 120 },
  reyes: { requested: ['Styling'], pax: 80 },
};
const ago = (hours: number) => new Date(NOW - hours * 3_600_000).toISOString();

type Fix = PipelineCustomer & { kind: string; quoted?: boolean; returning?: boolean; money?: RosterRow['note'] };

const person = (over: Partial<Fix> & Pick<Fix, 'eventId' | 'lane' | 'title' | 'kind'>): Fix => ({
  waitingKind: null,
  waitingSince: null,
  expiresAt: null,
  quietDays: null,
  identityRevealed: true,
  eventDate: null,
  place: null,
  threadId: `t-${over.eventId}`,
  eventVendorId: `ev-${over.eventId}`,
  ...over,
});

/** The prototype's six (frame 03), plus one quiet lead. */
const PEOPLE: Fix[] = [
  person({ eventId: 'ana', lane: 'waiting', waitingKind: 'inquiry', waitingSince: ago(2), title: 'Ana & Miguel', kind: 'Wedding', eventDate: '2027-03-13', place: 'Tagaytay' }),
  person({ eventId: 'rolando', lane: 'waiting', waitingKind: 'booking_ask', waitingSince: ago(20), expiresAt: new Date(NOW + 28 * 3_600_000).toISOString(), title: 'Rolando & Carmen', kind: 'Wedding', eventDate: '2026-11-21', place: 'Makati' }),
  person({ eventId: 'mara', lane: 'holding', quietDays: 9, title: 'Mara Villanueva', kind: 'Birthday', eventDate: '2026-12-05', place: 'Pasig' }),
  person({ eventId: 'katrina', lane: 'talking', title: 'Katrina Ocampo', kind: 'Debut', eventDate: '2026-10-03', place: 'Tagaytay', quoted: true }),
  person({ eventId: 'cruz', lane: 'booked', title: 'Jun & Liza Cruz', kind: 'Wedding', eventDate: '2026-10-04', place: 'Makati', money: { text: `Balance ${formatPhp(42_000)}`, tone: 'quiet' } }),
  person({ eventId: 'bautista', lane: 'booked', title: 'Lourdes Bautista', kind: 'Christening', eventDate: '2026-10-10', place: 'Quezon City', returning: true, money: { text: 'paid in full', tone: 'ok' } }),
  person({ eventId: 'paolo', lane: 'finished', title: 'Paolo & Nina', kind: 'Wedding', eventDate: '2026-08-15', place: 'Cebu', money: { text: 'paid in full', tone: 'ok' } }),
];

/**
 * 🗂 THE APPROVED v13 PROTOTYPE'S OWN FIVE EVENTS (owner "Approved.", 2026-10-29) — the side-by-side's fixture. Indalecio &
 * Claire have TWO events, so they are two rows ("a person with two events = two rows").
 */
const V13_EVENTS: Fix[] = [
  person({ eventId: 'ic-wedding', lane: 'booked', title: 'Indalecio & Claire', kind: 'Wedding', eventDate: '2026-12-18', place: 'Seda Vertis North, Quezon City', money: { text: `${formatPhp(65_000)} · ${formatPhp(25_000)} paid · next ${formatPhp(20_000)} Nov 18`, tone: 'quiet' } }),
  person({ eventId: 'ic-lunch', lane: 'waiting', waitingKind: 'inquiry', waitingSince: ago(5), title: 'Indalecio & Claire', kind: 'Thanksgiving lunch', eventDate: '2026-12-19', place: 'Quezon City' }),
  person({ eventId: 'mj', lane: 'booked', title: 'Maria & Jose', kind: 'Wedding', eventDate: '2027-01-23', place: 'Tagaytay', money: { text: `${formatPhp(45_000)} · ${formatPhp(0)} paid · next ${formatPhp(15_000)} Nov 30`, tone: 'quiet' } }),
  person({ eventId: 'kat', lane: 'waiting', waitingKind: 'inquiry', waitingSince: ago(26), title: 'Kat Arroyo', kind: 'Debut', eventDate: '2027-02-14', place: 'Blue Leaf, Taguig' }),
  person({ eventId: 'reyes', lane: 'finished', title: 'Reyes family', kind: '50th birthday', eventDate: '2025-11-14', place: 'Pasig', money: { text: `${formatPhp(28_000)} · paid in full`, tone: 'ok' } }),
];

/** Two couples holding one Saturday — the clash row. */
const CLASH: Fix[] = [
  person({ eventId: 'dela', lane: 'holding', quietDays: 12, title: 'Dela Cruz', kind: 'Wedding', eventDate: '2026-10-24', place: 'Antipolo' }),
  person({ eventId: 'santos', lane: 'holding', quietDays: 8, title: 'Santos', kind: 'Wedding', eventDate: '2026-10-24', place: 'Tagaytay' }),
];

const OUTSIDE: OutsideClient[] = [
  { blockId: 'blk-1', name: 'Reyes family reunion', startDate: '2026-10-17', endDate: '2026-10-17', schedule: 'Main team', contact: '0917 555 0101', note: 'Booked through a friend — half paid.' },
  { blockId: 'blk-2', name: 'ABC Corp year-end', startDate: '2026-12-11', endDate: '2026-12-12', schedule: 'Second team', contact: null, note: null },
  { blockId: 'blk-3', name: 'Santos wedding', startDate: '2026-11-07', endDate: '2026-11-07', schedule: 'Main team', contact: null, note: null },
];

/** Their one-time codes (the prototype's three states): Reyes not linked · ABC code sent · Santos linked. */
const CODES: Record<string, OutsideCode> = {
  'blk-1': { state: 'none' },
  'blk-2': { state: 'sent', token: 'lab-token-abc', madeAt: '2026-09-20T03:00:00Z' },
  'blk-3': { state: 'linked', usedAt: '2026-10-01T03:00:00Z' },
};

/** The chats the list does not hold — archived and closed (the retired Messages fold's other rows). */
const OTHER_CHATS: OtherChat[] = [
  { threadId: 't-archived', title: 'Bea’s Birthday (Nov 28)', why: 'Archived', archived: true },
  { threadId: 't-declined', title: 'Carlo’s Wedding (Jan 9, 2027)', why: 'You turned it down', archived: false },
  { threadId: 't-displaced', title: 'Dana’s Debut (Dec 12)', why: 'They booked someone else', archived: false },
];

const KEPT = [
  { noteId: 'n1', body: 'Prefers warm colour grading. Bride’s mother is the main contact.', createdAt: '2026-06-02T03:00:00Z' },
  { noteId: 'n2', body: 'Venue allows drones only after 4 PM.', createdAt: '2026-05-20T03:00:00Z' },
];

const NOTICES = {
  added: { text: 'Outside client added — free. They now hold that date on your schedule.', tone: 'ok' as const },
  removed: { text: 'Outside client removed. The date is open again.', tone: 'ok' as const },
  failed: { text: 'That did not go through. Nothing changed — please try again.', tone: 'bad' as const, retry: true },
};

export function PeopleLab({
  variant,
  q,
  lane,
  toast,
  add,
  door,
  block,
  gear,
}: {
  /** events · people · clash · empty · fail · nopools */
  variant: string;
  q: string | undefined;
  lane: string | undefined;
  toast: string | undefined;
  add: boolean;
  /** The door to open on (`?door=`). */
  door?: string;
  /** An outside booking just added — its row opens (`?block=`). */
  block?: string;
  /** Customers ⚙ is open (`?gear=1`). */
  gear?: boolean;
}) {
  const base = `/dev/supplier-lab?s=${variant}`;
  const fixtures = variant === 'empty' ? [] : variant === 'events' ? V13_EVENTS : variant === 'clash' ? [...PEOPLE, ...CLASH] : PEOPLE;
  // v13 draws no outside bookings — the side-by-side keeps to its five events.
  const outsideAll = variant === 'empty' || variant === 'events' ? [] : OUTSIDE;
  const lanes = groupByLane(fixtures);
  const extra = new Map(fixtures.map((f) => [f.eventId, f]));
  const decorate = (r: PipelineCustomer): RosterRow => {
    const f = extra.get(r.eventId)!;
    return {
      ...r,
      kind: f.kind,
      quoted: Boolean(f.quoted),
      returning: Boolean(f.returning),
      note: variant === 'fail' && (r.lane === 'booked' || r.lane === 'finished') ? { text: 'couldn’t load', tone: 'quiet' } : (f.money ?? null),
    };
  };
  // The page's own door → lanes split (`customers/page.tsx` DOOR_LANES), on the prototype's people.
  const DOOR_LANES: Record<CustomersDoorKey, CustomerLane[]> = { asking: ['waiting'], talking: ['holding', 'talking'], booked: ['booked'], done: ['finished'] };
  const none = Object.fromEntries(CUSTOMER_LANES.map((l) => [l, [] as PipelineCustomer[]])) as Record<CustomerLane, PipelineCustomer[]>;
  const views = Object.fromEntries(
    CUSTOMERS_DOORS.map((k) => {
      const subset = { ...none };
      for (const l of DOOR_LANES[k]) subset[l] = lanes[l];
      return [k, rosterView(subset, { lane: undefined, q, page: undefined, decorate })];
    }),
  ) as Record<CustomersDoorKey, ReturnType<typeof rosterView<RosterRow>>>;
  const outsideMatched = filterBySearch(outsideAll, parseSearchParam(q), (c) => c.name);
  const outsidePage = paginate(outsideMatched, undefined);
  const outsidePaged = {
    ...outsidePage,
    items: outsidePage.items.map((c) => ({ ...c, code: variant === 'fail' ? ({ state: 'unread' } as const) : CODES[c.blockId] })),
  };
  const count = (k: CustomersDoorKey) => DOOR_LANES[k].reduce((n, l) => n + lanes[l].length, 0) + (k === 'booked' ? outsideAll.length : 0);
  const LANE_DOOR: Record<string, CustomersDoorKey> = { waiting: 'asking', holding: 'talking', talking: 'talking', booked: 'booked', outside: 'booked', finished: 'done' };
  const initial: CustomersDoorKey =
    ((CUSTOMERS_DOORS as readonly string[]).includes(door ?? '') ? (door as CustomersDoorKey) : null) ??
    (lane ? LANE_DOOR[lane] : undefined) ??
    (block ? 'booked' : undefined) ??
    (count('asking') > 0 ? 'asking' : (CUSTOMERS_DOORS.find((k) => count(k) > 0) ?? 'asking'));
  const keep = (drop: string[]) => {
    const p = new URLSearchParams({ s: variant });
    if (q && !drop.includes('q')) p.set('q', q);
    return p.toString();
  };
  const notice = toast ? NOTICES[toast as keyof typeof NOTICES] : undefined;
  // The lab's "fail": the roster read fell short — a door with people says "N+", an empty one "couldn't load".
  const value = (k: CustomersDoorKey) => {
    const n = count(k);
    if (variant !== 'fail') return formatCount(n);
    return n > 0 ? `${formatCount(n)}+` : null;
  };
  const panels = Object.fromEntries(
    CUSTOMERS_DOORS.map((k) => {
      const v = views[k];
      const counts = Object.fromEntries(CUSTOMER_LANES.map((l) => [l, DOOR_LANES[k].includes(l) ? lanes[l].length : 0])) as Record<CustomerLane, number>;
      return [
        k,
        <>
          <CustomersRoster
            rows={v.paged.items}
            paged={v.paged}
            query={q ?? ''}
            incomplete={variant === 'fail'}
            pagerKeepParams={`${keep([])}&door=${k}`}
            counts={counts}
            nowMs={NOW}
            holdingPerDate={holdingByDate(fixtures)}
            otherMatches={k === 'booked' ? outsideMatched.length : 0}
            otherTotal={k === 'booked' ? outsideAll.length : 0}
            anchor={null}
            emptyLine={count(k) === 0 ? 'Nobody here yet.' : undefined}
            lines={Object.fromEntries(fixtures.map((f) => [f.eventId, labLines(f)]))}
            answers={{ acceptInquiry, declineInquiry }}
          />
          {k === 'booked' ? (
            <OutsideClientRows
              paged={outsidePaged}
              incomplete={variant === 'fail'}
              keepParams={`${keep([])}&door=booked`}
              removeBlock={removeBlock}
              headed={v.paged.items.length > 0}
              nowMs={NOW}
              openBlock={block ?? null}
            />
          ) : null}
        </>,
      ];
    }),
  ) as Record<CustomersDoorKey, React.ReactNode>;
  const gearBody = gear ? (
    <div data-customers-settings-body="">
      <p className="home-k2 pt-2">Getting paid</p>
      <p className="py-2 text-[13.5px] text-ink/60">(Lab) the shipped payment-options editor draws here — it needs a signed-in shop.</p>
      <p className="home-k2 pt-4">Teams and days</p>
      <DaysSettings
        month="2026-10"
        seg="events"
        calendars={[
          { poolId: 'p1', label: 'Main team', name: 'Main team', capacity: 1, line: 'Catering', serviceIds: [], categories: [{ key: 'catering', label: 'Catering' }] },
          { poolId: 'p2', label: 'Second team', name: 'Second team', capacity: 2, line: 'Catering', serviceIds: [], categories: [{ key: 'catering', label: 'Catering' }] },
        ]}
        ceiling={50}
        namedCalendars
        services={[]}
        slotsHref="/vendor-dashboard/shop"
        icsHref="/vendor-dashboard/customers/calendar.ics"
        approveFirst
        actions={{ updatePoolCapacity, createCalendar, editCalendar, reassignCategoryPool }}
      />
    </div>
  ) : null;

  return (
    <div className="min-h-screen bg-cream" data-supplier-lab="people">
      {/* <main>: the thumb row measures it on a computer, as it measures the dashboard's own column. */}
      <main className="mx-auto w-full max-w-3xl space-y-4 px-4 pb-6 pt-4 sm:px-6 lg:px-8 tab:max-w-none">
        <div className="pb-24">
          {notice ? <SupplierToast text={notice.text} tone={notice.tone} retry={'retry' in notice} retryHref={`${base}&add=1`} /> : null}
          {/* The page's own layout (customers/page.tsx): the two columns from 701 — events left, the opened one right. */}
          <div id="customers" className="min-w-0 scroll-mt-24" data-customers-events="">
            <ChatOriginMark />
            <CustomersPin
              seg="events"
              hrefs={{ events: base, dates: '/dev/supplier-lab?s=dates', money: '/dev/supplier-lab?s=money' }}
              doors={[
                { key: 'asking', value: value('asking'), word: 'asking', hot: count('asking') > 0 },
                { key: 'talking', value: value('talking'), word: 'talking' },
                { key: 'booked', value: value('booked'), word: 'booked' },
                { key: 'done', value: value('done'), word: 'done' },
              ]}
              panels={panels}
              initial={initial}
              gear={<CustomersSettings body={gearBody} />}
              columns={{ rest: 'No events here yet. When somebody asks about a date, or books you, their event shows up here.' }}
              between={
                <>
                  <EventsHeading />
                  {variant === 'fail' ? (
                    <p role="status" className="mb-2 text-[13px] text-ink/70">
                      Some payments couldn&rsquo;t load, so your customers&rsquo; money lines say so instead of a figure. Reload the page to try again.
                    </p>
                  ) : null}
                </>
              }
              after={
                <div className="mt-6 space-y-2" data-customers-side="">
                  {variant !== 'empty' && variant !== 'events' ? (
                    <OtherChatsFold paged={paginate(OTHER_CHATS, undefined)} keepParams={keep([])} returnTo={base} />
                  ) : null}
                  {variant !== 'empty' && variant !== 'events' ? <KeptNotesFold notes={KEPT} /> : null}
                </div>
              }
            />
          </div>
        </div>
      </main>
      <SupplierThumbRow
        name="events"
        label="Customer tools"
        row={
          <ThumbRow
            name="customers"
            field={{ node: <SearchBox placeholder="Search events" defaultValue={q ?? ''} keep={keep(['q'])} hash="#customers" data="customers" /> }}
            action={{
              node: (
                <OutsideClientAdd
                  pools={
                    variant === 'nopools'
                      ? []
                      : [
                          { poolId: 'p1', label: 'Main team' },
                          { poolId: 'p2', label: 'Second team' },
                        ]
                  }
                  action={importExternalClient}
                  startOpen={add}
                  today="2026-10-02"
                  setupHref={`${base}&gear=1`}
                />
              ),
            }}
          />
        }
      />
    </div>
  );
}
