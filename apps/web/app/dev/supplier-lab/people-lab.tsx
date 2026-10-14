/**
 * Customers › People on fixture data (S-PR2) — the REAL components, the prototype's own people (frame 03).
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
import { CustomersRoster, type RosterRow } from '@/app/vendor-dashboard/customers/_components/customers-roster';
import { CustomersPick } from '@/app/vendor-dashboard/customers/_components/customers-pick';
import { CustomersSegments } from '@/app/vendor-dashboard/customers/_components/customers-segments';
import { KeptNotesFold, OutsideClientRows, type OutsideClient } from '@/app/vendor-dashboard/customers/_components/people-more';
import { OutsideClientAdd } from '@/app/vendor-dashboard/customers/_components/outside-client-add';
import { rosterView } from '@/app/vendor-dashboard/customers/roster-view';
import { SupplierThumbRow } from '@/app/vendor-dashboard/_components/supplier-thumb-row';
import { SupplierToast } from '@/app/vendor-dashboard/_components/supplier-toast';
import { SearchBox } from '@/app/_components/search-box';
import { importExternalClient, removeBlock } from '@/app/vendor-dashboard/calendar/actions';

const NOW = Date.parse('2026-10-02T02:00:00Z'); // Fri Oct 2, 10:00 in Manila
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

/** Two couples holding one Saturday — the clash row. */
const CLASH: Fix[] = [
  person({ eventId: 'dela', lane: 'holding', quietDays: 12, title: 'Dela Cruz', kind: 'Wedding', eventDate: '2026-10-24', place: 'Antipolo' }),
  person({ eventId: 'santos', lane: 'holding', quietDays: 8, title: 'Santos', kind: 'Wedding', eventDate: '2026-10-24', place: 'Tagaytay' }),
];

const OUTSIDE: OutsideClient[] = [
  { blockId: 'blk-1', name: 'Reyes family reunion', startDate: '2026-10-17', endDate: '2026-10-17', schedule: 'Main team', contact: '0917 555 0101', note: 'Booked through a friend — half paid.' },
  { blockId: 'blk-2', name: 'ABC Corp year-end', startDate: '2026-12-11', endDate: '2026-12-12', schedule: 'Second team', contact: null, note: null },
];

const KEPT = [
  { noteId: 'n1', body: 'Prefers warm colour grading. Bride’s mother is the main contact.', createdAt: '2026-06-02T03:00:00Z' },
  { noteId: 'n2', body: 'Venue allows drones only after 4 PM.', createdAt: '2026-05-20T03:00:00Z' },
];

const LANE_WORDS: Record<CustomerLane, string> = {
  waiting: 'Waiting on you',
  holding: 'Holding',
  talking: 'Talking',
  booked: 'Booked',
  finished: 'Done',
};

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
}: {
  /** people · clash · empty · fail · nopools */
  variant: string;
  q: string | undefined;
  lane: string | undefined;
  toast: string | undefined;
  add: boolean;
}) {
  const base = `/dev/supplier-lab?s=${variant}`;
  const fixtures = variant === 'empty' ? [] : variant === 'clash' ? [...PEOPLE, ...CLASH] : PEOPLE;
  const outsideAll = variant === 'empty' ? [] : OUTSIDE;
  const lanes = groupByLane(fixtures);
  const extra = new Map(fixtures.map((f) => [f.eventId, f]));
  const view = rosterView(lanes, {
    lane,
    q,
    page: undefined,
    decorate: (r): RosterRow => {
      const f = extra.get(r.eventId)!;
      return {
        ...r,
        kind: f.kind,
        quoted: Boolean(f.quoted),
        returning: Boolean(f.returning),
        note: variant === 'fail' && (r.lane === 'booked' || r.lane === 'finished') ? { text: 'couldn’t load', tone: 'quiet' } : (f.money ?? null),
      };
    },
  });
  const outsideOnly = lane === 'outside';
  const showOutside = outsideOnly || !view.activeLane;
  const outsidePage = paginate(showOutside ? filterBySearch(outsideAll, parseSearchParam(q), (c) => c.name) : [], undefined);
  const keep = (drop: string[]) => {
    const p = new URLSearchParams({ s: variant });
    if (q && !drop.includes('q')) p.set('q', q);
    if (lane && !drop.includes('lane')) p.set('lane', lane);
    return p.toString();
  };
  const pick = (value: string | null) => {
    const p = new URLSearchParams(keep(['lane']));
    if (value) p.set('lane', value);
    return `/dev/supplier-lab?${p.toString()}#customers`;
  };
  const everyone = CUSTOMER_LANES.reduce((n, l) => n + view.laneCounts[l], 0) + outsideAll.length;
  const notice = toast ? NOTICES[toast as keyof typeof NOTICES] : undefined;

  return (
    <div className="min-h-screen bg-cream" data-supplier-lab="people">
      {/* <main>: the thumb row measures it on a computer, as it measures the dashboard's own column. */}
      <main className="mx-auto w-full max-w-3xl space-y-4 px-4 pb-6 pt-4 sm:px-6 lg:max-w-4xl lg:px-8">
        <CustomersSegments seg="people" waiting={view.laneCounts.waiting} hrefOf={(s) => (s === 'people' ? base : `${base}&seg=${s}`)} />
        <div className="pb-24">
          {notice ? <SupplierToast text={notice.text} tone={notice.tone} retry={'retry' in notice} retryHref={`${base}&add=1`} /> : null}
          {variant === 'fail' ? (
            <p role="status" className="mb-2 text-[13px] text-ink/70">
              Some payments couldn&rsquo;t load, so your customers&rsquo; money lines say so instead of a figure. Reload the page to try again.
            </p>
          ) : null}
          <CustomersRoster
            rows={view.paged.items}
            paged={view.paged}
            query={q ?? ''}
            incomplete={variant === 'fail'}
            pagerKeepParams={keep([])}
            counts={view.laneCounts}
            nowMs={NOW}
            holdingPerDate={holdingByDate(fixtures)}
            hidden={outsideOnly}
            otherMatches={outsidePage.total}
            otherTotal={outsideAll.length}
            filter={
              <CustomersPick
                label="Filter"
                value={outsideOnly ? 'outside' : (view.activeLane ?? 'all')}
                dataAttr="data-customers-filter"
                className="!min-h-11"
                options={[
                  { key: 'all', label: `Everyone · ${formatCount(everyone)}`, href: pick(null) },
                  ...CUSTOMER_LANES.map((l) => ({ key: l, label: `${LANE_WORDS[l]} · ${formatCount(view.laneCounts[l])}`, href: pick(l) })),
                  { key: 'outside', label: `Outside · ${formatCount(outsideAll.length)}`, href: pick('outside') },
                ]}
              />
            }
          />
          {showOutside ? (
            <OutsideClientRows
              paged={outsidePage}
              incomplete={variant === 'fail'}
              keepParams={keep([])}
              removeBlock={removeBlock}
              headed={!outsideOnly && view.paged.items.length > 0}
              nowMs={NOW}
            />
          ) : null}
          {variant !== 'empty' ? <KeptNotesFold notes={KEPT} /> : null}
        </div>
      </main>
      <SupplierThumbRow name="people" label="Customer tools">
        <SearchBox placeholder="Search a customer" defaultValue={q ?? ''} keep={keep(['q'])} hash="#customers" data="customers" />
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
          setupHref={`${base}&seg=dates`}
        />
      </SupplierThumbRow>
    </div>
  );
}
