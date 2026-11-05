import { redirect } from 'next/navigation';
import { customerLandingAnchor } from '../customers/anchors';

/**
 * /vendor-dashboard/earnings — folded into Customers › Money (S-PR4; corpus
 * `SUPPLIER_DASHBOARD_REDESIGN_2026-10-08_fable.md` § 2: "`earnings/surface.tsx` (KPI tiles, 12 months, legacy
 * payouts, BookingFeeBills) — Merge into Customers › Money"; § 8 "`/payday`, `/earnings` … Money (05) — redirects").
 * It used to forward to My Shop, where the ledger was mounted; the year, the fee bills and the legacy payouts live in
 * Money now. This stub keeps every old deep-link (admin revalidations, the payouts notification) landing, with its
 * params.
 */
export default async function RedirectEarnings({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams();
  qs.set('seg', 'money');
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === 'string' && v.length > 0 && k !== 'seg' && k !== 'tab') qs.set(k, v);
  }
  redirect(`/vendor-dashboard/customers?${qs.toString()}${customerLandingAnchor('payday')}`);
}
