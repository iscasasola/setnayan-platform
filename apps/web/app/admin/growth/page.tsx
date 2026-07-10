import { redirect } from 'next/navigation';

/**
 * Legacy /admin/growth → Insights Studio redirect (2026-07-10).
 *
 * The growth readout now lives at /admin/app-performance?tab=growth; its body
 * was re-homed into app/admin/app-performance/_surfaces/growth-surface.tsx. This
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

export default async function GrowthRedirect({ searchParams }: Props) {
  const search = await searchParams;
  const out = new URLSearchParams();
  out.set('tab', 'growth');
  const range = first(search.range);
  if (range !== undefined) out.set('range', range);
  const demo = first(search.demo);
  if (demo !== undefined) out.set('demo', demo);
  redirect(`/admin/app-performance?${out.toString()}`);
}
