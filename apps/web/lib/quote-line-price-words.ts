/**
 * 💬 WHAT A QUOTE LINE'S PRICE COLUMN SAYS — one rule for every place a sent line is drawn (owner screenshot 17 Nov,
 * "Debut 18": "Transportation · Quoted after site check" read "Complimentary" in the price column).
 *
 * A line with an amount shows the amount. A line with NO amount is one of two different things, and the stored line says
 * which: the transport the supplier will price after a site check (`QUOTED_AFTER_SITE_CHECK`, written by the quote
 * maker) — not free, just not priced yet — or a freebie ("Complimentary"). Pure; no imports beyond the formatter.
 */
import { formatCentavos } from './vendor-proposals';

/** The detail the quote maker writes on a distance-priced transport line. One string, read back by its exact words. */
export const QUOTED_AFTER_SITE_CHECK = 'Quoted after site check';

/**
 * 🏷 A line the supplier has not priced yet, in the quote maker's receipt — a card with no "from" price, or a line they
 * just added. It reads these words, never "₱0" (owner via the controller, 21 Nov), and the receipt will not send it
 * until it has a price or is switched to Free (`receiptRefusal`). The same words the money summaries already use.
 */
export const QUOTE_LINE_AMOUNT_NOT_SET = 'Amount not set';

export function quoteLinePriceWords(li: { detail?: string | null; amount_centavos: number | null }): string {
  if (typeof li.amount_centavos === 'number') return formatCentavos(li.amount_centavos);
  return li.detail?.trim() === QUOTED_AFTER_SITE_CHECK ? QUOTED_AFTER_SITE_CHECK : 'Complimentary';
}

/** The detail beside the line's name — not repeated when the price column already says it. */
export function quoteLineDetailWords(li: { detail?: string | null; amount_centavos: number | null }): string | null {
  const d = li.detail?.trim() || null;
  if (!d) return null;
  return typeof li.amount_centavos !== 'number' && d === QUOTED_AFTER_SITE_CHECK ? null : d;
}

/**
 * 📋 What the "Add from your catalogue" picker says beside an extra (ship review 21 Nov): "Free" for a free extra,
 * `QUOTE_LINE_AMOUNT_NOT_SET` for one with no price — never "₱0" — else the amount for its quantity.
 */
export function quoteExtraPriceWords(x: { qty: number; pricePhp: number; free: boolean }): string {
  if (x.free) return 'Free';
  const centavos = Math.round((Number(x.qty) || 1) * (Number(x.pricePhp) || 0) * 100);
  return centavos === 0 ? QUOTE_LINE_AMOUNT_NOT_SET : formatCentavos(centavos);
}
