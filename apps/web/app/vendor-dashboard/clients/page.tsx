import { redirect } from 'next/navigation';

/**
 * /vendor-dashboard/clients — the old "Clients" list. Its three buckets (Booked
 * via Setnayan · In conversation · Outside clients) and the kept notes under
 * them ARE Customers › People now — one list, not two (supplier redesign S-PR2,
 * 2026-10-10; `./surface.tsx` is retired). This stub keeps every old deep-link
 * working and forwards its params: `?tab=clients` is the word the hub's
 * `customersSegment` reads to land on People, and `?notice=` (the outcome of
 * adding or removing an outside client — `calendar/actions.ts` still returns
 * here) is said there as a toast.
 *
 * `/vendor-dashboard/clients/[eventId]` — a customer's card — is a different
 * route and is untouched.
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
