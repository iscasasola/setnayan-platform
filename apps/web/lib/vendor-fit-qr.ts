/**
 * vendor-fit-qr.ts — the couple-facing "check my fit" QR (2026-07-09).
 *
 * A vendor's fit-check QR encodes a STABLE, read-only URL keyed to the vendor's
 * public ref (business slug, else public_id) — NOT a single-use token like the
 * Locked QR (`vendor-locked-qr.ts`). One QR, reusable, no DB row: a couple scans
 * it and sees whether the vendor fits THEIR event (date · reach · budget), then
 * can add it to their shortlist. This is the deliberate opposite of the Locked
 * QR, which atomically COMMITS a booking — the fit QR only READS + shortlists.
 *
 * The `computeVendorFit` verdict is pure so it can be unit-tested; the page/action
 * feed it data resolved from the same primitives the dashboard fit-badges use
 * (vendor-tier-caps radius, vendor-availability, budget snapshot, Haversine).
 */

/** The couple-facing URL the fit QR encodes. `ref` is the vendor's business slug
 *  (preferred) or public_id — never the raw vendor_profile_id UUID. */
export function buildVendorFitUrl(ref: string): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com';
  return `${appUrl.replace(/\/$/, '')}/vendor/fit/${encodeURIComponent(ref)}`;
}

export type FitCheckInput = {
  /** The event's locked date (ISO YYYY-MM-DD), or null when the couple is still
   *  weighing candidate dates — then the date check is "not set" (unknown). */
  eventDate: string | null;
  /** Whether the vendor is free on `eventDate` (from vendor-availability). Null
   *  when there's no locked date to check against. */
  vendorAvailableOnDate: boolean | null;
  /** km from the event venue to the vendor (Haversine), or null when either
   *  side's coords are unknown. */
  distanceKm: number | null;
  /** The vendor's finite tier service radius in km (Verified 20 · Pro 50), or
   *  null when unscoped (Free) / nationwide (Enterprise) — then reach is unknown. */
  serviceRadiusKm: number | null;
  /** The vendor's "starts at" price (vendor_services.starting_price_php), or null. */
  startingPricePhp: number | null;
  /** The event's remaining budget (budget snapshot totals.remaining), or null
   *  when no budget is set. */
  remainingBudgetPhp: number | null;
};

export type FitCheck = { key: 'date' | 'reach' | 'budget'; ok: boolean | null; label: string };
export type FitVerdict = { fits: boolean; checks: FitCheck[] };

/**
 * Warn-only verdict (owner-locked): a check reads `ok:false` only when we KNOW
 * it fails; unknown inputs read `ok:null` and never fail the overall `fits`.
 * `fits` is true iff no known check is false — matching the dashboard's
 * fail-open, never-fabricate-an-unavailability rule.
 */
export function computeVendorFit(i: FitCheckInput): FitVerdict {
  const checks: FitCheck[] = [];

  if (i.eventDate == null || i.vendorAvailableOnDate == null) {
    checks.push({ key: 'date', ok: null, label: 'Set your date to check' });
  } else {
    checks.push({
      key: 'date',
      ok: i.vendorAvailableOnDate,
      label: i.vendorAvailableOnDate ? 'Free on your date' : 'Booked on your date',
    });
  }

  const reachKnown = i.distanceKm != null && i.serviceRadiusKm != null;
  const reachOk = i.distanceKm == null || i.serviceRadiusKm == null || i.distanceKm <= i.serviceRadiusKm;
  checks.push({
    key: 'reach',
    ok: reachKnown ? reachOk : null,
    label: !reachKnown
      ? 'Reach unknown'
      : reachOk
        ? 'Reaches your venue'
        : `Beyond their ${i.serviceRadiusKm}km range`,
  });

  if (i.startingPricePhp == null || i.remainingBudgetPhp == null) {
    checks.push({ key: 'budget', ok: null, label: 'Set your budget to check' });
  } else {
    const ok = i.startingPricePhp <= i.remainingBudgetPhp;
    checks.push({ key: 'budget', ok, label: ok ? 'Within your budget' : 'Over your remaining budget' });
  }

  return { fits: checks.every((c) => c.ok !== false), checks };
}
