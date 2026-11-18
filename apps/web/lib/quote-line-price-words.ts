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
