import { redirect } from 'next/navigation';

/**
 * /vendor-dashboard/clients — folded into the My Customers hub (owner 5-page IA,
 * 2026-07-12: "overview, my shop, my customers, my performance, BEO are all
 * 1-page each with the different features integrated"). The surface lives on
 * in ./surface.tsx, rendered by the hub's ?tab=clients. This stub keeps every
 * old deep-link working and forwards its params (pattern: /vendor-dashboard/
 * services → My Shop, owner 2026-07-02).
 */
export default async function RedirectClients({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams();
  qs.set('tab', 'clients');
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === 'string' && v.length > 0 && k !== 'tab') qs.set(k, v);
  }
  redirect(`/vendor-dashboard/customers?${qs.toString()}`);
}
