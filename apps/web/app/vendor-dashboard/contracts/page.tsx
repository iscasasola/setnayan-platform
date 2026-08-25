import { redirect } from 'next/navigation';

/**
 * /vendor-dashboard/contracts — folded into a hub (owner 5-page IA, 2026-07-12:
 * "overview, my shop, my customers, my performance, BEO are all 1-page each
 * with the different features integrated"). The surface lives on in
 * ./surface.tsx, rendered by the hub's ?open=contracts (?tab= is the legacy
 * alias this stub emits). This stub keeps every old deep-link working and
 * forwards its params (pattern: /vendor-dashboard/services → My Shop, owner
 * 2026-07-02).
 *
 * ⚠ THE HUB CHANGED 2026-08-26 — it is **My Customers** now, not My Shop
 * (owner re-cut: "yes i agree"). A quote and a contract are papers about a
 * deal with one customer. Every inbound link in the app names THIS route, not
 * the hub, so changing the destination here moved all of them at once — the
 * client page, the send-a-quote card in a message thread, the requote nudge
 * and the public proposal page were not touched and did not need to be.
 * 🔑 The phone's bottom bar already lit **Customers** for this route while the
 * laptop opened it under My Shop; this ends that disagreement rather than
 * starting one.
 */
export default async function RedirectContracts({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams();
  qs.set('tab', 'contracts');
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === 'string' && v.length > 0 && k !== 'tab') qs.set(k, v);
  }
  redirect(`/vendor-dashboard/customers?${qs.toString()}`);
}
