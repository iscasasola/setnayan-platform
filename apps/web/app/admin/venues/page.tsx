import { redirect } from 'next/navigation';

/**
 * Legacy /admin/venues → Accounts Studio redirect (Accounts Studio slice 2).
 *
 * The Venues LIST now lives at /admin/accounts?tab=venues; its body was
 * re-homed byte-identical into app/admin/accounts/_surfaces/venues-surface.tsx.
 * This stub forwards every incoming search param (q, type, city) onto the
 * studio route so bookmarks + deep-links land on the Venues tab.
 *
 * NOTE: only the LIST route redirects. The standalone sub-routes stay put and
 * remain directly reachable from the tab:
 *   - /admin/venues/[id] (detail / edit)
 *   - /admin/venues/new  (create)
 * actions.ts + _constants.ts + venue-form.tsx are intentionally NOT moved — the
 * re-homed surface imports from their existing locations, and the sub-routes
 * still use them.
 */
export const dynamic = 'force-dynamic';

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function AdminVenuesRedirect({ searchParams }: Props) {
  const search = await searchParams;
  const params = new URLSearchParams();
  params.set('tab', 'venues');
  for (const key of ['q', 'type', 'city']) {
    const val = first(search[key]);
    if (val !== undefined) params.set(key, val);
  }
  redirect(`/admin/accounts?${params.toString()}`);
}
