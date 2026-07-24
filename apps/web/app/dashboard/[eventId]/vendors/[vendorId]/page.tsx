import { redirect } from 'next/navigation';

// Bare /dashboard/[eventId]/vendors/[vendorId] has no content of its own — the
// canonical per-service room is `.../workspace` (the 33-call-site convention).
// Several registries historically emitted this bare href (e.g.
// lib/shortlist-taxonomy.ts), and at sub-xl viewports the inspector column
// navigates to it instead of opening the drawer — landing on a 404. Redirecting
// here makes EVERY bare-route navigation resolve to the workspace, present and
// future, rather than chasing individual emitters. (gap audit 2026-07-23 · G)
export default async function VendorIndexRedirect({
  params,
}: {
  params: Promise<{ eventId: string; vendorId: string }>;
}) {
  const { eventId, vendorId } = await params;
  redirect(`/dashboard/${eventId}/vendors/${vendorId}/workspace`);
}
