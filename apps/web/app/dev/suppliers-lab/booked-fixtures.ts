/**
 * /dev/suppliers-lab — the BOOKED body's fixtures (the approved prototype's
 * "mid" seed, `prototypes/suppliers_page_2026-10-07_fable.html`, plus the
 * states it reaches):
 *
 *   Hiraya Table        asked to book at ₱216,000 — waiting for their yes
 *   Seda Vertis North   booked, added by the couple, ₱1,056,000 — a first
 *                       payment of ₱528,000 due Oct 5, the balance Dec 11
 *   Santuario           booked on Setnayan, no price recorded
 *   Lumina Studio       booked, ₱85,000, paid in full
 *   Bituin Catering     booked on Setnayan, ₱190,000 — THEIR OWN payment plan
 *                       (a reservation due Oct 8) and three published ways to pay
 *   Asukal Cakes        booked, added by the couple, no price recorded
 *
 * Nothing is typed as a RESULT: the rows go through the real `teamRows` and
 * the money through the real resolver core (`computeEventMoney`), so the lab
 * draws what the page would derive from these rows.
 *
 *   &lines=0      Seda with no payment lines (an agreed total, nothing dated)
 *   &fail=money   the ledger's supplier read is refused
 *   &fail=team    the team read is refused
 *   &booked=0     nothing booked and nobody asked
 *   &fail=orders  the ledger's Setnayan-orders read is refused
 *   &target=0     no budget set
 *   &room=sent|unread   the ceremony venue stated its room size / the read was refused
 *   &datechange=1       an open date change: one supplier deciding, one can move
 *   &seed=proto   ONLY the prototype's two booked rows (Seda · Santuario) — the
 *                 same state as its "mid" seed, for a side-by-side
 *   &seed=asked   …plus Hiraya Table waiting for their yes (its picture 08)
 */
import { computeEventMoney, type EventMoney, type MoneyReadStatus, type PaymentMoneyRow, type VendorMoneyRow } from '@/lib/budget-truth';
import { buildBudgetList } from '@/lib/budget-page-view';
import { bookedView, type BookedFacts, type BookedView } from '@/lib/booked-rows';
import { teamRows, type TeamRowFacts } from '@/lib/your-team-rows';
import { bookedBudgetBlock, type BookedBudgetBlock } from '@/lib/booked-budget';
import type { PlanProgress } from '@/lib/vendor-service-payment-schedules';
import { LAB_EVENT } from './fixtures';
import { summarizeDateChange, type DateChangeView } from '@/lib/date-change';
import type { RoomSizeAnswer } from '@/lib/booked-rows';
import { bituinSteps, type MoneyStage } from './money-pair';
import { earliestTaggedBlock } from '@/lib/coordinator-broadcasts';
import type { RosMetaMap } from '@/lib/schedule-ros';
import type { TaggedMoment } from '@/lib/booked-rows';
import { PLAN_DATE, seedMoments } from '../schedule-lab/lab-moments';

/**
 * 📅 WHO IS TAGGED ON WHICH MOMENT — the Schedule lab's own day (`lab-moments.ts`), re-tagged with THIS lab's booked
 * suppliers. Booked › Schedule draws these moments, and each Team row's call time is derived from them with the page's
 * own rule (`earliestTaggedBlock`) — so the two parts agree, as they do on the page. Asukal is on no moment ("No call
 * time yet"); `&calltimes=fail` refuses the read.
 */
export const LAB_SCHEDULE_TAGS: Readonly<Record<string, readonly string[]>> = {
  ingress: ['v-seda', 'v-bituin'],
  hmua: [],
  cer: ['v-santuario', 'v-lumina'],
  cock: ['v-bituin'],
  rec: ['v-seda', 'v-lumina'],
  prog: ['v-planner'],
};

export function labCallTimes(): Map<string, TaggedMoment> {
  const moments = seedMoments(PLAN_DATE, null, LAB_SCHEDULE_TAGS);
  const meta: RosMetaMap = new Map(moments.map((m) => [m.block_id, { responsible_party: null, responsible_vendor_ids: m.responsible_vendor_ids }]));
  const out = new Map<string, TaggedMoment>();
  for (const id of ['v-seda', 'v-santuario', 'v-lumina', 'v-asukal', 'v-bituin', 'v-planner']) {
    const b = earliestTaggedBlock(moments, meta, id);
    if (b) out.set(id, { startAt: b.start_at, label: b.label });
  }
  return out;
}
import { withBookedByPayment } from '@/lib/booked-by-payment';

/** The prototype was drawn in early October 2026; pinned so "by Oct 5" does not drift. */
export const LAB_BOOKED_NOW = new Date('2026-10-01T04:00:00Z');

const teamRow = (f: Partial<TeamRowFacts> & Pick<TeamRowFacts, 'vendorId' | 'name' | 'service'>): TeamRowFacts => ({
  logoUrl: null,
  status: 'contracted',
  lockRequestState: null,
  lockRequestExpiresAt: null,
  inBuild: false,
  lockGroupId: null,
  lockBlocked: null,
  inquiryStatus: null,
  threadId: null,
  pricePhp: null,
  depositStep: null,
  reviewStatus: null,
  quoteWaitingOnCouple: false,
  ...f,
});

const TEAM: TeamRowFacts[] = [
  teamRow({ vendorId: 'v-hiraya', name: 'Hiraya Table', service: 'Catering', status: 'shortlisted', lockRequestState: 'pending', lockRequestExpiresAt: '2026-10-06T04:00:00Z', threadId: 't-hiraya', pricePhp: 216_000, isVerified: true }),
  teamRow({ vendorId: 'v-seda', name: 'Seda Vertis North', service: 'Reception', pricePhp: 1_056_000, depositStep: 'due', threadId: 't-seda' }),
  teamRow({ vendorId: 'v-santuario', name: 'Santuario de San Vicente de Paul', service: 'Ceremony', depositStep: 'due', threadId: 't-santuario', isVerified: true }),
  teamRow({ vendorId: 'v-lumina', name: 'Lumina Studio', service: 'Photo & video', status: 'deposit_paid', pricePhp: 85_000, threadId: 't-lumina', isVerified: true }),
  teamRow({ vendorId: 'v-asukal', name: 'Asukal Cakes', service: 'Cake', depositStep: 'due' }),
  teamRow({ vendorId: 'v-bituin', name: 'Bituin Catering', service: 'Catering', pricePhp: 190_000, depositStep: 'due', threadId: 't-bituin', isVerified: true }),
];

const FACTS: BookedFacts[] = [
  { vendorId: 'v-hiraya', groupId: 'catering', own: false, shopId: 'p-hiraya', pricePhp: 216_000, threadId: 't-hiraya', moneyMoved: false, lockRequestExpiresAt: '2026-10-06T04:00:00Z' },
  { vendorId: 'v-seda', groupId: 'reception_venue', own: true, shopId: null, pricePhp: 1_056_000, threadId: 't-seda', moneyMoved: false, lockRequestExpiresAt: null },
  { vendorId: 'v-santuario', groupId: 'ceremony_venue', own: false, shopId: 'p-santuario', pricePhp: null, threadId: 't-santuario', moneyMoved: false, lockRequestExpiresAt: null },
  { vendorId: 'v-lumina', groupId: 'photography', own: false, shopId: 'p-lumina', pricePhp: 85_000, threadId: 't-lumina', moneyMoved: true, lockRequestExpiresAt: null },
  { vendorId: 'v-asukal', groupId: 'cake', own: true, shopId: null, pricePhp: null, threadId: null, moneyMoved: false, lockRequestExpiresAt: null },
  { vendorId: 'v-bituin', groupId: 'catering', own: false, shopId: 'p-bituin', pricePhp: 190_000, threadId: 't-bituin', moneyMoved: false, lockRequestExpiresAt: null },
];

export type LabBookedOptions = {
  /** Seda's two payment lines (the plan). Off = an agreed total with no dates. */
  lines: boolean;
  /** Which read is refused, if any. */
  fail: 'money' | 'team' | 'orders' | null;
  /** Off = a new event: nobody asked, nobody booked. */
  booked: boolean;
  /** Narrow the team to the prototype's own rows, for a side-by-side. */
  seed: 'proto' | 'asked' | null;
  /** Off = the couple has set no budget. */
  target: boolean;
  /** The reception venue's stated size: sent, not sent, or the read refused. */
  room: 'sent' | 'not_sent' | 'unread';
  /** The couple asked their suppliers to move the date; one is still deciding. */
  dateChange: boolean;
  /** Bituin's reservation at a stage of the money loop (`money-pair.ts`). */
  money?: MoneyStage;
  /** `&today=YYYY-MM-DD` — the lab's day for the rows AND the Pay sheet (one clock); left out, LAB_BOOKED_NOW. */
  today?: string | null;
  /**
   * `&paidbyhand=1` — "The Wedding Planner", added by hand and filed Shortlisted,
   * with ₱15,000 recorded paid. Its rows go through the REAL booked-if-paid
   * resolver (`withBookedByPayment`), so the lab shows what the page derives.
   */
  paidByHand?: boolean;
  /** `&calltimes=fail` — the Schedule read is refused: every row says it could not check, never "no call time". */
  callTimesFail?: boolean;
};

/** The hand-added planner's stored row, its payment, and what the resolver makes of it. */
const PLANNER_STORED = { vendor_id: 'v-planner', status: 'shortlisted', marketplace_vendor_id: null, manual_vendor_id: 'card-planner' } as const;
const PLANNER_PAYMENT = { payment_id: 'pay-planner', vendor_id: 'v-planner', line_item_id: null, amount_php: 15_000, paid_at: '2026-09-20T03:00:00Z' };
function plannerStatus(o: Pick<LabBookedOptions, 'paidByHand'>): string {
  return withBookedByPayment([PLANNER_STORED], o.paidByHand ? [PLANNER_PAYMENT] : [])[0]!.status;
}

/** The lab's clock: `&today=` when given (e.g. 2026-10-14 makes Seda's Oct 5 late), else LAB_BOOKED_NOW. */
export function labBookedNow(o: Pick<LabBookedOptions, 'today'>): Date {
  return o.today && /^\d{4}-\d{2}-\d{2}$/.test(o.today) ? new Date(`${o.today}T04:00:00Z`) : LAB_BOOKED_NOW;
}

const PROTO_ROWS: ReadonlySet<string> = new Set(['v-seda', 'v-santuario']);
const inSeed = (o: LabBookedOptions, vendorId: string) =>
  o.seed === null || PROTO_ROWS.has(vendorId) || (o.seed === 'asked' && vendorId === 'v-hiraya');

export function labBookedMoney(o: LabBookedOptions): EventMoney {
  const reads: MoneyReadStatus | undefined =
    o.fail === 'money'
      ? { suppliers: 'failed', orders: 'ok', costs: 'ok' }
      : o.fail === 'orders'
        ? { suppliers: 'ok', orders: 'failed', costs: 'ok' }
        : undefined;
  const none = !o.booked || o.fail === 'money';
  return computeEventMoneyAsLoaded({
    targetCentavos: o.target ? 225_000_000 : null,
    // A refused read contributes no rows — exactly what the resolver hands the core.
    vendors: none
      ? []
      : ([
          { vendor_id: 'v-seda', event_id: LAB_EVENT, category: 'venue', vendor_name: 'Seda Vertis North', status: 'contracted', total_cost_php: 1_056_000 },
          { vendor_id: 'v-santuario', event_id: LAB_EVENT, category: 'religious_venue', vendor_name: 'Santuario de San Vicente de Paul', status: 'contracted', total_cost_php: null, marketplace_vendor_id: 'p-santuario' },
          { vendor_id: 'v-lumina', event_id: LAB_EVENT, category: 'photographer', vendor_name: 'Lumina Studio', status: 'deposit_paid', total_cost_php: 85_000, marketplace_vendor_id: 'p-lumina' },
          { vendor_id: 'v-asukal', event_id: LAB_EVENT, category: 'cake_maker', vendor_name: 'Asukal Cakes', status: 'contracted', total_cost_php: null },
          { vendor_id: 'v-bituin', event_id: LAB_EVENT, category: 'catering', vendor_name: 'Bituin Catering', status: 'contracted', total_cost_php: 190_000, marketplace_vendor_id: 'p-bituin' },
          { vendor_id: 'v-hiraya', event_id: LAB_EVENT, category: 'catering', vendor_name: 'Hiraya Table', status: 'shortlisted', total_cost_php: 216_000, marketplace_vendor_id: 'p-hiraya' },
          ...(o.paidByHand
            ? [{ vendor_id: 'v-planner', event_id: LAB_EVENT, category: 'planner_coordinator', vendor_name: 'The Wedding Planner', status: 'shortlisted', total_cost_php: 60_000, manual_vendor_id: 'card-planner' } as VendorMoneyRow]
            : []),
        ] satisfies VendorMoneyRow[] as VendorMoneyRow[]).filter((v) => inSeed(o, v.vendor_id)),
    lineItems:
      none || !o.lines
        ? []
        : [
            { line_item_id: 'seda-1', vendor_id: 'v-seda', label: 'First payment', amount_php: 528_000, due_date: '2026-10-05' },
            { line_item_id: 'seda-2', vendor_id: 'v-seda', label: 'Balance', amount_php: 528_000, due_date: '2026-12-11' },
          ],
    payments: none
      ? []
      : ([
          { payment_id: 'pay-lumina', vendor_id: 'v-lumina', line_item_id: null, amount_php: 85_000, paid_at: '2026-09-12T03:00:00Z' },
          // Bituin's reservation, once the couple recorded it (`money-pair.ts`).
          ...(o.money === 'waiting' || o.money === 'received'
            ? [{ payment_id: 'pay-bituin-1', vendor_id: 'v-bituin', line_item_id: null, amount_php: 38_000, paid_at: '2026-10-03T02:00:00Z' }]
            : []),
          ...(o.paidByHand ? [PLANNER_PAYMENT] : []),
        ] as PaymentMoneyRow[]).filter((p) => inSeed(o, p.vendor_id)),
    orders: o.fail === 'orders' ? [] : [
      { order_id: 'o1', description: 'Event Hub Pro', service_key: 'EVENT_HUB_PRO', requested_total_php: 2_500, confirmed_total_php: 2_500, status: 'paid', created_at: '2026-09-14T03:00:00Z' },
    ],
    costs: [],
    pricing: new Map(),
    packageLockedCentavos: new Map(),
    benchmarks: [],
    reads,
    now: LAB_BOOKED_NOW,
  });
}

/** The money resolver's I/O wrapper passes the rows through booked-if-paid before the core reads them — so does the lab. */
function computeEventMoneyAsLoaded(input: Parameters<typeof computeEventMoney>[0]): EventMoney {
  return computeEventMoney({ ...input, vendors: withBookedByPayment(input.vendors, input.payments) });
}

/**
 * The small Budget block (B4), through the real `bookedBudgetBlock` over the
 * SAME `EventMoney` the rows are drawn from — as the page does.
 */
export function labBookedBudget(o: LabBookedOptions, money: EventMoney): BookedBudgetBlock {
  return bookedBudgetBlock(money, o.target ? 2_250_000 : null);
}

export function labBookedView(o: LabBookedOptions, money: EventMoney): BookedView {
  const team = o.booked
    ? [
        ...TEAM,
        ...(o.paidByHand
          ? [teamRow({ vendorId: 'v-planner', name: 'The Wedding Planner', service: 'Coordinator', status: plannerStatus(o), pricePhp: 60_000, threadId: 't-planner' })]
          : []),
      ].filter((t) => inSeed(o, t.vendorId))
    : [];
  const facts: BookedFacts[] = o.paidByHand
    ? [...FACTS, { vendorId: 'v-planner', groupId: 'coordinator', own: true, shopId: null, pricePhp: 60_000, threadId: 't-planner', moneyMoved: true, lockRequestExpiresAt: null }]
    : FACTS;
  const rows = teamRows(team, { eventId: LAB_EVENT, lockHandshakeEnabled: true, now: labBookedNow(o) });
  // Bituin's plan is THEIRS (`event_vendor_payment_plan`), folded as the page folds it.
  const plans = new Map<string, PlanProgress>([
    ['v-bituin', { steps: bituinSteps(o.money ?? 'due'), clearedAt: null, isDefaultSeeded: false }],
  ]);
  // Santuario is the one booked venue on Setnayan; Seda was added by the couple (no shop to ask).
  const rooms: Map<string, RoomSizeAnswer> | null =
    o.room === 'unread' ? null : new Map([['v-santuario', o.room === 'sent' ? { widthM: 18, lengthM: 24 } : 'not_sent']]);
  const dateChange: DateChangeView | null = o.dateChange
    ? summarizeDateChange({
        requestId: 'lab-date-change',
        proposedDate: '2026-12-19',
        proposedPrecision: 'day',
        fromDate: '2026-12-12',
        askedAt: '2026-09-30T04:00:00Z',
        rows: [
          { vendor_profile_id: 'p-santuario', event_vendor_id: 'v-santuario', answer: 'asked', due_at: '2026-10-03T04:00:00Z', answered_at: null, money_flag_id: null },
          { vendor_profile_id: 'p-lumina', event_vendor_id: 'v-lumina', answer: 'moved', due_at: '2026-10-03T04:00:00Z', answered_at: '2026-09-30T09:00:00Z', money_flag_id: null },
        ],
        names: new Map([['p-santuario', 'Santuario de San Vicente de Paul'], ['p-lumina', 'Lumina Studio']]),
        now: LAB_BOOKED_NOW.getTime(),
      })
    : null;
  return bookedView({
    rows,
    facts,
    money: buildBudgetList(money).suppliers,
    plans,
    rooms,
    dateChange,
    callTimes: o.callTimesFail ? null : labCallTimes(),
    now: labBookedNow(o),
  });
}
