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

/** The prototype was drawn in early October 2026; pinned so "by Oct 5" does not drift. */
export const LAB_BOOKED_NOW = new Date('2026-10-01T04:00:00Z');

const team = (f: Partial<TeamRowFacts> & Pick<TeamRowFacts, 'vendorId' | 'name' | 'service'>): TeamRowFacts => ({
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
  team({ vendorId: 'v-hiraya', name: 'Hiraya Table', service: 'Catering', status: 'shortlisted', lockRequestState: 'pending', lockRequestExpiresAt: '2026-10-06T04:00:00Z', threadId: 't-hiraya', pricePhp: 216_000, isVerified: true }),
  team({ vendorId: 'v-seda', name: 'Seda Vertis North', service: 'Reception', pricePhp: 1_056_000, depositStep: 'due', threadId: 't-seda' }),
  team({ vendorId: 'v-santuario', name: 'Santuario de San Vicente de Paul', service: 'Ceremony', depositStep: 'due', threadId: 't-santuario', isVerified: true }),
  team({ vendorId: 'v-lumina', name: 'Lumina Studio', service: 'Photo & video', status: 'deposit_paid', pricePhp: 85_000, threadId: 't-lumina', isVerified: true }),
  team({ vendorId: 'v-asukal', name: 'Asukal Cakes', service: 'Cake', depositStep: 'due' }),
  team({ vendorId: 'v-bituin', name: 'Bituin Catering', service: 'Catering', pricePhp: 190_000, depositStep: 'due', threadId: 't-bituin', isVerified: true }),
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
};

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
  return computeEventMoney({
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

/**
 * The small Budget block (B4), through the real `bookedBudgetBlock` over the
 * SAME `EventMoney` the rows are drawn from — as the page does.
 */
export function labBookedBudget(o: LabBookedOptions, money: EventMoney): BookedBudgetBlock {
  return bookedBudgetBlock(money, o.target ? 2_250_000 : null);
}

export function labBookedView(o: LabBookedOptions, money: EventMoney): BookedView {
  const team = o.booked ? TEAM.filter((t) => inSeed(o, t.vendorId)) : [];
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
  return bookedView({ rows, facts: FACTS, money: buildBudgetList(money).suppliers, plans, rooms, dateChange, now: labBookedNow(o) });
}
