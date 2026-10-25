/**
 * THE RECEIPT'S STAMP — PAID or AWAITING PAYMENT, ONE component so the owner's pick drops in here and nowhere else.
 *
 * ⚠ PLACEHOLDER LOOK (2026-10-25). The owner approved the paper slip (`prototypes/ceremo_deltas_2026-10-25/
 * 03_account_menu.html`, "The receipt · the page a row opens") with ONE thing open: the PAID vs AWAITING PAYMENT stamp
 * — the designer is drawing three pairs. Until the pick lands this draws a neutral, quiet ink box; only this file
 * changes when it does. Ink colours are fixed (the slip is always light paper, even on a dark page).
 *
 * Placement is the stamp's own: PAID sits rotated in the slip's top-right corner over the amount; AWAITING sits
 * centred in the flow above the amount (it is longer, and it must never cover the figure the person has to pay).
 */
export type ReceiptStampStatus = 'paid' | 'awaiting';

export function ReceiptStamp({ status }: { status: ReceiptStampStatus }) {
  if (status === 'paid') {
    return (
      <span
        data-receipt-stamp="paid"
        className="absolute right-4 top-[86px] -rotate-[8deg] rounded border-2 border-[#2C2A29]/40 px-2.5 py-1 font-mono text-xs font-bold tracking-[0.2em] text-[#2C2A29]/70"
      >
        PAID
      </span>
    );
  }
  return (
    <span
      data-receipt-stamp="awaiting"
      className="mx-auto -mb-2 mt-4 block w-max -rotate-[3deg] rounded border-2 border-dashed border-[#2C2A29]/40 px-2.5 py-1 font-mono text-[10px] font-bold tracking-[0.2em] text-[#2C2A29]/70"
    >
      AWAITING PAYMENT
    </span>
  );
}
