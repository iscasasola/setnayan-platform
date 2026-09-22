/**
 * payment-destination.ts — which platform-settings fields decide WHERE money
 * arrives, and which only decide whether it may arrive at all.
 *
 * ── Why the distinction is the whole design ─────────────────────────────────
 * Vendor Agreement § 9.1 gates one thing here:
 *
 *     | Modify Setnayan's static BDO / GCash payment-receiving account numbers
 *     | Payment redirection = fraud risk |
 *
 * **Redirection.** Not "touching the payments page". `/admin/settings/payment-methods`
 * saves destination fields, kill switches, monthly caps and available-balance
 * readings in one form, and only the first group can send money to a stranger.
 *
 * 🔒 GATING THE KILL SWITCHES WOULD MAKE THE SYSTEM LESS SAFE, NOT MORE, AND
 * THAT IS WHY THEY ARE DELIBERATELY EXCLUDED. `savePaymentInstruments` already
 * documents why an unchecked box must mean OFF: *"which is the direction that
 * matters when an account is at its cap and transfers are bouncing."* Requiring
 * a second admin before you can CLOSE a bouncing rail would hold the rail open
 * while payments fail. A control whose purpose is to stop money should never
 * wait on a quorum.
 *
 * ── The third door ──────────────────────────────────────────────────────────
 * ⚠ A QR IMAGE IS A DESTINATION. Scanning it sends money, so replacing the QR
 * redirects funds exactly as changing the number does — and it is a SEPARATE
 * action (`uploadMerchantQr`), on a separate form, that never touches the text
 * fields. A gate on `savePaymentInstruments` alone would be decoration: the
 * account number would be protected and the thing customers actually scan
 * would not.
 *
 * 🔑 Enumerating the doors is the work. Two of the three are obvious from the
 * column names; the third is obvious only from what a customer does with it.
 *
 * `removeMerchantQr` is deliberately NOT gated: deleting a QR withdraws a
 * payment option, it does not point one somewhere new. Re-pointing means
 * uploading, and uploading is gated.
 */

/** The fields that decide WHERE money lands. Changing any is a § 9.1 action. */
export const PAYMENT_DESTINATION_FIELDS = [
  'bdo_account_name',
  'bdo_account_number',
  'gcash_account_name',
  'gcash_number',
] as const;

export type PaymentDestinationField = (typeof PAYMENT_DESTINATION_FIELDS)[number];

/**
 * Fields on the same form that are NOT destinations — listed so the exclusion
 * is a decision on the record rather than an omission someone later "fixes".
 */
export const PAYMENT_RAIL_CONTROLS = [
  'gcash_enabled',
  'bdo_enabled',
  'gcash_monthly_cap_php',
  'bdo_monthly_cap_php',
  'gcash_available_php',
  'bdo_available_php',
] as const;

/** The QR columns. A QR is a destination; see the module docblock. */
export const PAYMENT_QR_COLUMNS = ['bdo_qr_url', 'gcash_qr_url'] as const;

/**
 * Compare stored against submitted, field by field.
 *
 * ⚠ `null`, `''` and `'  '` all mean "not set" on this form — `nullIfBlank`
 * collapses them on the way in, but the STORED side comes from Postgres and
 * only ever holds `null`. Comparing raw would report a change every time an
 * admin saved a form with an empty BDO name, opening an approval for a
 * difference that is not one. Normalise both sides.
 */
function normalise(v: string | null | undefined): string | null {
  if (v == null) return null;
  const t = String(v).trim();
  return t.length === 0 ? null : t;
}

export function changedDestinationFields(
  current: Partial<Record<PaymentDestinationField, string | null>>,
  submitted: Partial<Record<PaymentDestinationField, string | null>>,
): PaymentDestinationField[] {
  return PAYMENT_DESTINATION_FIELDS.filter(
    (f) => normalise(current[f]) !== normalise(submitted[f]),
  );
}

/** True when this save would move money somewhere new. */
export function redirectsMoney(
  current: Partial<Record<PaymentDestinationField, string | null>>,
  submitted: Partial<Record<PaymentDestinationField, string | null>>,
): boolean {
  return changedDestinationFields(current, submitted).length > 0;
}

/** Human-readable, for the approval rationale an admin will read. */
export function describeDestinationChange(
  current: Partial<Record<PaymentDestinationField, string | null>>,
  submitted: Partial<Record<PaymentDestinationField, string | null>>,
): string {
  return changedDestinationFields(current, submitted)
    .map((f) => `${f}: ${normalise(current[f]) ?? '(unset)'} → ${normalise(submitted[f]) ?? '(unset)'}`)
    .join(' · ');
}
