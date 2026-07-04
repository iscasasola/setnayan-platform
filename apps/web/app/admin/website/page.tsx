import { redirect } from 'next/navigation';

/**
 * Legacy /admin/website → Studio Studio redirect (Studio Studio slice 1).
 *
 * The Website editor now lives at /admin/studio?tab=website; its body was
 * re-homed byte-identical into app/admin/studio/_surfaces/website-surface.tsx.
 * This stub forwards the incoming `page` search param onto the studio route so
 * bookmarks + deep-links land on the Website tab.
 *
 * NOTE: widget-list.tsx is intentionally NOT moved — the re-homed surface
 * imports WidgetList from here.
 */
export const dynamic = 'force-dynamic';

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function AdminWebsiteRedirect({ searchParams }: Props) {
  const search = await searchParams;
  const params = new URLSearchParams();
  params.set('tab', 'website');
  const page = first(search.page);
  if (page !== undefined) params.set('page', page);
  redirect(`/admin/studio?${params.toString()}`);
}
