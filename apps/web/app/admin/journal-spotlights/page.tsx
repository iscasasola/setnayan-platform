import { redirect } from 'next/navigation';

/**
 * Legacy /admin/journal-spotlights → Studio Studio redirect (Studio Studio
 * slice 3).
 *
 * Journal Spotlights curation now lives at /admin/studio?tab=journal-spotlights;
 * its body was re-homed byte-identical into
 * app/admin/studio/_surfaces/journal-spotlights-surface.tsx. This stub forwards
 * the incoming ok / error search params onto the studio route so the
 * attachSpotlight / approveFreeSpotlight / initiateSponsored / confirmSponsored
 * / removeSpotlight redirects (which still return to
 * /admin/journal-spotlights?ok=… / ?error=…) surface their banner on the Journal
 * Spotlights tab.
 *
 * NOTE: actions.ts is intentionally NOT moved — the re-homed surface imports
 * its server actions from here.
 */
export const dynamic = 'force-dynamic';

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function AdminJournalSpotlightsRedirect({ searchParams }: Props) {
  const search = await searchParams;
  const params = new URLSearchParams();
  params.set('tab', 'journal-spotlights');
  for (const key of ['ok', 'error']) {
    const val = first(search[key]);
    if (val !== undefined) params.set(key, val);
  }
  redirect(`/admin/studio?${params.toString()}`);
}
