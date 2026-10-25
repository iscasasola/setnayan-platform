/**
 * THE RECEIPT'S STAMP — ONE component, `status: 'paid' | 'awaiting'`.
 *
 * Owner's pick, verbatim (2026-10-25): "Paid 3 · Awaiting 1" — from
 * `prototypes/ceremo_deltas_2026-10-25/03_account_menu.html` › "The stamp · three looks to choose from".
 *
 *   · PAID = option 3 — a diagonal "PAID" ink stamp across the amount's corner: double rules above and below, muted
 *     green ink, the ink worn in places (a CSS mask), a slight rotation. It owns the slip's top-right corner, so the
 *     slip left-aligns the amount when a stamp is drawn (`ReceiptSlip`).
 *   · AWAITING PAYMENT = option 1 — a flat rectangular tag: dashed amber border, NO tilt, a small clock mark,
 *     "AWAITING PAYMENT" and, under it, "Pay by <date>" — ONLY when the order really carries a due date. Orders carry
 *     none today (`orders.expires_at` is a subscription's END, not a payment deadline), so callers pass nothing and the
 *     line is not drawn. Nothing is stamped — because nothing has happened yet.
 *
 * Calm, fixed ink: the slip is always light paper (also on a dark page), so the stamp never takes the dark set.
 * Different SHAPES as well as colours, so the two tell apart in greyscale.
 */
export type ReceiptStampStatus = 'paid' | 'awaiting';

const PAID_INK = 'rgba(46,125,79,.82)';
const WAIT_INK = 'rgba(160,108,18,.95)';
const WORN = 'repeating-linear-gradient(100deg,#000 0 4px,rgba(0,0,0,.6) 4px 5px)';

export function ReceiptStamp({ status, payBy = null }: { status: ReceiptStampStatus; payBy?: string | null }) {
  if (status === 'paid') {
    return (
      <span
        data-receipt-stamp="paid"
        className="pointer-events-none absolute -right-1 top-[74px] -rotate-[16deg] py-1 pl-4 pr-1 font-mono text-[28px] font-bold leading-none tracking-[0.32em] opacity-75"
        style={{
          color: PAID_INK,
          borderTop: `3px double ${PAID_INK}`,
          borderBottom: `3px double ${PAID_INK}`,
          WebkitMaskImage: WORN,
          maskImage: WORN,
        }}
      >
        PAID
      </span>
    );
  }
  return (
    <span
      data-receipt-stamp="awaiting"
      className="absolute right-3.5 top-[84px] bg-[#FFFDF8] px-2.5 py-[7px] font-mono text-[9.5px] font-bold uppercase leading-[1.3] tracking-[0.14em]"
      style={{ color: WAIT_INK, border: `1.5px dashed ${WAIT_INK}` }}
    >
      <span
        aria-hidden
        className="relative mr-[5px] inline-block h-2.5 w-2.5 rounded-full align-[-1px]"
        style={{ border: `1.5px solid ${WAIT_INK}` }}
      >
        <span className="absolute left-[3px] top-[1px] h-[3.5px] w-[1.5px]" style={{ background: WAIT_INK }} />
        <span className="absolute left-[3px] top-[4px] h-[1.5px] w-[2.5px]" style={{ background: WAIT_INK }} />
      </span>
      Awaiting payment
      {payBy ? <small className="mt-[3px] block text-[9px] font-normal normal-case tracking-[0.06em]">Pay by {payBy}</small> : null}
    </span>
  );
}
