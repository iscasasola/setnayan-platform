/**
 * added-pax-surcharge.ts — the ONE rule for guests above the count a price was
 * quoted against. PURE, import-free.
 *
 * ── WHY IT LEFT `lib/pax.ts` (2026-09-22) ──────────────────────────────────
 * `lib/pax.ts` imports the admin Supabase client, so nothing that must stay
 * pure — and nothing a plain `node:test` file can load — could import the rule
 * from there. `lib/quote-from-service-card.ts` needed it to price the "Added
 * guests" line off a service card's own `base_pax` / `added_pax_price_php` /
 * `added_pax_block`. The alternative was a second copy of a money rule, which
 * agrees on the day it is written and drifts at the first change. Moved
 * verbatim; `lib/pax.ts` re-exports it under the same name, so every existing
 * importer is unchanged.
 */

/**
 * The vendor surcharge (PHP) for the live pax above the count their base price
 * was quoted against: ceil((livePax - quoteBase) / block) * ratePhp.
 * Returns 0 when no rate, no base, or pax is at/below the base — i.e. the owner
 * fallback "no rate → no extra charge". Pure; mirrors the customer floor+block
 * model (computePaxPriceCentavos).
 */
export function computeAddedPaxSurcharge(params: {
  livePax: number | null;
  quoteBasePax: number | null;
  ratePhp: number | null;
  block?: number | null;
}): number {
  const { livePax, quoteBasePax, ratePhp } = params;
  const block = params.block && params.block > 0 ? params.block : 1;
  if (!ratePhp || ratePhp <= 0) return 0;
  if (livePax == null || quoteBasePax == null) return 0;
  const extra = livePax - quoteBasePax;
  if (extra <= 0) return 0;
  return Math.ceil(extra / block) * ratePhp;
}
