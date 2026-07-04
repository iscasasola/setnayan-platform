import { redirect } from 'next/navigation';

/**
 * Legacy /admin/songs → Studio Studio redirect (Studio Studio slice 2).
 *
 * The master song catalogue now lives at /admin/studio?tab=songs; its body was
 * re-homed byte-identical into app/admin/studio/_surfaces/songs-surface.tsx.
 * This stub forwards the incoming q / merged / deleted / error search params
 * onto the studio route so the search filter + the mergeSongsAction /
 * deleteSongAction redirects (which still return to /admin/songs?merged=1 etc.)
 * surface on the Songs tab.
 *
 * NOTE: actions.ts is intentionally NOT moved — the re-homed surface imports
 * mergeSongsAction / deleteSongAction from here.
 */
export const dynamic = 'force-dynamic';

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function AdminSongsRedirect({ searchParams }: Props) {
  const search = await searchParams;
  const params = new URLSearchParams();
  params.set('tab', 'songs');
  for (const key of ['q', 'merged', 'deleted', 'error']) {
    const val = first(search[key]);
    if (val !== undefined) params.set(key, val);
  }
  redirect(`/admin/studio?${params.toString()}`);
}
