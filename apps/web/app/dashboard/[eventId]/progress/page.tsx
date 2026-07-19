import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

/**
 * /dashboard/[eventId]/progress — RETIRED as a standalone route (owner
 * directive 2026-07-10: the event Home IS the dashboard). The journey rail +
 * decisions board + around-your-event surface now render in place on the Home
 * (`/dashboard/[eventId]`) via `<EventDashboard>` (see
 * `../_components/event-dashboard.tsx`). This route redirects there,
 * forwarding the internal-only `?suri=preview` override so stale bookmarks +
 * in-app links land on the live surface with the same AI-state preview.
 *
 * The `_components/*` (journey-rail, free-venue-shortlist-offer) and
 * `_actions/*` (free-venue-shortlist) under this folder are STILL LIVE —
 * `<EventDashboard>` imports them across from here.
 */
export default async function EventProgressRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams?: Promise<{ suri?: string }>;
}) {
  const { eventId } = await params;
  const search = searchParams ? await searchParams : {};
  const suffix = search.suri ? `?suri=${encodeURIComponent(search.suri)}` : '';
  redirect(`/dashboard/${eventId}${suffix}`);
}
