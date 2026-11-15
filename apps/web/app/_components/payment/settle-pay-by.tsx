'use client';

/**
 * 💸 "PAY BY ▾" + WHERE TO PAY — the booking-fee settle sheets' pay part (owner 13 Nov: *"how can they settle if they
 * do not have the QR Code or information where to pay"*; prototype `booking_fee_top_up_2026-11-13` "Where to pay
 * (under Pay by)").
 *
 * NOT A NEW PAY BLOCK. Owner 20 Sep: *"all payments entering us should be one paying style."* The choice is ONE
 * `PickMenu` (the owner's dropdown rule) listing the OPEN receiving accounts in the admin's order, first selected, in
 * the rail cards' own words (`railCardWords`); under it the SHIPPED `PaymentDetailsBlock` draws the chosen one —
 * lead line · reference + Copy · the QR WITH the amount (minted on the SERVER, `mintedQrImage`; never a payload for
 * the browser to draw) · "or send to our number" · name / number / exact amount, each with Copy · Open GCash. Then
 * the Receipt row, whose Add opens the SHIPPED proof stage on /pay (the one place a receipt is taken).
 */
import Link from 'next/link';
import { useState } from 'react';
import { ChevronRight, Receipt } from 'lucide-react';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { PaymentDetailsBlock, railCardWords, type RailInfo } from './payment-rails';

/** What the server hands a settle sheet: the bill's own reference and figure (/pay's), and its minted rails. */
export type SettlePay = {
  referenceCode: string;
  /** `fetchPayableByReference(...).amountPhp` — the SAME figure /pay mints into its code. */
  amountPhp: number;
  /** The OPEN rails, in the admin's order, each with its server-drawn code. */
  rails: readonly RailInfo[];
  /** The shipped proof stage on /pay (`stageHref(ref, PROOF_STAGE)`). */
  receiptHref: string;
};

export function SettlePayBy({ pay }: { pay: SettlePay }) {
  const [channel, setChannel] = useState<string>(pay.rails[0]?.id ?? '');
  if (pay.rails.length === 0) {
    return (
      <p className="border-t border-ink/10 py-3 text-[13px] text-ink/60" data-settle-pay-by="none">
        Payment details are being set up. Please check back shortly.
      </p>
    );
  }
  // A rail switched off since the sheet was drawn is never the one on screen.
  const shown = pay.rails.find((r) => r.id === channel) ?? pay.rails[0]!;
  return (
    <div data-settle-pay-by="" className="space-y-3 border-t border-ink/10 pt-2">
      <div className="flex min-h-11 items-center justify-between gap-3">
        <span className="min-w-0 text-[14.5px] text-ink/70">
          Pay by
          <small className="block text-[12px] text-ink/50">how you pay Setnayan</small>
        </span>
        <PickMenu
          label="Pay by"
          value={shown.id}
          options={pay.rails.map((r) => ({ key: r.id, label: railCardWords(r).title, hint: railCardWords(r).desc }))}
          onPick={setChannel}
          dataAttr="data-settle-pay-by-pick"
        />
      </div>
      <PaymentDetailsBlock
        info={shown}
        referenceCode={pay.referenceCode}
        amountPhp={pay.amountPhp}
        proofHint="then add your receipt below."
      />
      <div className="flex min-h-11 items-center justify-between gap-3 border-t border-ink/10 py-2">
        <span className="inline-flex min-w-0 items-center gap-2 text-[14.5px] text-ink/70">
          <Receipt aria-hidden className="h-4 w-4 shrink-0" strokeWidth={1.75} />
          Receipt
        </span>
        <Link
          href={pay.receiptHref}
          data-settle-receipt=""
          className="inline-flex min-h-11 items-center gap-0.5 text-[14px] font-semibold text-sn-accent"
        >
          Add
          <ChevronRight aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        </Link>
      </div>
    </div>
  );
}
