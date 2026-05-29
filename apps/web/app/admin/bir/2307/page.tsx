import { redirect } from 'next/navigation';

/**
 * /admin/bir/2307 — RETIRED 2026-05-29.
 *
 * BIR Form 2307 (Certificate of Creditable Tax Withheld at Source) was
 * needed under the V1 marketplace model where Setnayan acted as the
 * booking-payment withholding agent for vendor payouts. With the V2
 * publisher posture locked at CLAUDE.md tenth 2026-05-28 row (canonical
 * v2.1 brief) Setnayan no longer:
 *
 *   • Takes commission on vendor bookings (0%).
 *   • Sits in the booking-money path (customer pays vendor directly,
 *     off-platform).
 *   • Withholds income tax on vendor payouts.
 *
 * Per RR 16-2023 1% Intermediary Tax exemption (referenced in CLAUDE.md
 * 2026-05-28 third row V2 Phase F manpower lock) Setnayan has no
 * BIR 2307 / EWT obligation on the vendor leg. Vendors handle their own
 * Form 2307 as the income recipient. Setnayan's own tax surface for V2 is
 * Official Receipts on software-SKU sales — see iteration 0026 +
 * /admin/receipts.
 *
 * The form-generation lib (apps/web/lib/bir/* · `bir_2307_filings` +
 * `vendor_2307_filings` tables) are preserved as audit history so any
 * 2307 issued under V1 stays retrievable for the BIR five-year retention
 * window. New 2307 generation is OFF. Direct URL access redirects to the
 * canonical Money landing for bookmark continuity.
 *
 * Cross-references:
 *   • CLAUDE.md 2026-05-28 third row § V2 cutover (architectural pivot)
 *   • CLAUDE.md 2026-05-28 tenth row § v2.1 brief canonical lock
 *   • CLAUDE.md 2026-05-29 row (this retirement)
 *   • iteration 0026 BIR Tax Compliance (canonical · Official Receipts stay)
 *   • PR #618 V2 Phase F manpower (2307-EXEMPT note for manpower leg)
 */
export default function RetiredBir2307Page(): never {
  redirect('/admin/money');
}
