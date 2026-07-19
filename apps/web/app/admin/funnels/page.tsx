import { redirect } from 'next/navigation';

/**
 * Legacy /admin/funnels → Insights Studio redirect (2026-07-10).
 *
 * The funnels readout now lives at /admin/app-performance?tab=funnels; its body
 * was re-homed into app/admin/app-performance/_surfaces/funnels-surface.tsx. This
 * stub forwards incoming deep-links + any post-action redirects onto the studio
 * tab so bookmarks keep working. actions/_components stay in this dir — the
 * re-homed surface imports them from here.
 */
export const dynamic = 'force-dynamic';

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function FunnelsRedirect({ searchParams }: Props) {
  const search = await searchParams;
  const out = new URLSearchParams();
  out.set('tab', 'funnels');
  const range = first(search.range);
  if (range !== undefined) out.set('range', range);
  const vendor = first(search.vendor);
  if (vendor !== undefined) out.set('vendor', vendor);
  redirect(`/admin/app-performance?${out.toString()}`);
}
