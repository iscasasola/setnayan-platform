import { redirect } from 'next/navigation';

/**
 * /vendor-dashboard/demand — folded into the My Performance page (owner 5-page IA,
 * 2026-07-12). The Demand Radar now renders inline in My Performance's
 * "Looking ahead & the market" section (Pro-and-up), so this stub just forwards
 * every old deep-link there (pattern: /vendor-dashboard/services → My Shop,
 * owner 2026-07-02). The old ?tab=demand fold was retired 2026-07-16 when the
 * radar was consolidated to a single inline surface.
 */
export default async function RedirectDemand({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === 'string' && v.length > 0 && k !== 'tab') qs.set(k, v);
  }
  const query = qs.toString();
  redirect(`/vendor-dashboard/performance${query ? `?${query}` : ''}`);
}
