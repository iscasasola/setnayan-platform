import { redirect } from 'next/navigation';

/**
 * /dashboard/[eventId]/design — RETIRED 2026-06-17 (customer-menu redesign).
 *
 * The Design tab was folded INTO Studio (owner-locked: 5 menus, no standalone
 * Design). Its surfaces now live under Studio's sections — Website (the public
 * site: Save the Date · RSVP · Event · Editorial) and Branding (Monogram · Wax
 * Stamp · Mood Board · LED Background · …). This route is kept only to redirect
 * any lingering links/bookmarks to the Studio hub. See lib/customer-menu.ts +
 * lib/add-ons-catalog.ts.
 */
export default async function DesignHubPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  redirect(`/dashboard/${eventId}/add-ons`);
}
