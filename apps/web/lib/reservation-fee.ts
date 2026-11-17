import type { AmountKind } from '@/lib/vendor-service-payment-schedules';

/**
 * 💳 THE RESERVATION FEE IS ONE TEXT BOX (owner, 17 Nov — DECISION_LOG "reservation fee is one text box; plain number =
 * pesos, with % = percent": *"If I write 10, the that is 10 pesos downpayment if i write 10% then that is 10%
 * downpayment"*). Parsed live into the first payment's two shipped columns — `amount_kind` ('fixed' | 'percent') and its
 * value — so no schema changes. % over 100, or pesos over the card's price, are refused in words.
 */
export function parseReservationFee(
  raw: string,
  pricePhp: number | null = null,
): { ok: true; kind: AmountKind; value: number } | { ok: false; error: string | null } {
  const t = raw.trim().replace(/[₱,\s]/g, '');
  if (t === '') return { ok: false, error: null };
  const m = /^(\d+(?:\.\d+)?)(%?)$/.exec(t);
  if (!m) return { ok: false, error: 'Type a number: 5000 for pesos, or 10% for a percent.' };
  const n = Number(m[1]);
  if (m[2] === '%') {
    if (n > 100) return { ok: false, error: 'A percent goes up to 100%.' };
    return { ok: true, kind: 'percent', value: Math.round(n) };
  }
  if (pricePhp != null && pricePhp > 0 && n > pricePhp) {
    return { ok: false, error: `More than the price (₱${pricePhp.toLocaleString('en-PH')}).` };
  }
  return { ok: true, kind: 'fixed', value: Math.round(n) };
}

