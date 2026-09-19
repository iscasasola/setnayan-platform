import { redirect } from 'next/navigation';
import { BOOKINGS_ANCHOR } from '../customers/anchors';

/**
 * /vendor-dashboard/bookings — folded into the My Customers hub (owner 5-page IA,
 * 2026-07-12: "overview, my shop, my customers, my performance, BEO are all
 * 1-page each with the different features integrated"). The surface lives on
 * in ./surface.tsx, rendered by the hub's ?tab=bookings. This stub keeps every
 * old deep-link working and forwards its params (pattern: /vendor-dashboard/
 * services → My Shop, owner 2026-07-02).
 */
export default async function RedirectBookings({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams();
  qs.set('tab', 'bookings');
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === 'string' && v.length > 0 && k !== 'tab') qs.set(k, v);
  }
  // 🔑 `#bookings` IS THE FIX (S43 · 3). `bookings` is not an accordion key on
  // the hub, so without the fragment every "Bookings" link reloaded My
  // Customers at the TOP — the roster — and the Bookings list the link named
  // sat unseen further down. The hub renders it at `<div id="bookings">`.
  redirect(`/vendor-dashboard/customers?${qs.toString()}${BOOKINGS_ANCHOR}`);
}
