/**
 * The date and place sheets' fixtures (PR5) — the approved prototype's own names and days
 * (`suppliers_date_place_help_tour_2026-10-10.html`): Seda Vertis North is booked (taken Dec 5), Bituin Catering is a
 * priced pick (taken Dec 26), Hiraya Table and Lumina Studio are free. Help me choose compares December 2026's
 * Saturdays through the REAL filters (`fittingDates` · `daysFreeForPricedPicks`), so the lab shows what the rule does,
 * not a list typed to look right.
 */
import { fittingDates } from '@/lib/date-fits-booked';
import { daysFreeForPricedPicks } from '@/lib/help-me-choose';
import type { DateChangeView } from '@/lib/date-change';
import type { MatrixDate, MatrixVendorState } from '@/lib/schedule-matrix';
import type { DateSheetData, PlaceSheetData } from '@/lib/suppliers-fact-sheets';

export type LabFactOptions = {
  /** A Saturday is refused by the priced pick's calendar — or nobody can do any (`none`) · the read fails. */
  help: 'ok' | 'none' | 'unread' | 'nomonth';
  /** Lumina never set a calendar (P5 "Not set"). */
  notSet: boolean;
  /** An open date change (J51). */
  change: boolean;
  /** The date waits in the draft. */
  drafted: boolean;
  /** Who is booked: the venues (default) or nobody. */
  venues: 'booked' | 'none';
};

type Pick = { key: string; name: string; category: string; label: string; taken: string[]; confirmed: boolean; priced: boolean };
const PICKS: Pick[] = [
  { key: 'v-seda', name: 'Seda Vertis North', category: 'venue', label: 'Reception venue', taken: ['2026-12-05'], confirmed: true, priced: true },
  { key: 'v-bituin', name: 'Bituin Catering', category: 'catering', label: 'Catering', taken: ['2026-12-26'], confirmed: false, priced: true },
  { key: 'v-hiraya', name: 'Hiraya Table', category: 'catering', label: 'Catering', taken: [], confirmed: false, priced: false },
  { key: 'v-lumina', name: 'Lumina Studio', category: 'photographer', label: 'Photo & video', taken: [], confirmed: false, priced: true },
];
const SATURDAYS = ['2026-12-05', '2026-12-12', '2026-12-19', '2026-12-26'];

function matrixDay(dateKey: string, o: LabFactOptions): MatrixDate {
  const byCat = new Map<string, Pick[]>();
  for (const p of PICKS) byCat.set(p.category, [...(byCat.get(p.category) ?? []), p]);
  const categories = [...byCat.entries()].map(([category, picks]) => {
    const vendors = picks.map((p, i) => {
      const state: MatrixVendorState =
        o.help === 'none' && p.priced && !p.confirmed ? 'booked' : p.taken.includes(dateKey) ? 'booked' : o.notSet && p.key === 'v-lumina' ? 'unknown' : 'open';
      return { key: p.key, name: p.name, isTopPick: i === 0, state, confirmed: p.confirmed };
    });
    const covered = vendors.some((v) => v.state !== 'booked');
    return { category, label: picks[0]!.label, vendors, covered, topPickKept: vendors[0]!.state !== 'booked' };
  });
  const d = new Date(`${dateKey}T00:00:00Z`);
  return {
    dateKey,
    label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }),
    dow: d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }),
    categories,
    coveredCount: categories.filter((c) => c.covered).length,
    totalCategories: categories.length,
    topPicksKept: categories.filter((c) => c.topPickKept).length,
    isBest: false,
  };
}

export function labDateSheet(o: LabFactOptions, month: string | null): DateSheetData {
  const priced = new Set(PICKS.filter((p) => p.priced).map((p) => p.key));
  const all = SATURDAYS.map((k) => matrixDay(k, o));
  const days = fittingDates(daysFreeForPricedPicks(all, priced)).map((d, i) => ({ ...d, isBest: i === 0 }));
  const change: DateChangeView | null = o.change
    ? {
        requestId: 'r-lab',
        proposedDate: '2026-12-19',
        proposedPrecision: 'day',
        fromDate: '2026-12-12',
        fromPrecision: 'day',
        askedAt: new Date(Date.now() - 3_600_000).toISOString(),
        suppliers: [
          {
            vendorProfileId: 'p-seda',
            eventVendorIds: ['v-seda'],
            name: 'Seda Vertis North',
            answer: 'asked',
            dueAt: new Date(Date.now() + 2.5 * 86_400_000).toISOString(),
            overdue: false,
            moneyToSettle: false,
          },
        ],
        answered: 0,
        total: 1,
        ready: false,
      }
    : null;
  return {
    date: o.drafted ? '2026-12-19' : '2026-12-12',
    precision: 'day',
    drafted: o.drafted,
    ceremonyTime: '15:00',
    bookedNames: o.venues === 'booked' ? ['Seda Vertis North'] : [],
    change,
    help:
      o.help === 'nomonth'
        ? null
        : o.help === 'unread'
          ? 'unread'
          : { month: month ?? '2026-12', days, pricedCount: priced.size, offPlatformCount: 0 },
  };
}

export function labPlaceSheet(o: LabFactOptions): PlaceSheetData {
  const booked = o.venues === 'booked';
  return {
    city: 'Quezon City',
    slots: [
      {
        slot: 'ceremony',
        label: 'Ceremony',
        booked: booked ? { name: 'Santuario de San Vicente de Paul', address: 'Tandang Sora Ave, Quezon City', pinned: true } : null,
        choice: {},
        typed: '',
        address: '',
        pin: null,
        columns: { name: 'std_film_ceremony_name', address: 'ceremony_venue_address', lat: 'ceremony_venue_latitude', lng: 'ceremony_venue_longitude' },
      },
      {
        slot: 'reception',
        label: 'Reception',
        booked: booked ? { name: 'Seda Vertis North', address: 'North Ave corner EDSA, Quezon City', pinned: true } : null,
        choice: {},
        typed: booked ? '' : 'Casa Hiraya Garden',
        address: booked ? '' : '12 Mabini St, Quezon City',
        pin: booked ? null : { lat: 14.6507, lng: 121.0494 },
        columns: { name: 'std_film_venue_name', address: 'venue_address', lat: 'venue_latitude', lng: 'venue_longitude' },
      },
    ],
  };
}

/** A day Seda (booked) cannot do is refused by the draft door, naming them — the shipped clash. */
export const LAB_CLASH_DAY = '2026-12-05';
