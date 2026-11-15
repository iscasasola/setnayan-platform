'use client';

/**
 * 💸 THE CARRY-OVER SHEET (owner 2026-11-12, booking-fee top-up rule 4; prototype
 * `Build_Booking_Fee_Hold_2026-11-12/booking-fee-hold.html` — "Booking ask card · Accept / Decline").
 *
 * While a top-up from ANOTHER booking is OVERDUE (the day after its event day, unsettled), the booking ask's Agree
 * becomes "Settle ₱X to accept". Pressed, one sheet names BOTH amounts: this booking's own fee (the shipped forecast's
 * sentence — the figure the yes will make) and the ₱X still owed. Its one main button pays the ₱X on the shipped pay
 * page (manual transfer + receipt). This booking's fee is made at the yes, as it always is (`vendorAgreeToLock`), so
 * once the top-up is settled, Agree comes back here and the yes bills it.
 *
 * A HELD top-up (before or on its event day) never reaches this sheet — `overdueTopUps` drops it. The server half of
 * the gate is `vendorAgreeToLock`'s `top_up_owed` refusal; this sheet only lets the answer say why before the press.
 */
import { useState } from 'react';
import { Wallet, X } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { Sheet } from '@/app/_components/sheet';
import { feePesos, formatDueDate } from '@/lib/booking-fee-disclosure';
import { TOP_UP_WORDS } from '@/lib/booking-fee-top-up';
import { SettlePayBy, type SettlePay } from '@/app/_components/payment/settle-pay-by';

export type CarryOverTopUp = {
  /** The oldest overdue top-up's bill — its pay page is the one door. */
  orderId: string;
  /** Everything overdue across the shop's top-ups, to the centavo. */
  amountPhp: number;
  /** Who the oldest one is for, as the supplier knows them. */
  coupleName: string | null;
  /** Its due day (the event day), `YYYY-MM-DD`. */
  dueOn: string | null;
  /** The pay page for `orderId` (`vendorBookingFeePayPath`), built by the server. */
  payHref: string;
  /**
   * 💸 WHERE TO PAY (owner 13 Nov): the oldest overdue bill read the way /pay reads it (`readSettlePay`) — Pay by ▾,
   * the minted QR, the account rows, the Receipt. Null when it could not be read: the sheet keeps its shipped door.
   */
  pay?: SettlePay | null;
};

export function TopUpCarryOver({
  owed,
  thisBookingFee,
}: {
  owed: CarryOverTopUp;
  /** The shipped forecast's headline for THIS booking's fee (`feeForecast.headline`), or null when it carries none. */
  thisBookingFee: string | null;
}) {
  const [open, setOpen] = useState(false);
  const label = TOP_UP_WORDS.settleToAccept(owed.amountPhp);
  return (
    <>
      <ActionButton
        tone="brand"
        main
        icon={<Wallet aria-hidden strokeWidth={1.9} />}
        label={label}
        onClick={() => setOpen(true)}
        className="!h-11 !min-h-11"
      />
      <Sheet open={open} onClose={() => setOpen(false)} labelledById="top-up-carry-over-title" title="Settle to accept" rise>
        <div data-top-up-carry-over="" className="space-y-1 px-5 pb-5">
          <p id="top-up-carry-over-title" className="text-sm text-ink/70">
            A booking fee top-up from a past event is still unsettled. Settle it and this booking can be accepted.
          </p>
          <dl className="mt-2">
            <div className="flex min-h-11 items-center justify-between gap-3 border-t border-ink/10 py-2">
              <dt className="min-w-0 text-[15px] text-ink/70">
                This booking&rsquo;s fee
                <small className="block text-xs text-ink/70">{thisBookingFee ?? 'Made when you accept'}</small>
              </dt>
              <dd className="shrink-0 text-[15px] text-ink/70">At your yes</dd>
            </div>
            <div className="flex min-h-11 items-center justify-between gap-3 border-t border-ink/10 py-2">
              <dt className="min-w-0 text-[15px] text-ink/70">
                Still owed · top-up
                <small className="block text-xs text-ink/70">
                  {owed.coupleName ? `${owed.coupleName} · ` : ''}
                  {owed.dueOn ? `due ${formatDueDate(owed.dueOn)}` : 'overdue'}
                </small>
              </dt>
              <dd className="shrink-0 text-[15px] font-semibold text-warn-800">
                {feePesos(owed.amountPhp)}
              </dd>
            </div>
            <div className="flex min-h-14 items-center justify-between gap-3 border-t-2 border-ink/15 py-2 font-semibold">
              <dt className="text-base text-ink">To settle now</dt>
              <dd className="text-[22px] text-ink">{feePesos(owed.amountPhp)}</dd>
            </div>
          </dl>
          {owed.pay ? <SettlePayBy pay={owed.pay} /> : null}
          <div className="space-y-2 pt-2">
            <ActionButton
              tone="brand"
              main
              icon={<Wallet aria-hidden strokeWidth={1.9} />}
              label={`Confirm & pay ${feePesos(owed.amountPhp)}`}
              href={owed.pay ? owed.pay.receiptHref : owed.payHref}
              className="!h-12 w-full"
            />
            <ActionButton tone="neutral" quiet icon={<X aria-hidden strokeWidth={1.9} />} label="Not now" onClick={() => setOpen(false)} className="!h-11 w-full" />
          </div>
        </div>
      </Sheet>
    </>
  );
}
