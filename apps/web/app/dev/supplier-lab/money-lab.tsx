/**
 * Customers › Money on fixture data (S-PR4) — the REAL components, the prototype's own October (frames 05 · 30 · 15).
 * Drawn only by `/dev/supplier-lab` (404 in production). Nothing here reads or writes: the figures go through the
 * same pure module the page uses (`lib/vendor-money.ts`), the fee rows through the shipped fee copy.
 *
 *   ?s=money          Received · To come in · meter, Next in rows, two fee bills + one waived, This year (frame 05)
 *   ?s=money-waived   every fee waived — the Setnayan rows carry "Waived" (frame 30)
 *   ?s=money-locked   the year view on a plan without it — the fold says so and names the fee
 *   ?s=money-empty    no payment plan yet     ?s=money-fail  payday, fees and the year could not be read (frame 15)
 *   &next=next|all    the "Next in ▾" window   &open=log  the Log a payment sheet, open
 */
import type { PaydayInstallmentRow } from '@/lib/vendor-cashflow';
import type { EarningsView } from '@/lib/vendor-earnings-view';
import { feeDueCopy, type DueFeeBill, type WaivedFeeCharge } from '@/lib/booking-fee-disclosure';
import { moneyPicture, moneyWindowOf, moneyYear, type MoneyWindow } from '@/lib/vendor-money';
import { paginate } from '@/lib/paginate';
import { CustomersSegments } from '@/app/vendor-dashboard/customers/_components/customers-segments';
import { MoneyView } from '@/app/vendor-dashboard/customers/_components/money-view';
import { MoneyLog } from '@/app/vendor-dashboard/customers/_components/money-log';
import { SupplierThumbRow } from '@/app/vendor-dashboard/_components/supplier-thumb-row';

export const MONEY_STATES = ['money', 'money-waived', 'money-locked', 'money-empty', 'money-fail'] as const;
export type MoneyState = (typeof MONEY_STATES)[number];

const TODAY = '2026-10-02'; // Fri Oct 2 in Manila (the lab's NOW)

const inst = (
  ev: string,
  name: string,
  seq: number,
  label: string,
  amount: number | null,
  due: string | null,
  confirmed: boolean,
): PaydayInstallmentRow => ({
  event_vendor_id: `ev-${ev}`,
  event_id: ev,
  event_name: name,
  event_date: null,
  seq,
  label,
  amount_php: amount,
  due_date: due,
  confirmed,
});

/** The prototype's customers: Cruz owes the balance on the 3rd, Bautista on the 8th, Ocampo's deposit is late. */
const PAYDAY: PaydayInstallmentRow[] = [
  inst('cruz', 'Jun & Liza Cruz', 1, 'First payment', 43_000, '2026-08-20', true),
  inst('cruz', 'Jun & Liza Cruz', 2, 'Final payment', 42_000, '2026-10-03', false),
  inst('bautista', 'Lourdes Bautista', 1, 'First payment', 9_000, '2026-09-10', true),
  inst('bautista', 'Lourdes Bautista', 2, 'Final payment', 6_000, '2026-10-08', false),
  inst('ocampo', 'Katrina Ocampo', 1, 'First payment', 15_000, '2026-09-28', false),
  inst('ocampo', 'Katrina Ocampo', 2, 'Final payment', 35_000, '2026-11-20', false),
  inst('reyes', 'Reyes debut', 1, 'Full payment', 134_000, '2026-09-15', true),
  inst('santos', 'Santos wedding', 1, 'First payment', null, null, false),
];

const BILLS: DueFeeBill[] = [
  { orderId: 'S89O-LAB0000011', amountPhp: 2500, eventId: 'cruz', coupleName: 'Jun & Liza Cruz', dueOn: '2026-10-10' },
  { orderId: 'S89O-LAB0000012', amountPhp: 837.5, eventId: 'bautista', coupleName: 'Lourdes Bautista', dueOn: '2026-09-30' },
];
const WAIVED: WaivedFeeCharge[] = [
  { chargeId: 'ch-lab-1', eventId: 'reyes', coupleName: 'Reyes debut', computedPhp: 2500, ordinal: 2, waivedOn: '2026-09-02' },
];
const ALL_WAIVED: WaivedFeeCharge[] = [
  { chargeId: 'ch-lab-2', eventId: 'cruz', coupleName: 'Jun & Liza Cruz', computedPhp: 2500, ordinal: 3, waivedOn: '2026-09-21' },
  { chargeId: 'ch-lab-3', eventId: 'bautista', coupleName: 'Lourdes Bautista', computedPhp: 837.5, ordinal: 4, waivedOn: '2026-09-25' },
  ...WAIVED,
];

const month = (ym: string, label: string, total: number, n: number) => ({ ym, label, total_php: total, order_count: n });
const YEAR: Pick<EarningsView, 'measured' | 'ytdPhp' | 'months'> = {
  measured: true,
  ytdPhp: 186_000,
  months: [
    month('2026-07', 'Jul 2026', 0, 0),
    month('2026-08', 'Aug 2026', 43_000, 1),
    month('2026-09', 'Sep 2026', 143_000, 2),
    month('2026-10', 'Oct 2026', 0, 0),
  ],
};

export function MoneyLab({ state, next, open, mpage }: { state: MoneyState; next?: string; open?: string; mpage?: string }) {
  const base = `/dev/supplier-lab?s=${state}`;
  const window = moneyWindowOf(next);
  const fail = state === 'money-fail';
  const picture = moneyPicture(fail ? null : state === 'money-empty' ? [] : PAYDAY, window, TODAY);
  const windowHref = (w: MoneyWindow) => (w === 'month' ? base : `${base}&next=${w}`);
  const customers = picture.customers.map((c) => ({ ...c, href: `/dev/supplier-lab?s=people` }));

  return (
    <div className="min-h-screen bg-cream px-4 pb-32 pt-4" data-supplier-lab={state}>
      <div className="space-y-4">
        <CustomersSegments seg="money" hrefOf={(s) => (s === 'money' ? base : `/dev/supplier-lab?s=${s}`)} />
      </div>
      <MoneyView
        data={{
          today: TODAY,
          totals: picture.totals,
          window,
          windowHref,
          rows: paginate(picture.rows, mpage),
          openCount: picture.openCount,
          rowHref: () => '/dev/supplier-lab?s=people',
          pager: { param: 'mpage', keep: `s=${state}${next ? `&next=${next}` : ''}` },
          retryHref: base,
          fees: {
            billsRead: !fail,
            bills: fail || state === 'money-empty' || state === 'money-waived' ? [] : BILLS,
            copyFor: (b) => feeDueCopy(b, TODAY),
            waived: fail || state === 'money-empty' ? [] : state === 'money-waived' ? ALL_WAIVED : WAIVED,
          },
          year: state === 'money-locked' ? 'locked' : fail ? null : state === 'money-empty' ? moneyYear({ measured: true, ytdPhp: 0, months: [] }, TODAY) : moneyYear(YEAR, TODAY),
          lockedLine: 'Totals by month start with Solo. Couples pay you directly and we never take a cut — Setnayan bills you a booking fee, only on the couples we introduce.',
          legacy: fail ? null : [],
        }}
      />
      <SupplierThumbRow name="money" label="Money actions">
        <MoneyLog customers={customers} startOpen={open === 'log'} />
      </SupplierThumbRow>
    </div>
  );
}
