import Link from 'next/link';
import { RotateCw } from 'lucide-react';
import { Fold } from '@/app/_components/fold';
import { BookingFeeBills, WaivedFeeRows } from '@/app/_components/booking-fee-notice';
import { formatPhp } from '@/lib/php';
import { formatCount } from '@/lib/format-number';
import type { DueFeeBill, FeeDisclosure, WaivedFeeCharge } from '@/lib/booking-fee-disclosure';
import { VENDOR_BOOKING_FEES_PATH } from '@/lib/vendor-booking-fees';
import { MONEY_WINDOW_LABEL, MONEY_WINDOWS, type MoneyRow, type MoneyTotals, type MoneyWindow, type MoneyYear } from '@/lib/vendor-money';
import type { Paged } from '@/lib/paginate';
import { ListPager } from '../../_components/list-pager';
import { CustomersPick } from './customers-pick';
import { DatesRow } from './dates-row';
import { MoneyFill, PesoCount } from './money-figures';

/**
 * CUSTOMERS › MONEY — the segment, drawn (S-PR4; plan § 2 "Merge into Customers › Money: Received · To come in · one
 * meter; 'Next in ▾' rows …; 'Setnayan' group = booking-fee bills (Pay) + 'This year' fold (months). Legacy payouts
 * → inside 'This year' only if any exist"; prototype frames 05 · 30).
 *
 *   Received · To come in   two figures that count to their value (kind 32 `Fill` meter under them), no frame, a
 *                           divider below. Unread → "Couldn't load · Retry" in the figures' own place (frame 15).
 *   Next in ▾               ONE dropdown (This month · Next month · All), one hairline row per instalment still to
 *                           come in: the customer · what it is and when · the amount · a state badge · the arrow.
 *   Setnayan                the shop's booking-fee bills (one row each, Pay — the pay page is the confirm + pay
 *                           step), the waived ones (a "Waived" badge), and a row to every bill and receipt.
 *   This year ⌄             the confirmed payments by month; the pre-2026 payout records only when any exist.
 *
 * Read-only rows are rows, not buttons (owner 2026-10-13). The ONE main on this screen is the thumb row's Log a
 * payment (`money-log.tsx`).
 *
 * Server component: every figure arrives read and decided (`lib/vendor-money.ts`); the fee rows' words come from
 * `lib/booking-fee-disclosure.ts` through `booking-fee-notice.tsx` — nothing here words or sums a fee.
 */

export type MoneyLegacyPayout = {
  key: string;
  reference: string;
  line: string;
  /** Null ⇒ the amount was not read; a dash, never ₱0. */
  amountPhp: number | null;
  badge: { tone: 'ok' | 'wait' | 'no'; word: string };
};

export type MoneyViewData = {
  today: string;
  /** Null ⇒ the payday read did not reach the end. */
  totals: MoneyTotals | null;
  window: MoneyWindow;
  /** Each window's own address (`?seg=money&next=`). */
  windowHref: (w: MoneyWindow) => string;
  rows: Paged<MoneyRow>;
  /** Instalments still to come in, any window. */
  openCount: number;
  /** Where a row goes — the customer's card. */
  rowHref: (eventId: string) => string;
  /** This list's own pager param, and every other param to keep. */
  pager: { param: string; keep: string };
  /** Where "Retry" reloads. */
  retryHref: string;
  fees: {
    /** False ⇒ the bills were not read: said, never "you owe nothing". */
    billsRead: boolean;
    bills: DueFeeBill[];
    copyFor: (b: DueFeeBill) => FeeDisclosure;
    waived: WaivedFeeCharge[];
  };
  /** 'locked' ⇒ the plan does not carry the year view; null ⇒ the ledger was not read. */
  year: MoneyYear | null | 'locked';
  /** The plan's line for a locked year (names the booking fee — `bookingFeeScheduleSummary`). */
  lockedLine?: string;
  /** Pre-cutover payout records. Null ⇒ not read; [] ⇒ none (nothing drawn). */
  legacy: MoneyLegacyPayout[] | null;
};

/** The waived bills Money shows in place; the rest are one tap on, on the Booking fees page. */
const WAIVED_SHOWN = 3;

export function MoneyView({ data }: { data: MoneyViewData }) {
  const { totals, rows, fees, year } = data;
  const windowOptions = MONEY_WINDOWS.map((w) => ({ key: w, label: MONEY_WINDOW_LABEL[w], href: data.windowHref(w) }));

  return (
    <div data-customers-money="">
      {/* ── RECEIVED · TO COME IN · the meter (frame 05's top block) ── */}
      <section className="border-b border-ink/10 pb-3 pt-4" data-money-totals={totals ? 'read' : 'unread'} aria-label="Your money">
        {totals ? (
          <>
            <div className="grid grid-cols-2 gap-x-5 gap-y-1">
              <div>
                <p className="home-k2">Received</p>
                <PesoCount value={totals.receivedPhp} id="money-received" className="block text-[22px] font-semibold leading-tight" tone="ok" />
              </div>
              <div>
                <p className="home-k2">To come in</p>
                <PesoCount value={totals.toComePhp} id="money-to-come" className="block text-[22px] font-semibold leading-tight text-ink" />
              </div>
            </div>
            {totals.pct !== null ? (
              <div className="mt-3" data-money-meter="">
                <div className="h-2 overflow-hidden rounded-full bg-ink/10">
                  <MoneyFill value={totals.pct} id="money-received-of-booked" />
                </div>
                <p className="mt-1.5 text-[12.5px] text-ink/60">
                  {formatCount(totals.pct)}% of {formatPhp(totals.bookedPhp)} booked
                  {totals.overdue > 0 ? ` · ${formatCount(totals.overdue)} overdue` : ''}
                  {totals.unresolved > 0 ? ` · ${formatCount(totals.unresolved)} with no amount set` : ''}
                </p>
              </div>
            ) : (
              <p className="mt-2 text-[13px] text-ink/60" data-money-none="">
                No payment plans yet — a couple&rsquo;s plan shows here once they book you.
              </p>
            )}
          </>
        ) : (
          // ⚠ NOT ₱0. A payday read that did not reach the end is said in the figures' own place (frame 15).
          <div className="flex min-h-[60px] items-center gap-3" role="status" data-money-unread="">
            <p className="min-w-0 flex-1 text-[14px] text-ink/70">
              <b className="font-semibold text-ink">Couldn&rsquo;t load your payments.</b> Nothing is lost — the figures are hidden, not zero.
            </p>
            <Link href={data.retryHref} className="sn-press inline-flex min-h-11 shrink-0 items-center gap-1.5 text-[14px] font-semibold text-sn-accent">
              <RotateCw aria-hidden className="h-4 w-4" strokeWidth={2} /> Retry
            </Link>
          </div>
        )}
      </section>

      {/* ── NEXT IN ▾ — one row per instalment still to come in ── */}
      {totals && totals.bookings > 0 ? (
        <>
          <div className="mt-4 flex min-h-11 items-center gap-3" data-money-eyebrow="">
            <span className="home-k2">Next in</span>
            <CustomersPick label="Next in" value={data.window} options={windowOptions} dataAttr="data-money-window" compact className="!min-h-11" />
          </div>
          <div id="money-rows" className="scroll-mt-24" data-money-rows="">
            {rows.items.length === 0 ? (
              data.window !== 'all' && data.openCount > 0 ? (
                <DatesRow
                  data="money-none-here"
                  title={data.window === 'month' ? 'Nothing due this month' : 'Nothing due next month'}
                  line={`${formatCount(data.openCount)} still to come in later`}
                  href={data.windowHref('all')}
                />
              ) : (
                <DatesRow data="money-all-in" title="Everything is in" line="No payment is waiting on a couple" />
              )
            ) : (
              rows.items.map((r) => (
                <DatesRow
                  key={r.key}
                  data="money-row"
                  title={r.title}
                  line={r.line}
                  strong={<span className="text-[15px]">{formatPhp(r.amountPhp)}</span>}
                  badge={r.badge}
                  href={data.rowHref(r.eventId)}
                />
              ))
            )}
          </div>
          {rows.pageCount > 1 ? <ListPager paged={rows} param={data.pager.param} keepParams={data.pager.keep} hash="money-rows" noun="payments" /> : null}
        </>
      ) : null}

      {/* ── SETNAYAN — the shop's own bills from Setnayan, then the year ── */}
      <div className="mt-5 flex min-h-11 items-center" data-money-eyebrow="setnayan">
        <span className="home-k2">Setnayan</span>
      </div>
      <div data-money-setnayan="">
        {fees.billsRead ? (
          <BookingFeeBills compact bills={fees.bills} copyFor={fees.copyFor} />
        ) : (
          <DatesRow data="fees-unread" title="Booking fees couldn’t load" line="Reload to see what is due — nothing is lost" href={data.retryHref} />
        )}
        <WaivedFeeRows compact charges={fees.waived.slice(0, WAIVED_SHOWN)} />
        <DatesRow
          data="fees-all"
          title="Booking fees"
          line={fees.waived.length > WAIVED_SHOWN ? `Every bill and receipt · ${formatCount(fees.waived.length - WAIVED_SHOWN)} more waived` : 'Every bill and receipt'}
          href={VENDOR_BOOKING_FEES_PATH}
        />

        <div className="border-t border-ink/10" data-money-fold="year">
          <Fold title="This year" line={yearLine(year)} data="money-year">
            <div className="pb-3" data-money-year-body="">
              {year === 'locked' ? (
                <p className="py-2 text-[13.5px] text-ink/70" data-money-year-locked="">
                  {data.lockedLine}{' '}
                  <Link href="/vendor-dashboard/subscription" className="inline-flex min-h-11 items-center font-semibold text-sn-accent">
                    See plans
                  </Link>
                </p>
              ) : year === null ? (
                <p className="py-2 text-[13.5px] text-ink/70" role="status" data-money-year-unread="">
                  Couldn&rsquo;t load your year — a failed read, not a year with nothing in it. Reload to try again.
                </p>
              ) : year.months.length === 0 ? (
                <p className="py-2 text-[13.5px] text-ink/60">
                  Nothing confirmed yet this year. When a couple logs a payment to you on their booking and you confirm it, it rolls up here.
                </p>
              ) : (
                year.months.map((m) => (
                  <DatesRow
                    key={m.ym}
                    data="money-month"
                    title={m.label}
                    line={`${formatCount(m.payments)} payment${m.payments === 1 ? '' : 's'}`}
                    strong={<span className="text-[15px]">{formatPhp(m.php)}</span>}
                  />
                ))
              )}
              {data.legacy === null ? (
                <p className="py-2 text-[13px] text-ink/60" role="status" data-money-legacy-unread="">
                  Your older payout records couldn&rsquo;t load. Nothing owed to you has changed.
                </p>
              ) : data.legacy.length > 0 ? (
                <div className="mt-3" data-money-legacy="">
                  <p className="home-k2">Before direct payments</p>
                  {data.legacy.map((p) => (
                    <DatesRow
                      key={p.key}
                      data="money-legacy"
                      title={p.reference}
                      line={p.line}
                      strong={<span className="text-[15px]">{formatPhp(p.amountPhp)}</span>}
                      badge={p.badge}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          </Fold>
        </div>
      </div>
    </div>
  );
}

/** The year fold's one line — "₱186,000 received · 9 payments", or why there is no figure. */
function yearLine(year: MoneyYear | null | 'locked'): string {
  if (year === 'locked') return 'Comes with Solo';
  if (year === null) return 'Couldn’t load';
  if (year.payments === 0) return 'Nothing confirmed yet';
  return `${formatPhp(year.receivedPhp)} received · ${formatCount(year.payments)} payment${year.payments === 1 ? '' : 's'}`;
}

