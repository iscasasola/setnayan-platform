import { Info, ReceiptText } from 'lucide-react';
import { ORDER_STATUS_LABEL, formatPhp, type OrderRow, type OrderStatus } from '@/lib/orders';
import { feeOrderDescriptionNow, feeOrderTotalPhp, vendorBookingFeePayPath } from '@/lib/vendor-booking-fees';
import type { WaivedFeeCharge } from '@/lib/booking-fee-disclosure';
import type { BookingFeeSchedule } from '@/lib/booking-fee';
import { WaivedFeeRows } from '@/app/_components/booking-fee-notice';
import { BookingFeeLine } from '@/app/_components/booking-fee-line';
import { InfoTip } from '@/app/_components/info-tip';
import { FEE_NEW_CLIENT_DETAIL } from '@/lib/booking-fee-who-words';
import { ShopPill, type ShopPillTone } from '../_components/kit';
import { PartList, PartNote, PartPage, PartPin, PartRef, PartRow, PartSec, PartText } from '../_components/set-two/parts';
import { MONEY_NOT_OWED, ReadFailedNote } from '../_components/set-two/read-failed';

const ROUTE = '/vendor-dashboard/booking-fees';

/** A bill's status as a pill WORD in the supplier tokens — never colour alone (supplier pages set two, page 1). */
export function feeStatusTone(status: OrderStatus): Exclude<ShopPillTone, 'action' | 'gold'> {
  if (status === 'awaiting_payment' || status === 'submitted') return 'warn';
  if (status === 'paid' || status === 'fulfilled') return 'success';
  return 'ink';
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * Booking fees — the list, on the November look (owner-approved 21 Nov 2026, supplier pages set two, page 1), drawn
 * from the page's reads (the lab draws it from fixtures). Due · Paid · Closed, then Waived; each row opens its fee.
 * Every amount is the order's own and every fee sentence is the live schedule's (`BookingFeeLine`) — nothing is typed.
 *
 *   `orders: null`  — the fee orders could not be read (the shipped words, plus Try again in place);
 *   `waived: null`  — the waived fees could not be read (Honest state · new): said in their place, never a missing
 *                     section that reads as "you had no free bookings".
 */
export function BookingFeesBody({
  orders,
  due,
  settled,
  closed,
  totalDue,
  waived,
  schedule,
  launchLine,
  newClientLine = null,
  freeRule,
}: {
  orders: readonly OrderRow[] | null;
  due: readonly OrderRow[];
  settled: readonly OrderRow[];
  closed: readonly OrderRow[];
  /** null = the total could not be read. */
  totalDue: number | null;
  waived: readonly WaivedFeeCharge[] | null;
  schedule: BookingFeeSchedule | null;
  launchLine: string | null;
  /** The new-client window line (`feeNewClientLine`), or null when the setting was not read. */
  newClientLine?: string | null;
  /** The in-app free rule for the empty state's ⓘ (`feeFreeRuleInApp`); omitted → the component's own words. */
  freeRule?: string;
}) {
  return (
    <PartPage column="mx-auto w-full tab:max-w-3xl" mark="booking-fees">
      <PartPin route={ROUTE} title="Booking fees" />

      {launchLine ? (
        <PartText>
          <span data-fees-launch-offer="">{launchLine}</span>
        </PartText>
      ) : null}

      {/* 📅 The new-client window (owner 2026-11-16, #8086), its length read from settings — the supplier's own app
          only. Unread → no line, never a guessed number. */}
      {newClientLine ? (
        <PartText>
          <span data-fees-new-client-window="">
            <InfoTip label={newClientLine} ariaLabel="About free bookings for new clients">
              {FEE_NEW_CLIENT_DETAIL}
            </InfoTip>
          </span>
        </PartText>
      ) : null}

      {due.length > 0 ? (
        <PartNote tone="warn" icon={ReceiptText}>
          You have{' '}
          <strong>
            {due.length} unpaid {due.length === 1 ? 'fee' : 'fees'}
          </strong>
          {totalDue === null ? (
            <> — we couldn&rsquo;t load the total. Open each one below for the exact amount.</>
          ) : (
            <>
              {' '}
              totalling <strong>{formatPhp(totalDue)}</strong>.
            </>
          )}
        </PartNote>
      ) : null}

      {orders === null ? (
        <ReadFailedNote mark="booking-fees">
          <strong>We couldn&rsquo;t load your booking fees right now.</strong> {MONEY_NOT_OWED} Refresh in a moment.
        </ReadFailedNote>
      ) : orders.length === 0 ? (
        <PartNote tone="plain" icon={ReceiptText}>
          <strong>Nothing to pay yet.</strong>{' '}
          <BookingFeeLine fee={schedule} leadStyle={{ color: 'rgb(var(--color-ink))' }} freeRule={freeRule} /> A free
          booking fee ticket pays your next fee by itself.
        </PartNote>
      ) : (
        <>
          <FeeGroup title="Due" tone="warn" orders={due} />
          <FeeGroup title="Paid" tone="ok" orders={settled} />
          <FeeGroup title="Closed" orders={closed} />
        </>
      )}

      {/* THE FREE BOOKINGS, PRICED — outside the orders branch on purpose: a shop with no bill at all still has free
          bookings worth naming. An unread list is SAID (Honest state · new), never a section that is simply absent. */}
      {waived === null ? (
        <>
          <PartSec>Waived — nothing owed</PartSec>
          <ReadFailedNote mark="booking-fees-waived">
            We couldn&rsquo;t load your waived fees just now.
            {orders !== null ? ' Your other fees above are correct.' : null}
          </ReadFailedNote>
        </>
      ) : waived.length > 0 ? (
        <section>
          <PartSec>Waived — nothing owed</PartSec>
          <div className="px-3 pt-2 tab:px-0">
            <WaivedFeeRows charges={waived} />
          </div>
        </section>
      ) : null}
    </PartPage>
  );
}

function FeeGroup({ title, tone, orders }: { title: string; tone?: 'warn' | 'ok'; orders: readonly OrderRow[] }) {
  if (orders.length === 0) return null;
  return (
    <section>
      <PartSec tone={tone}>{title}</PartSec>
      <PartList>
        {orders.map((o) => (
          <PartRow
            key={o.order_id}
            href={vendorBookingFeePayPath(o.order_id)}
            mark={o.order_id}
            title={
              <>
                {formatPhp(feeOrderTotalPhp(o))}
                <PartRef>{o.reference_code}</PartRef>
              </>
            }
            sub={`${feeOrderDescriptionNow(o.description, o.status) || 'Setnayan booking fee'} · ${fmtDate(o.created_at)}`}
            end={<ShopPill tone={feeStatusTone(o.status)}>{ORDER_STATUS_LABEL[o.status]}</ShopPill>}
          />
        ))}
      </PartList>
    </section>
  );
}
