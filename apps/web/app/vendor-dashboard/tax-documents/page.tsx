import { redirect } from 'next/navigation';

/**
 * /vendor-dashboard/tax-documents — RETIRED 2026-05-29.
 *
 * This page used to surface BIR Form 2307 (Certificate of Creditable Tax
 * Withheld at Source) PDFs that Setnayan issued vendors quarterly under
 * the V1 marketplace model. Under V2 publisher posture (CLAUDE.md tenth
 * 2026-05-28 row · v2.1 brief canonical lock) Setnayan no longer:
 *
 *   • Takes commission on vendor bookings (0%).
 *   • Sits in the booking-money path.
 *   • Withholds income tax on vendor payouts.
 *
 * Per RR 16-2023 1% Intermediary Tax exemption, Setnayan has no Form 2307
 * obligation toward vendors. Vendors handle their own Form 2307 as the
 * income recipient.
 *
 * Lib + tables preserved as audit history (any 2307 issued under V1 stays
 * retrievable via Supabase Studio for the BIR five-year retention window).
 * Direct URL access redirects to the vendor profile page for bookmark
 * continuity.
 *
 * Cross-references:
 *   • CLAUDE.md 2026-05-28 third row § V2 cutover
 *   • CLAUDE.md 2026-05-28 tenth row § v2.1 brief canonical lock
 *   • CLAUDE.md 2026-05-29 row (this retirement)
 *   • iteration 0026 BIR Tax Compliance (canonical · ORs stay)
 */
export default function RetiredVendorTaxDocumentsPage(): never {
  redirect('/vendor-dashboard');
}
