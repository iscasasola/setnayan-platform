/**
 * The Budget lab's ledger — the approved prototype's own figures
 * (`prototypes/budget_page_2026-10-08_fable.html`, `const S`), fed through the
 * REAL resolver core so the lab draws what `computeEventMoney` returns, not
 * numbers typed into a component:
 *
 *   target ₱2,250,000 · agreed ₱1,189,397 · paid ₱194,997 · owed ₱994,400
 *   next ₱528,000 · Seda Vertis North · Oct 5
 *
 * Fixture data only. No database, no event.
 */
import { computeEventMoney, type EventMoney, type MoneyReadStatus } from '@/lib/budget-truth';
import type { SupplierPayment } from '@/app/dashboard/[eventId]/budget/_components/budget-screen';

const E = '00000000-0000-4000-8000-000000000000';
/** The prototype was drawn in early October 2026; the clock is pinned so due states do not drift. */
export const LAB_NOW = new Date('2026-10-01T04:00:00Z');

export function labMoney(reads?: MoneyReadStatus): EventMoney {
  const ordersFailed = reads?.orders === 'failed';
  return computeEventMoney({
    targetCentavos: 225_000_000,
    vendors: [
      { vendor_id: 'sv', event_id: E, category: 'venue', vendor_name: 'Seda Vertis North', status: 'contracted', total_cost_php: 1_056_000 },
      { vendor_id: 'sd', event_id: E, category: 'religious_venue', vendor_name: 'Santuario de San Vicente de Paul', status: 'contracted', total_cost_php: 26_499 },
    ],
    lineItems: [
      { line_item_id: 'sv-1', vendor_id: 'sv', label: 'Reservation', amount_php: 105_600, due_date: '2026-08-02' },
      { line_item_id: 'sv-2', vendor_id: 'sv', label: 'Second payment', amount_php: 528_000, due_date: '2026-10-05' },
      { line_item_id: 'sv-3', vendor_id: 'sv', label: 'Balance', amount_php: 422_400, due_date: '2026-12-04' },
    ],
    payments: [
      { payment_id: 'p1', vendor_id: 'sv', line_item_id: 'sv-1', amount_php: 105_600, paid_at: '2026-08-02T03:00:00Z' },
      { payment_id: 'p2', vendor_id: 'sd', line_item_id: null, amount_php: 26_499, paid_at: '2026-07-21T03:00:00Z' },
    ],
    // A refused read contributes no rows — exactly what the resolver hands the core.
    orders: ordersFailed
      ? []
      : [
          { order_id: 'o1', description: 'Event Hub Pro', service_key: 'EVENT_HUB_PRO', requested_total_php: 2_499, confirmed_total_php: 2_499, status: 'paid', created_at: '2026-09-14T03:00:00Z' },
          { order_id: 'o2', description: 'Papic · 2 cameras', service_key: 'PAPIC', requested_total_php: 2_899, confirmed_total_php: 2_899, status: 'paid', created_at: '2026-09-14T03:05:00Z' },
          { order_id: 'o3', description: 'Live Watch', service_key: 'LIVE_WATCH', requested_total_php: 2_500, confirmed_total_php: 2_500, status: 'paid', created_at: '2026-09-30T03:00:00Z' },
        ],
    costs: [
      { cost_id: 'e1', plan_group_id: 'ceremony_venue', label: 'Church offering', amount_php: 15_000, paid_php: 15_000, due_date: null },
      { cost_id: 'e2', plan_group_id: 'attire', label: 'Entourage gowns', amount_php: 84_000, paid_php: 40_000, due_date: null },
    ],
    pricing: new Map(),
    packageLockedCentavos: new Map(),
    benchmarks: [],
    reads,
    now: LAB_NOW,
  });
}

/** How each fixture payment was made — the "· Bank transfer" a sheet's Paid row prints. */
export const LAB_PAYMENTS: Record<string, SupplierPayment[]> = {
  sv: [{ paymentId: 'p1', paidAt: '2026-08-02', amountPhp: 105_600, method: 'Bank transfer' }],
  sd: [{ paymentId: 'p2', paidAt: '2026-07-21', amountPhp: 26_499, method: 'GCash' }],
};
