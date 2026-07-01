import { redirect } from 'next/navigation';

export const metadata = { title: 'Funnel · Vendor' };

export const dynamic = 'force-dynamic';

/**
 * RETIRED 2026-07-02 (owner "just integrate this to My Performance"). The
 * Quote-to-Booking Funnel — the four-stage funnel AND its "where they came from"
 * by-source breakdown — was folded into /vendor-dashboard/performance (and the
 * bookings-by-source strip added to /vendor-dashboard/demand). This stub keeps
 * the old route from 404-ing on a stale bookmark by sending it to the new home.
 */
export default function RetiredVendorFunnelPage() {
  redirect('/vendor-dashboard/performance');
}
