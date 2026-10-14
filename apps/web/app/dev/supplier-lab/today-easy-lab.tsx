/**
 * /dev/supplier-lab?easy=<moment>&sup=<supplier> — THE SIMPLER TODAY on the prototype's own people and dates
 * (`Setnayan/prototypes/supplier_easy_dashboard_2026-10-14_fable.html`, today = Wed 14 Oct 2026), drawn by the SAME
 * assembly (`assembleSupplierToday`) and the SAME screen (`SupplierTodayScreen`) the Today page uses. DEV-ONLY.
 *
 *   sup     parish · caterer · studio · venue
 *   easy    normal · setup · ask · eventday · locked · hallask (venue) · agreed (the yes, the fee held)
 *
 * No peso is typed here: fees are the bills' own amounts and the forecast is `bookingFeeForecast` on the default
 * schedule (`BOOKING_FEE`) — the same function the page's forecast runs.
 */
import { assembleSupplierToday, type SupplierTodayInput } from '@/lib/supplier-today-view';
import type { UpcomingEventRow, WhatsNewCard } from '@/lib/vendor-overview';
import type { DueFeeBill, FeeDisclosure } from '@/lib/booking-fee-disclosure';
import { bookingFeeForecast } from '@/lib/booking-fee-disclosure';
import { BOOKING_FEE, bookingFeePhp } from '@/lib/booking-fee';
import { buildFirstStepsRail } from '@/lib/vendor-first-steps';
import { splitDesk } from '@/lib/vendor-desk-disposition';
import { lockAgreeNotice } from '@/lib/lock-answer-notice';
import { SupplierTodayScreen, type TodayActions } from '@/app/vendor-dashboard/_components/supplier-today-screen';
import type { TodayOutcome } from '@/app/vendor-dashboard/_components/supplier-today-first-screen';

export const EASY_MOMENTS = ['normal', 'setup', 'ask', 'eventday', 'locked', 'hallask', 'agreed'] as const;
export type EasyMoment = (typeof EASY_MOMENTS)[number];
export const EASY_SUPPLIERS = ['parish', 'caterer', 'studio', 'venue'] as const;
export type EasySupplier = (typeof EASY_SUPPLIERS)[number];

const TODAY = '2026-10-14';
const NOW = Date.parse('2026-10-14T02:00:00Z'); // Wed 14 Oct, 10:00 in Manila
const ago = (h: number) => new Date(NOW - h * 3_600_000).toISOString();
const ahead = (h: number) => new Date(NOW + h * 3_600_000).toISOString();
const inDays = (d: string) => Math.round((Date.parse(`${d}T00:00:00Z`) - Date.parse(`${TODAY}T00:00:00Z`)) / 86_400_000);

const up = (id: string, name: string, date: string, place: string, poolId: string, guests: number | null = null): UpcomingEventRow => ({
  id: `up-${id}`,
  eventId: id,
  eventName: name,
  date,
  place,
  category: null,
  inDays: inDays(date),
  href: `/vendor-dashboard/clients/${id}?tab=details`,
  threadHref: `/vendor-dashboard/messages/t-${id}`,
  opensCard: true,
  guests,
  poolId,
});
const out = (id: string, name: string, date: string, poolId: string) => ({ blockId: id, clientName: name, date, poolId });

const inquiry = (id: string, name: string, date: string, msg: string, hoursAgo: number): WhatsNewCard => ({
  kind: 'inquiry',
  id: `inq-${id}`,
  threadId: `t-${id}`,
  title: 'New inquiry — New customer',
  descriptor: name,
  eventDate: date,
  place: null,
  category: null,
  paxAtInquiry: null,
  messageExcerpt: msg,
  createdAt: ago(hoursAgo),
});
const ask = (id: string, name: string, date: string, hoursAgo: number): WhatsNewCard => ({
  kind: 'lock_request',
  id: `lockreq-ev-${id}`,
  eventId: id,
  eventVendorId: `ev-${id}`,
  coupleName: name,
  eventDate: date,
  requestedAt: ago(hoursAgo),
  expiresAt: ahead(48 - hoursAgo),
  threadId: `t-${id}`,
});
const DATE_CHANGE: WhatsNewCard = {
  kind: 'date_change',
  id: 'datechange-cruz',
  eventId: 'cruz',
  eventVendorId: 'ev-cruz',
  coupleName: 'Cruz',
  fromDate: '2026-10-18',
  fromPrecision: 'day',
  proposedDate: '2026-10-25',
  proposedPrecision: 'day',
  askedAt: ago(26),
  dueAt: ahead(46),
};
const del = (id: string, name: string, date: string): WhatsNewCard => ({
  kind: 'delete_request',
  id: `delreq-${id}`,
  eventId: id,
  eventVendorId: `ev-${id}`,
  eventDate: date,
  requestedAt: ago(30),
  coupleName: name,
});
const done = (id: string, name: string, date: string): WhatsNewCard => ({
  kind: 'mark_complete',
  id: `done-${id}`,
  eventVendorId: `ev-${id}`,
  eventId: id,
  eventName: name,
  eventDate: date,
  createdAt: ago(80),
});
const REVIEW: WhatsNewCard = { kind: 'review', id: 'rev-1', reviewId: 'r1', coupleName: 'Cruz', quote: 'They caught moments we never saw.', rating: 5, createdAt: ago(60) };
const QUOTE: WhatsNewCard = { kind: 'quote_draft', id: 'quote-1', proposalId: 'p1', publicId: null, eventId: 'rc', title: 'Rolando & Carmen', totalCentavos: 4_500_000, createdAt: ago(100) };
const CONTRACT: WhatsNewCard = { kind: 'contract_draft', id: 'contract-1', contractId: 'c1', eventId: 'lt', title: 'Lim & Tan', createdAt: ago(120) };
const LAPSED: WhatsNewCard = {
  kind: 'lock_request_lapsed',
  id: 'lockreq-lapsed-dp',
  eventId: 'dp',
  eventVendorId: 'ev-dp',
  coupleName: 'Dela Peña',
  eventDate: '2026-11-07',
  requestedAt: ago(200),
  expiresAt: ago(150),
};
const DISPUTE: WhatsNewCard = { kind: 'dispute', id: 'disp-1', eventId: 'perez', eventName: 'Perez', label: null, createdAt: ago(140), threadHref: '/vendor-dashboard/messages/t-perez' };

const bill = (id: string, name: string, amountPhp: number, dueOn: string): DueFeeBill => ({
  orderId: `S89O-LAB${id.toUpperCase().padEnd(7, '0').slice(0, 7)}`,
  amountPhp,
  eventId: id,
  coupleName: name,
  dueOn,
  introducedOn: '2026-10-12',
});

type Sup = {
  name: string;
  categoryWord: string;
  pools: Array<{ id: string; name: string }>;
  upcoming: UpcomingEventRow[];
  outside: ReturnType<typeof out>[];
  desk: WhatsNewCard[];
  ask: { card: WhatsNewCard; price: number; freeUsed: number };
  bills: DueFeeBill[];
  lockedBill: DueFeeBill | null;
  owedPhp: number;
  credit: { creditPhp: number; tierExpiresAt: string } | null;
  payout: SupplierTodayInput['payoutReadiness'];
  details: { done: number; total: number; complete: boolean };
  views: number;
  asked: number;
  award: string | null;
  milestone: string | null;
  holds?: Record<string, string[]>;
};

/* The fee each bill names is the default schedule's own figure — `bookingFeePhp`, computed, never typed. */
const feeOf = (price: number) => bookingFeePhp(price, BOOKING_FEE);

const SUPS: Record<EasySupplier, Sup> = {
  studio: {
    name: 'Lumina Studio',
    categoryWord: 'Photo & video',
    pools: [
      { id: 'main', name: 'Main team' },
      { id: 'second', name: 'Second team' },
    ],
    upcoming: [
      up('reyes', 'Reyes debut', '2026-10-17', 'Tagaytay', 'main'),
      up('cruz', 'Cruz wedding', '2026-10-18', 'Makati Shangri-La', 'main', 150),
      up('bautista', 'Bautista christening', '2026-10-24', 'Quezon City', 'second'),
      up('santos', 'Santos wedding', '2026-12-05', 'Taal Vista', 'main'),
      up('lt', 'Lim & Tan wedding', '2026-12-12', 'Manila Cathedral', 'main'),
    ],
    outside: [out('o1', 'Tan corporate', '2026-12-05', 'second'), out('o2', 'Perez anniversary', '2026-12-12', 'second')],
    desk: [CONTRACT, QUOTE, DATE_CHANGE, del('dizon', 'Dizon debut', '2026-12-12'), done('rd', 'Reyes debut', '2026-10-10'), REVIEW, inquiry('am', 'Ana & Miguel', '2026-12-12', 'Hi! Are you free on Dec 12? We love your Tagaytay wedding. About 150 guests.', 2), DISPUTE],
    ask: { card: ask('rc', 'Rolando & Carmen', '2026-12-26', 20), price: 85_000, freeUsed: 5 },
    bills: [bill('lt', 'Lim & Tan wedding', feeOf(85_000), '2026-10-20')],
    lockedBill: bill('cruz', 'Cruz wedding', feeOf(85_000), '2026-10-10'),
    owedPhp: 186_000,
    credit: { creditPhp: 1_200, tierExpiresAt: '2026-10-17T15:59:00Z' },
    payout: 'ready',
    details: { done: 6, total: 6, complete: true },
    views: 312,
    asked: 14,
    award: "Setnayan's Top Pick · Makati",
    milestone: 'your 7th anniversary in 12 days',
  },
  parish: {
    name: 'San Agustin Parish',
    categoryWord: 'Church',
    pools: [
      { id: 'church', name: 'Church' },
      { id: 'chapel', name: 'Chapel' },
    ],
    upcoming: [up('mc', 'Mendoza & Cruz', '2026-10-17', 'Intramuros', 'church', 150), up('rs', 'Reyes & Santos', '2026-12-05', 'Intramuros', 'church')],
    outside: [out('o1', 'Ramos', '2026-10-24', 'chapel'), out('o2', 'Villanueva', '2026-12-12', 'church'), out('o3', 'Garcia', '2026-12-19', 'chapel')],
    desk: [inquiry('dc', 'Dela Cruz', '2026-12-12', 'Good morning po. Is the church free on 12 December, 3 PM? We are about 120 guests.', 49)],
    ask: { card: ask('dcz', 'Dela Cruz', '2026-12-12', 6), price: 15_000, freeUsed: 1 },
    bills: [],
    lockedBill: bill('mc', 'Mendoza & Cruz', feeOf(15_000), '2026-10-10'),
    owedPhp: 23_000,
    credit: null,
    payout: 'none',
    details: { done: 4, total: 6, complete: false },
    views: 48,
    asked: 6,
    award: null,
    milestone: null,
  },
  caterer: {
    name: "Tita Nena's Catering",
    categoryWord: 'Caterer',
    pools: [{ id: 'main', name: "Tita Nena's" }],
    upcoming: [up('bb', 'Bautista christening', '2026-10-18', 'Quezon City', 'main', 60), up('ow', 'Ocampo wedding', '2026-12-19', 'Tagaytay', 'main')],
    outside: [out('o1', 'Lim · 60 guests', '2026-10-31', 'main'), out('o2', 'Barangay Christmas party', '2026-12-12', 'main')],
    desk: [done('sb', 'Santos birthday', '2026-10-11'), inquiry('ko', 'Katrina Ocampo', '2026-12-19', 'Hi po! Do you have buffet for 80 on Dec 19 in Tagaytay? Budget around ₱40k.', 20), LAPSED],
    ask: { card: ask('kat', 'Katrina Ocampo', '2026-12-19', 8), price: 44_650, freeUsed: 2 },
    bills: [bill('bb', 'Bautista christening', feeOf(27_000), '2026-10-17')],
    lockedBill: null,
    owedPhp: 48_000,
    credit: null,
    payout: 'ready',
    details: { done: 6, total: 6, complete: true },
    views: 120,
    asked: 9,
    award: null,
    milestone: null,
  },
  venue: {
    name: 'Casa Alegria Events',
    categoryWord: 'Reception venue',
    pools: [
      { id: 'A', name: 'Hall A' },
      { id: 'B', name: 'Hall B' },
      { id: 'C', name: 'Hall C' },
    ],
    upcoming: [up('villar', 'Villar wedding', '2026-10-17', 'Grand Hall', 'A', 400), up('reyes', 'Reyes wedding', '2026-12-12', 'Hall A', 'A'), up('gt', 'Go & Tan wedding', '2026-12-19', 'A + B', 'A')],
    outside: [out('o1', 'Rotary lunch', '2026-10-24', 'C'), out('o2', 'Dizon christening', '2026-12-05', 'B')],
    desk: [done('rdb', 'Reyes debut', '2026-10-10'), inquiry('sl', 'Santos & Lim', '2026-12-12', 'Hi! Can we have Halls A and B joined on 12 December? Around 300 guests.', 1)],
    ask: { card: ask('slk', 'Santos & Lim', '2026-12-12', 1), price: 130_000, freeUsed: 5 },
    bills: [],
    lockedBill: bill('villar', 'Villar wedding', feeOf(200_000), '2026-10-12'),
    owedPhp: 260_000,
    credit: null,
    payout: 'ready',
    details: { done: 6, total: 6, complete: true },
    views: 410,
    asked: 22,
    award: null,
    milestone: null,
    holds: { 'ev-slk': ['A'] },
  },
};

function forecastFor(price: number, freeUsed: number): FeeDisclosure | null {
  return bookingFeeForecast(
    freeUsed < 5
      ? { kind: 'free', ordinal: freeUsed + 1, ordinalIsFrozen: false, schedule: BOOKING_FEE }
      : { kind: 'billable', ordinal: freeUsed + 1, ordinalIsFrozen: false, schedule: BOOKING_FEE },
    price,
  );
}

export function TodayEasyLab({ sup: supKey, moment, actions }: { sup: EasySupplier; moment: EasyMoment; actions: TodayActions }) {
  const sup = SUPS[moment === 'hallask' ? 'venue' : supKey];
  const setup = moment === 'setup';
  const withAsk = moment === 'ask' || moment === 'hallask' || moment === 'agreed';
  const desk = setup ? [] : withAsk && moment !== 'agreed' ? [sup.ask.card, ...sup.desk] : sup.desk;
  const { answer: needsAnswer, news: closed } = splitDesk(desk);

  // 🌑 Event day: the first booking is TODAY (its date moved to the lab's today).
  const upcoming = setup
    ? []
    : moment === 'eventday'
      ? [{ ...sup.upcoming[1]!, date: TODAY, inDays: 0 }, ...sup.upcoming.filter((_, i) => i !== 1)]
      : sup.upcoming;
  const bills = setup ? [] : moment === 'locked' && sup.lockedBill ? [sup.lockedBill, ...sup.bills] : moment === 'agreed' ? [bill('rc', sup.ask.card.kind === 'lock_request' ? sup.ask.card.coupleName : 'Couple', feeOf(sup.ask.price), '2026-10-21'), ...sup.bills] : sup.bills;

  const firstSteps = setup
    ? buildFirstStepsRail({
        verified: false,
        profileDone: 4,
        profileTotal: 6,
        serviceCount: 0,
        docsStatus: 'none',
        docsIn: 0,
        docsTotal: 4,
        submitMissing: ['Finish your business profile'],
        customerCount: 0,
      })
    : null;

  const view = assembleSupplierToday({
    needsAnswer,
    closed,
    deskIncomplete: false,
    upcoming,
    schedules: { pools: setup ? [] : sup.pools, outside: setup ? [] : sup.outside, complete: true },
    firstSteps,
    verified: !setup,
    findable: !setup,
    findability: null,
    feeBills: bills,
    feeEnforced: true, // production measured 2026-10-14: the fee lock IS enforced
    earnings: { confirmedPhp: 0, expectedPhp: setup ? 0 : sup.owedPhp, paydayMeasured: true },
    credit: setup || !sup.credit ? null : { ...sup.credit, href: '/vendor-dashboard/subscription' },
    payoutReadiness: setup ? 'unreadable' : sup.payout,
    payoutHref: '/vendor-dashboard/shop?open=payments#shop-folds',
    shop: {
      name: sup.name,
      categoryWord: sup.categoryWord,
      details: setup ? { done: 4, total: 6, complete: false } : sup.details,
      awardWord: setup ? null : sup.award,
      milestoneWord: setup ? null : sup.milestone,
    },
    views: setup ? null : sup.views,
    inquiries28: setup ? null : sup.asked,
    askDayHolds: sup.holds,
    dayFacts:
      moment === 'eventday'
        ? { startedAt: '12:00', next: { time: '3:30', label: 'Reception' }, line: '12:00 Ceremony · 3:30 Reception · 6:30 First dance', checkedIn: 118 }
        : null,
    todayIso: TODAY,
    now: NOW,
    since: (c) => new Date(sinceOf(c)),
  });

  const forecasts: Record<string, FeeDisclosure | null> = {};
  if (sup.ask.card.kind === 'lock_request') forecasts[sup.ask.card.eventVendorId] = forecastFor(sup.ask.price, sup.ask.freeUsed);

  // The yes, said back: `vendorAgreeToLock` redirected with `lock_agree=ok&fee=held` — the shipped sentence + door.
  const agreed = moment === 'agreed' ? lockAgreeNotice('ok', { feeHeld: true }) : null;
  const outcome: TodayOutcome | null = agreed ? { text: agreed.text, tone: 'ok', door: agreed.door ?? null } : null;

  return (
    <div className="min-h-screen bg-cream px-4 pb-32 pt-4" data-supplier-lab="today-easy" data-easy-moment={moment} data-easy-sup={supKey}>
      <SupplierTodayScreen view={view} outcome={outcome} feeForecasts={forecasts} cards={desk} askStatus="" deskIncomplete={false} actions={actions} />
    </div>
  );
}

/** When a lab card started waiting — the page uses `cardTimestamp`; the lab reads each fixture's own stamp. */
function sinceOf(c: WhatsNewCard): string {
  switch (c.kind) {
    case 'inquiry':
    case 'review':
    case 'quote_draft':
    case 'contract_draft':
    case 'dispute':
    case 'mark_complete':
      return c.createdAt;
    case 'lock_request':
    case 'lock_request_lapsed':
    case 'delete_request':
      return c.requestedAt;
    case 'date_change':
      return c.askedAt;
    case 'lock':
      return c.recordedAt;
    case 'message':
      return c.lastMessageAt;
    case 'meeting':
      return c.proposedAt;
  }
}
