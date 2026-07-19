import { redirect } from 'next/navigation';

import type { ServicesManagerSearch } from './_components/services-manager';

/**
 * /vendor-dashboard/services — RETIRED as a standalone destination (owner
 * 2026-07-02: "My Services" fully folded into My Shop). The editor now lives on
 * /vendor-dashboard/shop; this route redirects there, preserving any deep-link
 * params (?saved / ?offpeak / ?add / … — the guided-wizard return, the
 * off-season nudge, the inbound "add a service" links) so the "Your services"
 * section opens. The shared <VendorServicesManager> renders on My Shop.
 *
 * The guided wizard child route (/vendor-dashboard/services/new/[category]) is a
 * separate segment and is NOT affected by this redirect.
 */
export default async function VendorServicesRedirect({
  searchParams,
}: {
  searchParams: Promise<ServicesManagerSearch>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (typeof value === 'string' && value.length > 0) qs.set(key, value);
  }
  const query = qs.toString();
  redirect(`/vendor-dashboard/shop${query ? `?${query}` : ''}`);
}
