/**
 * vendor-discount-rows.ts — the multi-discount repeater PARSER.
 *
 * Extracted verbatim from `app/vendor-dashboard/services/actions.ts` (which is
 * a `'use server'` module and therefore untestable in isolation) so the rule
 * that turns a vendor's submitted form into `vendor_service_discounts` rows can
 * be exercised directly. actions.ts imports it; the behaviour, the validation
 * order and the exact error strings are unchanged.
 *
 * THE SHAPE: `DiscountsEditor` (service-list-editors.tsx) renders parallel,
 * index-aligned inputs — one entry per row, per field:
 *
 *   discount_type[] · discount_rate[] · discount_unit[] ·
 *   discount_min_lead_months[] · discount_expires_at[] · discount_conditions_md[]
 *
 * Index alignment is the whole contract: every row MUST contribute exactly one
 * entry to every array, which is why the editor carries the unit and the
 * lead-time months in always-rendered HIDDEN inputs rather than conditionally
 * mounted visible ones.
 *
 * `min_lead_months` is the early-booking LADDER rung (owner-locked 2026-07-27,
 * DECISION_LOG "MAKER IS ZERO STEPS" ruling ②) — see vendor-lead-time-tier.ts
 * for the resolver that picks a rung from the couple's event date.
 */

export const DISCOUNT_TYPES = [
  'early_booking',
  'off_peak',
  'bundle',
  'promo',
  'returning',
] as const;
export type DiscountType = (typeof DISCOUNT_TYPES)[number];
export type DiscountUnit = 'pct' | 'php';

export type DiscountDraft = {
  discount_type: DiscountType;
  rate: number;
  unit: DiscountUnit;
  /**
   * Early-booking ladder rung threshold in months; null = no threshold (the
   * pre-ladder behaviour, and the only value the other four types carry).
   */
  min_lead_months: number | null;
  expires_at: string | null;
  conditions_md: string | null;
};

/** Just the slice of FormData this parser needs (so a test can hand it one). */
export type DiscountFormData = { getAll(name: string): unknown[] };

/**
 * Upper bound on an authored lead-time threshold: 600 months is 50 years. Not a
 * product rule — a typo guard, so a fat-fingered "120000" degrades to "no
 * threshold" instead of persisting a rung no couple can ever reach.
 */
const MAX_LEAD_MONTHS = 600;

/**
 * Coerce one submitted `discount_min_lead_months` cell into a rung threshold.
 *
 * DEFENSIVE BY DESIGN. Anything unusable — blank, non-numeric, fractional,
 * zero, negative, absurd — becomes `null`, i.e. "no threshold", which is
 * exactly how this table behaved before the ladder existed. It never throws: a
 * vendor must not lose an entire service save to a typo in an optional
 * refinement. And it is forced to `null` for every non-`early_booking` type, so
 * a stale hidden field can't smuggle a threshold onto an off-peak row.
 */
export function parseMinLeadMonths(
  raw: unknown,
  discountType: DiscountType,
): number | null {
  if (discountType !== 'early_booking') return null;
  const text = typeof raw === 'string' ? raw.trim() : '';
  if (text.length === 0) return null;
  const parsed = Number(text);
  if (!Number.isFinite(parsed)) return null;
  if (!Number.isInteger(parsed)) return null;
  if (parsed < 1 || parsed > MAX_LEAD_MONTHS) return null;
  return parsed;
}

/**
 * Parse the multi-discount rows (Phase 3b). A row with a blank type AND blank
 * rate is skipped, so an empty repeater cleanly clears the list. Validates:
 * rate>0, type in the enum, unit in (pct,php), and promo requires an expiry.
 *
 * Throws with a vendor-readable message on the hard failures (the caller
 * catches it and bounces the form); soft-degrades on the lead-time months.
 */
export function parseDiscountRows(formData: DiscountFormData): DiscountDraft[] {
  const types = formData.getAll('discount_type');
  const rates = formData.getAll('discount_rate');
  const units = formData.getAll('discount_unit');
  const leadMonths = formData.getAll('discount_min_lead_months');
  const expiries = formData.getAll('discount_expires_at');
  const conditions = formData.getAll('discount_conditions_md');
  const out: DiscountDraft[] = [];
  const n = types.length;
  for (let i = 0; i < n; i++) {
    const typeRaw = typeof types[i] === 'string' ? (types[i] as string).trim() : '';
    const rateRaw = typeof rates[i] === 'string' ? (rates[i] as string).trim() : '';
    if (typeRaw.length === 0 && rateRaw.length === 0) continue; // blank row → skip
    if (!(DISCOUNT_TYPES as readonly string[]).includes(typeRaw)) {
      throw new Error('Pick a discount type for each discount you add.');
    }
    const discount_type = typeRaw as DiscountType;
    const rate = Number(rateRaw);
    if (rateRaw.length === 0 || !Number.isFinite(rate) || rate <= 0) {
      throw new Error('Each discount needs a positive amount.');
    }
    const unitRaw = typeof units[i] === 'string' ? (units[i] as string) : 'pct';
    const unit: DiscountUnit = unitRaw === 'php' ? 'php' : 'pct';

    const expRaw = typeof expiries[i] === 'string' ? (expiries[i] as string).trim() : '';
    let expires_at: string | null = null;
    if (expRaw.length > 0) {
      const d = new Date(expRaw);
      if (isNaN(d.getTime())) throw new Error('Discount expiry must be a valid date.');
      expires_at = d.toISOString();
    }
    if (discount_type === 'promo' && expires_at === null) {
      throw new Error('Limited-Time Promo discounts require an expiry date.');
    }

    const condRaw =
      typeof conditions[i] === 'string' ? (conditions[i] as string).trim() : '';
    const conditions_md = condRaw.length > 0 ? condRaw.slice(0, 1000) : null;

    // The early-booking ladder rung (migration 20271017262879).
    const min_lead_months = parseMinLeadMonths(leadMonths[i], discount_type);

    out.push({ discount_type, rate, unit, min_lead_months, expires_at, conditions_md });
  }
  return out;
}
