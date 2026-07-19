/**
 * Vendor package LINE pricing — pure resolver helpers.
 *
 * Vendor Proposal Maker · PR 2. `vendor_package_items` was FLAT (one
 * `replacement_value_centavos` per line). Migration
 * 20270713100000_vendor_package_item_pricing_basis brings the SAME pricing
 * bases that already live on `vendor_services` down onto the package line
 * items, so the bundle maker's resolver can price each line against the
 * event's real pax + hours.
 *
 * These helpers are PURE + TOTAL — no I/O, and they never throw on missing /
 * malformed inputs (a bundle preview or a lock must never crash on a
 * half-filled line). Modeled after `computePlanInstances` in
 * ./vendor-service-payment-schedules.ts.
 *
 * ⚠ This module ONLY resolves a line's price. It does NOT touch the existing
 * flat call sites (computeCustomization / resolvePackageLineItems / the
 * cascade-lock action) — rewiring those to consume the new columns is a LATER
 * PR. Everything here is additive and independently importable.
 *
 * Money is in CENTAVOS (matching vendor_package_items.replacement_value_centavos
 * + the new *_centavos columns), EXCEPT applyCreditToFinalInstallment, whose
 * installment amounts are whole PESOS (matching PlanInstance.amount_php).
 */

/** How a package line is priced. Mirrors vendor_services' pricing_basis. */
export type PackageLineBasis = 'fixed' | 'per_pax' | 'per_hour';

/** Crew-meal handling for a package line. */
export type CrewMealMode = 'included' | 'charge' | 'offset';

/** Transport handling for a package line. */
export type TransportMode = 'included' | 'flat' | 'distance';

/**
 * The pricing-relevant shape of a vendor_package_items row. Kept local + minimal
 * (structural) so this pure module stays decoupled from the fuller
 * VendorPackageItemRow in ./vendor-packages.ts — column names match the migration
 * exactly. Fields are permissive (nullable) because drafts may be half-filled.
 */
export type PackageLinePricingRow = {
  /** Flat line total (centavos). The whole price when pricing_basis = 'fixed'. */
  replacement_value_centavos?: number | null;
  pricing_basis?: PackageLineBasis | null;
  // per_pax basis
  per_pax_price_centavos?: number | null;
  min_pax?: number | null;
  // per_hour basis
  hour_base_centavos?: number | null;
  min_hours?: number | null;
  extra_hour_centavos?: number | null;
  // crew meal
  crew_meal_mode?: CrewMealMode | null;
  crew_size?: number | null;
  crew_per_head_centavos?: number | null;
  // transport
  transport_mode?: TransportMode | null;
  transport_flat_centavos?: number | null;
};

/** Coerce anything to a finite non-NaN number (0 fallback). Keeps helpers total. */
function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Resolve a single package line's BASE price (centavos) against the event's pax
 * + hours. Does NOT fold in crew-meal or transport adjustments — those are
 * separate, additive concerns (see crewCreditCentavos / crewChargeCentavos /
 * transportChargeCentavos), so the caller can present them as distinct lines.
 *
 *   fixed    → replacement_value_centavos, as-is (existing behavior).
 *   per_pax  → per_pax_price_centavos × max(pax, min_pax || 0).
 *   per_hour → hour_base_centavos + max(0, hours − (min_hours || 0)) × extra_hour_centavos.
 *
 * Pure + total — never throws; clamps to ≥ 0 and rounds to whole centavos.
 */
export function resolvePackageLine(
  row: PackageLinePricingRow,
  opts: { pax: number; hours: number },
): number {
  const basis: PackageLineBasis = row?.pricing_basis ?? 'fixed';
  const pax = num(opts?.pax);
  const hours = num(opts?.hours);

  switch (basis) {
    case 'per_pax': {
      const rate = num(row.per_pax_price_centavos);
      const billablePax = Math.max(pax, num(row.min_pax));
      return Math.max(0, Math.round(rate * billablePax));
    }
    case 'per_hour': {
      const base = num(row.hour_base_centavos);
      const extra = num(row.extra_hour_centavos);
      const extraHours = Math.max(0, hours - num(row.min_hours));
      return Math.max(0, Math.round(base + extraHours * extra));
    }
    case 'fixed':
    default:
      return Math.max(0, Math.round(num(row.replacement_value_centavos)));
  }
}

/**
 * Crew-meal CREDIT (centavos) when the couple provides the crew meal
 * (crew_meal_mode = 'offset'): crew_size × crew_per_head_centavos. This is a
 * credit the resolver applies against the FINAL payment first (see
 * applyCreditToFinalInstallment). 0 for 'included' / 'charge'. Pure + total.
 */
export function crewCreditCentavos(row: PackageLinePricingRow): number {
  if (row?.crew_meal_mode !== 'offset') return 0;
  return Math.max(0, num(row.crew_size) * num(row.crew_per_head_centavos));
}

/**
 * Crew-meal CHARGE (centavos) when the crew meal is billed on top
 * (crew_meal_mode = 'charge'): crew_size × crew_per_head_centavos, a positive
 * add. 0 for 'included' / 'offset'. Pure + total.
 */
export function crewChargeCentavos(row: PackageLinePricingRow): number {
  if (row?.crew_meal_mode !== 'charge') return 0;
  return Math.max(0, num(row.crew_size) * num(row.crew_per_head_centavos));
}

/**
 * Transport CHARGE (centavos) when transport is a flat add (transport_mode =
 * 'flat'): transport_flat_centavos. 0 for 'included' / 'distance' (distance is
 * quoted separately and adds nothing here). Pure + total.
 */
export function transportChargeCentavos(row: PackageLinePricingRow): number {
  if (row?.transport_mode !== 'flat') return 0;
  return Math.max(0, num(row.transport_flat_centavos));
}

/**
 * Apply a crew-meal (or any) CREDIT to a payment schedule, reducing the LAST
 * installment first and cascading UPWARD if the credit exceeds it — never
 * pushing any installment below zero, leaving the downpayment/lock whole for as
 * long as possible. Returns a NEW array of NEW objects (inputs untouched).
 *
 * If the credit exceeds the whole schedule, every installment lands at 0 and the
 * excess is simply absorbed (the "over — trim a payment" surfacing is a UI
 * concern for a later PR; this helper only does the pure math).
 *
 * `creditPhp` + `amount_php` are whole PESOS (matching PlanInstance). Pure + total.
 */
export function applyCreditToFinalInstallment<T extends { amount_php: number }>(
  instances: T[],
  creditPhp: number,
): T[] {
  const out = (instances ?? []).map((i) => ({ ...i }));
  let remaining = Math.max(0, num(creditPhp));
  for (let i = out.length - 1; i >= 0 && remaining > 0; i--) {
    const inst = out[i];
    if (!inst) continue;
    const amt = Math.max(0, num(inst.amount_php));
    const applied = Math.min(amt, remaining);
    inst.amount_php = amt - applied;
    remaining -= applied;
  }
  return out;
}
