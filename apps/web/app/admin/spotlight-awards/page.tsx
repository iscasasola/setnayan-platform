import { redirect } from 'next/navigation';

/**
 * Legacy /admin/spotlight-awards → Money › Badges & seals (controller 15 Nov 2026; DECISION_LOG dd7d05f1 (4): the
 * monthly Spotlight Awards view folds into the badges page). It forwards the incoming ok / error search params so
 * the addAwardManually / SpotlightAwardRowActions redirects (which still return to /admin/spotlight-awards?ok=… /
 * ?error=…) show their banner on the badges page's seals section, where the surface is mounted.
 *
 * NOTE: actions.ts + _components/ stay here — the surface (app/admin/studio/_surfaces/spotlight-awards-surface.tsx)
 * imports addAwardManually / SpotlightRecomputeButton / SpotlightAwardRowActions from here.
 */
export const dynamic = 'force-dynamic';

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function AdminSpotlightAwardsRedirect({ searchParams }: Props) {
  const search = await searchParams;
  const params = new URLSearchParams();
  // 🏅 The monthly Spotlight Awards fold into Money › Badges & seals (DECISION_LOG dd7d05f1 (4)), so their own
  // ok / error redirects land on that page's seals section.
  for (const key of ['ok', 'error']) {
    const val = first(search[key]);
    if (val !== undefined) params.set(key, val);
  }
  const qs = params.toString();
  redirect(qs ? `/admin/badges?${qs}` : '/admin/badges');
}
