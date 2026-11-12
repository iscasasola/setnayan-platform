'use client';

/**
 * 💸 THE TOP-UP'S SETTLE SHEET (owner 13 Nov; prototype `booking_fee_top_up_2026-11-13` "Booking fee sheet" + "Where
 * to pay (under Pay by)").
 *
 * The door on a top-up bill ("Settle early" while held, "Settle" from the event day) opens ONE sheet: the top-up and
 * its stage · To settle · Pay by ▾ with WHERE to pay (`SettlePayBy` — the shipped pay block, one paying style) · the
 * Receipt · the main button ("Settle early" before the event day, "Confirm & pay ₱X" on and after it) · Not now.
 * Every peso and every word is handed in by the server (`feeDueCopy`, `readSettlePay`); nothing is priced here.
 */
import { useState } from 'react';
import { Wallet } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { Sheet } from '@/app/_components/sheet';
import { SettlePayBy, type SettlePay } from '@/app/_components/payment/settle-pay-by';
import { feePesos, formatDueDate } from '@/lib/booking-fee-disclosure';
import { TOP_UP_WORDS, type TopUpStage } from '@/lib/booking-fee-top-up';

export function TopUpSettleSheet({
  orderId,
  label,
  accent,
  stage,
  dueOn,
  coupleName,
  pay,
}: {
  orderId: string;
  /** The door's own word (`copy.payLabel`) — "Settle early" or "Settle". */
  label: string;
  /** The bill row's tone colour, so the door looks as it always did. */
  accent: string;
  stage: TopUpStage;
  dueOn: string | null;
  coupleName: string | null;
  pay: SettlePay;
}) {
  const [open, setOpen] = useState(false);
  const titleId = `top-up-settle-${orderId}`;
  const main = stage === 'held' ? TOP_UP_WORDS.settleEarly : `Confirm & pay ${feePesos(pay.amountPhp)}`;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-top-up-settle-door={stage}
        className="inline-flex h-9 items-center rounded-full px-4 text-sm font-semibold text-white"
        style={{ background: accent }}
      >
        {label}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} labelledById={titleId} title="Booking fee" rise>
        <div data-top-up-settle-sheet={stage} className="space-y-1 px-5 pb-5">
          <dl>
            <div className="flex min-h-11 items-center justify-between gap-3 py-2">
              <dt id={titleId} className="min-w-0 text-[14.5px] text-ink/70">
                Top-up{coupleName ? ` · ${coupleName}` : ''}
                <small className="block text-[12px] text-ink/50">
                  {TOP_UP_WORDS.badge[stage]}
                  {dueOn ? ` · the event day, ${formatDueDate(dueOn)}` : ''}
                </small>
              </dt>
              <dd
                className="shrink-0 text-[14.5px] font-semibold"
                style={{ color: stage === 'overdue' ? 'rgb(var(--color-danger))' : 'rgb(var(--color-warn))' }}
              >
                {feePesos(pay.amountPhp)}
              </dd>
            </div>
            <div className="flex min-h-14 items-center justify-between gap-3 border-t-2 border-ink/15 py-2 font-semibold">
              <dt className="text-[16px] text-ink">To settle</dt>
              <dd className="text-[22px] text-ink">{feePesos(pay.amountPhp)}</dd>
            </div>
          </dl>
          <SettlePayBy pay={pay} />
          <div className="space-y-2 pt-2">
            <ActionButton
              tone="brand"
              main
              icon={<Wallet aria-hidden strokeWidth={1.9} />}
              label={main}
              href={pay.receiptHref}
              className="!h-12 w-full"
            />
            <ActionButton tone="neutral" label="Not now" onClick={() => setOpen(false)} className="!h-11 w-full" />
          </div>
        </div>
      </Sheet>
    </>
  );
}
