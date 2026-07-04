import { redirect } from 'next/navigation';

/**
 * Legacy /admin/spotlight-awards → Studio Studio redirect (Studio Studio slice 3).
 *
 * Spotlight Awards curation now lives at /admin/studio?tab=spotlight-awards; its
 * body was re-homed byte-identical into
 * app/admin/studio/_surfaces/spotlight-awards-surface.tsx. This stub forwards the
 * incoming ok / error search params onto the studio route so the
 * addAwardManually / SpotlightAwardRowActions redirects (which still return to
 * /admin/spotlight-awards?ok=… / ?error=…) surface their banner on the Spotlight
 * Awards tab.
 *
 * NOTE: actions.ts + _components/ are intentionally NOT moved — the re-homed
 * surface imports addAwardManually / SpotlightRecomputeButton /
 * SpotlightAwardRowActions from here.
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
  params.set('tab', 'spotlight-awards');
  for (const key of ['ok', 'error']) {
    const val = first(search[key]);
    if (val !== undefined) params.set(key, val);
  }
  redirect(`/admin/studio?${params.toString()}`);
}
