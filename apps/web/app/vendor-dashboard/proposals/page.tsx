import { redirect } from 'next/navigation';

/**
 * /vendor-dashboard/proposals — folded into the My Shop hub (owner 5-page IA,
 * 2026-07-12: "overview, my shop, my customers, my performance, BEO are all
 * 1-page each with the different features integrated"). The surface lives on
 * in ./surface.tsx, rendered by the hub's ?tab=proposals. This stub keeps every
 * old deep-link working and forwards its params (pattern: /vendor-dashboard/
 * services → My Shop, owner 2026-07-02).
 */
export default async function RedirectProposals({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams();
  qs.set('tab', 'proposals');
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === 'string' && v.length > 0 && k !== 'tab') qs.set(k, v);
  }
  redirect(`/vendor-dashboard/shop?${qs.toString()}`);
}
