/**
 * 📦 CARD MAKER PART 7 — the one way a per-unit card's price is put into words (migration 20271352223098).
 *
 * Owner, HYBRID map 17 Nov: Custom = "the supplier types what they charge per (sample "table")", and the typed word
 * "carries into "Price per chair", "Each extra chair" and the card ("per chair")". The card reads like the per-hour
 * one ("from ₱15,000 · for 5 hours"): the base price, what it covers, then each extra.
 *
 *   per_unit, no word   → "₱12,500 for 5 units · +₱2,500/unit"
 *   per_unit, "chair"   → "₱3,500 for 10 chairs · +₱350/chair"
 *
 * Words only — every peso here is one the supplier typed (or base ÷ initial, the drawing's own "fills in by itself").
 */

/** What a per-unit card charges per: its Custom word, or "unit". */
export function unitWord(word: string | null | undefined): string {
  const w = (word ?? '').trim();
  return w === '' ? 'unit' : w;
}

/** "chair" → "chairs" for any count but 1. A word already ending in s is left as typed. */
export function unitWordFor(count: number, word: string | null | undefined): string {
  const w = unitWord(word);
  if (count === 1 || /s$/i.test(w)) return w;
  return `${w}s`;
}

const php = (n: number) => `₱${Math.round(n).toLocaleString('en-PH')}`;

/** The card's line for a per-unit price, or null when there is no base price to show. */
export function perUnitPriceLine(p: {
  base: number | null | undefined;
  initial: number | null | undefined;
  extra: number | null | undefined;
  word: string | null | undefined;
}): string | null {
  if (p.base == null || !(p.base > 0)) return null;
  const covers = p.initial != null && p.initial > 0 ? ` for ${p.initial.toLocaleString('en-PH')} ${unitWordFor(p.initial, p.word)}` : '';
  const more = p.extra != null && p.extra > 0 ? ` · +${php(p.extra)}/${unitWord(p.word)}` : '';
  return `${php(p.base)}${covers}${more}`;
}
