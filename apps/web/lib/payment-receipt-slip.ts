import { formatCentavosPhp } from '@/lib/php';
import type { Receipt } from '@/lib/deal-end';

/**
 * 🧾 THE SUPPLIER-PAYMENT RECEIPT DOCUMENT — what the slip says (Unichat drawing `unichat_live_v3_2026-11-20.html`:
 * the hosts' Receipt card carries "PDF"; DECISION_LOG 2026-11-20 H2 row: "no PDF button and no S89R number until a
 * supplier-payment receipt document exists").
 *
 * Every figure is the payment ROW's (`Receipt`, read by `receiptOfPayment`); nothing here is typed or guessed.
 *
 * 🔒 NOT AN OFFICIAL RECEIPT, AND IT SAYS SO. Setnayan did not sell this service and did not take this money — the
 * hosts paid the supplier directly and the supplier confirmed it on Setnayan. Only the seller can issue a BIR official
 * receipt, so the legal line names the supplier as the one who issues it. The slip keeps the house anatomy
 * (`app/receipts/_components/receipt-slip.tsx`) so it reads as the same family as Setnayan's own receipts.
 *
 * 🔢 NO NUMBER. The drawing prints "S89R-…", but `R` is already the canonical type letter of reviews
 * (`vendor_reviews.public_id`) and referral codes — printing it here would give a receipt a review's number shape.
 * A receipt number needs its own type letter, which is an ID decision, not a look; until one exists the slip shows the
 * hosts' own payment reference (when they gave one) and no "No." line.
 */
export type PaymentReceiptSlip = {
  kind: string;
  amount: string;
  when: string;
  lines: { what: string; qty: null; amount: string; detail: string | null }[];
  total: string;
  rows: { label: string; value: string }[];
  refs: string[];
  legal: string;
};

export const PAYMENT_RECEIPT_KIND = 'Payment receipt';

export function paymentReceiptLegal(shop: string): string {
  return `${shop} confirmed this payment on Setnayan. This is your record of it, not an official receipt — ${shop} issues that.`;
}

export function paymentReceiptSlip(
  r: Receipt,
  ctx: { shop: string; eventName: string | null; date: (iso: string) => string },
): PaymentReceiptSlip {
  const amount = formatCentavosPhp(r.amountCentavos);
  const rows: { label: string; value: string }[] = [];
  if (r.method) rows.push({ label: 'Paid by', value: r.method });
  if (r.paidOn) rows.push({ label: 'Paid on', value: ctx.date(r.paidOn) });
  rows.push({ label: 'Confirmed by', value: `${ctx.shop} · ${ctx.date(r.confirmedAt)}` });
  rows.push({ label: 'Paid so far', value: formatCentavosPhp(r.paidCentavos) });
  // What is left is said only when an accepted quote states a total — never worked out from nothing.
  if (r.leftCentavos != null) rows.push({ label: 'What is left', value: r.leftCentavos === 0 ? 'Nothing · paid in full' : formatCentavosPhp(r.leftCentavos) });
  return {
    kind: PAYMENT_RECEIPT_KIND,
    amount,
    when: `Confirmed ${ctx.date(r.confirmedAt)}`,
    lines: [{ what: r.whatFor, qty: null, amount: figure(r.amountCentavos), detail: ctx.eventName ? `To ${ctx.shop} · for ${ctx.eventName}` : `To ${ctx.shop}` }],
    total: amount,
    rows,
    refs: r.reference ? [`Reference ${r.reference}`] : [],
    legal: paymentReceiptLegal(ctx.shop),
  };
}

/** A slip line's figure, as the house slip prints its lines (`slipFigure`): "9,000.00", no peso sign. */
function figure(centavos: number): string {
  return (centavos / 100).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
