/**
 * pricing-formula.ts — the cost-based price formula (owner 2026-11-21,
 * Setnayan-specs DECISION_LOG "NEW BASE PRICING FORMULA"):
 *
 *   price = base cost × OPEX (10) × margin (4.5) ÷ fee-and-tax cover (0.73)
 *
 * rounded UP to the admin's step (₱1, ₱5 or ₱10). At the defaults that is
 * base cost × ≈61.64.
 *
 * 🔒 IT SUGGESTS, IT NEVER CHARGES. The owner is still working out real costs,
 * so this module only computes a number to show BESIDE the current price on
 * /admin/pricing. A price moves only when an admin presses "Use formula price"
 * or "Apply to all rows with a cost", and both go through the ordinary audited
 * per-row save (validateRetailRowFields → the § 9.1 second-admin gate). No
 * trigger, cron or save-on-cost-edit calls this.
 *
 * 📐 BASE COST IS `platform_retail_catalog_v2.saas_overhead_cost_php` — the
 * column the editor already had, relabelled "Base cost (what it costs us)". No
 * second cost column.
 *
 * 📐 THE MAIN PRICE ONLY (`retail_price_php`). Per-head prices, sign-up prices,
 * yearly ×10 prices and gift-bundle rows are left alone — `formulaCandidates`
 * is the one place that decides which rows the bulk apply may touch, and the
 * server action uses the SAME function, so the confirm list and the write can
 * never disagree about the set.
 *
 * Pure: no Supabase, no request context — testable on its own.
 */

import { formatPhp } from '@/lib/php';

export type PricingFormulaSettings = {
  opexFactor: number;
  marginFactor: number;
  feeTaxCover: number;
  roundStepPhp: PricingRoundStep;
};

export const PRICING_ROUND_STEPS = [1, 5, 10] as const;
export type PricingRoundStep = (typeof PRICING_ROUND_STEPS)[number];

/** The owner's 2026-11-21 numbers — also the column DEFAULTs in migration 20271356452488. */
export const PRICING_FORMULA_DEFAULTS: PricingFormulaSettings = {
  opexFactor: 10,
  marginFactor: 4.5,
  feeTaxCover: 0.73,
  roundStepPhp: 1,
};

function isRoundStep(n: number): n is PricingRoundStep {
  return (PRICING_ROUND_STEPS as readonly number[]).includes(n);
}

/**
 * The suggested price for a base cost, or null when there is no cost to price
 * from (cost ≤ 0, blank, or not a number) — a row with no cost suggests
 * nothing rather than "₱0".
 *
 * Rounded UP to the step, so the suggestion is never below the raw value. The
 * raw value is first settled to 6 decimals so float noise (90 ÷ 0.73 written as
 * 123.28767123287671…, or an exact multiple landing at 125.00000000000001) can
 * never push a price up a whole step.
 */
export function formulaPrice(cost: number, settings: PricingFormulaSettings): number | null {
  if (!Number.isFinite(cost) || cost <= 0) return null;
  const { opexFactor, marginFactor, feeTaxCover, roundStepPhp } = settings;
  if (!(opexFactor > 0) || !(marginFactor > 0) || !(feeTaxCover > 0) || feeTaxCover > 1) return null;
  const step = isRoundStep(roundStepPhp) ? roundStepPhp : 1;
  const raw = Math.round(((cost * opexFactor * marginFactor) / feeTaxCover) * 1e6) / 1e6;
  return Math.ceil(raw / step) * step;
}

/** A number as the owner reads it: 10 · 4.5 · 0.73 — no trailing zeros. */
function plain(n: number): string {
  return String(Math.round(n * 10000) / 10000);
}

/** "Price = base cost × 10 × 4.5 ÷ 0.73, rounded up to ₱1" */
export function formulaSentence(s: PricingFormulaSettings): string {
  return `Price = base cost × ${plain(s.opexFactor)} × ${plain(s.marginFactor)} ÷ ${plain(s.feeTaxCover)}, rounded up to ${formatPhp(s.roundStepPhp)}`;
}

/** "+₱24" · "−₱300" · "same" — the gap between the formula and the price on sale. */
export function formulaDifferenceLabel(formula: number, current: number): string {
  const d = Math.round((formula - current) * 100) / 100;
  if (d === 0) return 'same';
  const abs = Math.abs(d).toLocaleString('en-PH');
  return d > 0 ? `+₱${abs}` : `−₱${abs}`;
}

/**
 * Reads the four columns of the admin-only `pricing_formula_settings` row
 * (service-role only, migration 20271356452488). A missing or out-of-range value
 * is NOT silently replaced: the result says it could not be read (null), and
 * the screen then suggests nothing rather than a confident number from the
 * code defaults that may not be what the owner set.
 */
export function readPricingFormulaSettings(
  row: {
    pricing_opex_factor?: number | string | null;
    pricing_margin_factor?: number | string | null;
    pricing_fee_tax_cover?: number | string | null;
    pricing_round_step_php?: number | string | null;
  } | null,
): PricingFormulaSettings | null {
  if (!row) return null;
  const opexFactor = Number(row.pricing_opex_factor);
  const marginFactor = Number(row.pricing_margin_factor);
  const feeTaxCover = Number(row.pricing_fee_tax_cover);
  const roundStepPhp = Number(row.pricing_round_step_php);
  if (row.pricing_opex_factor == null || !(opexFactor > 0)) return null;
  if (row.pricing_margin_factor == null || !(marginFactor > 0)) return null;
  if (row.pricing_fee_tax_cover == null || !(feeTaxCover > 0) || feeTaxCover > 1) return null;
  if (row.pricing_round_step_php == null || !isRoundStep(roundStepPhp)) return null;
  return { opexFactor, marginFactor, feeTaxCover, roundStepPhp };
}

export type ValidatedFormulaSettings =
  | { ok: true; next: PricingFormulaSettings }
  | { ok: false; message: string };

/**
 * Validates what the settings card posts. A blank box is refused, never read
 * as 0 (`Number('')` is 0 — the same trap price-control-actions.ts `parsePct`
 * documents).
 */
export function validatePricingFormulaFields(raw: {
  opexFactor: string;
  marginFactor: string;
  feeTaxCover: string;
  roundStepPhp: string;
}): ValidatedFormulaSettings {
  const num = (s: string): number | null => {
    const t = s.trim();
    if (t === '') return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  };
  const opex = num(raw.opexFactor);
  const margin = num(raw.marginFactor);
  const cover = num(raw.feeTaxCover);
  const step = num(raw.roundStepPhp);
  if (opex == null || opex <= 0 || opex >= 100000) return { ok: false, message: 'The OPEX factor must be a number above 0.' };
  if (margin == null || margin <= 0 || margin >= 100000) return { ok: false, message: 'The margin factor must be a number above 0.' };
  if (cover == null || cover <= 0 || cover > 1) {
    return { ok: false, message: 'The fee-and-tax cover must be more than 0 and no more than 1 (0.73 keeps 73% after Maya fees and tax).' };
  }
  if (step == null || !isRoundStep(step)) {
    const steps = PRICING_ROUND_STEPS.map((n) => formatPhp(n));
    return { ok: false, message: `Round up to ${steps.slice(0, -1).join(', ')} or ${steps[steps.length - 1]}.` };
  }
  return {
    ok: true,
    next: {
      opexFactor: Math.round(opex * 1000) / 1000,
      marginFactor: Math.round(margin * 1000) / 1000,
      feeTaxCover: Math.round(cover * 10000) / 10000,
      roundStepPhp: step,
    },
  };
}

/** The fields of a catalog row this module needs. */
export type FormulaCandidateRow = {
  code: string;
  title: string;
  price: number;
  cost: number;
  isActive: boolean;
  /** A supplier gift bundle (`bundle_of_service_code` set) — priced as whole packs, never by the formula. */
  isGiftBundle: boolean;
  /** `per_year` rows are the yearly ×10 prices — set from the 28-day price, never by the formula. */
  billingPeriod: string;
};

/**
 * Whether the formula speaks for this row at all. Gift bundles and yearly ×10
 * prices are derived from other rows, so a cost-based number would contradict
 * them — the row shows no formula line and the bulk apply never touches it.
 */
export function formulaAppliesTo(r: Pick<FormulaCandidateRow, 'isGiftBundle' | 'billingPeriod'>): boolean {
  return !r.isGiftBundle && r.billingPeriod !== 'per_year';
}

export type FormulaChange = { code: string; title: string; oldPrice: number; newPrice: number };

/**
 * The rows "Apply to all rows with a cost" would change: on sale, not a gift
 * bundle or a yearly price, a cost above ₱0, and a formula price different from today's. Used by
 * BOTH the confirm list (client) and the write (server, from a fresh read).
 */
export function formulaCandidates(rows: FormulaCandidateRow[], settings: PricingFormulaSettings): FormulaChange[] {
  const out: FormulaChange[] = [];
  for (const r of rows) {
    if (!r.isActive || !formulaAppliesTo(r)) continue;
    const next = formulaPrice(r.cost, settings);
    if (next == null || next === r.price) continue;
    out.push({ code: r.code, title: r.title, oldPrice: r.price, newPrice: next });
  }
  return out;
}
