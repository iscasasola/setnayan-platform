import { redirect } from 'next/navigation';

/**
 * Legacy /admin/real-stories → Studio Studio redirect (Studio Studio slice 2).
 *
 * Real Stories featuring now lives at /admin/studio?tab=real-stories; its body
 * was re-homed byte-identical into
 * app/admin/studio/_surfaces/real-stories-surface.tsx. This stub forwards the
 * incoming ok / error search params onto the studio route so the
 * setShowcaseFeatured / setShowcaseRank redirects (which still return to
 * /admin/real-stories?ok=… / ?error=…) surface their banner on the Real Stories
 * tab.
 *
 * NOTE: actions.ts is intentionally NOT moved — the re-homed surface imports
 * setShowcaseFeatured / setShowcaseRank from here.
 */
export const dynamic = 'force-dynamic';

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function AdminRealStoriesRedirect({ searchParams }: Props) {
  const search = await searchParams;
  const params = new URLSearchParams();
  params.set('tab', 'real-stories');
  for (const key of ['ok', 'error']) {
    const val = first(search[key]);
    if (val !== undefined) params.set(key, val);
  }
  redirect(`/admin/studio?${params.toString()}`);
}
