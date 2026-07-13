import { SectionDrawer } from '../../../../_components/section-drawer';
import { AddOnDetailView } from '../../../../studio/_components/addon-detail-view';

/**
 * Intercepts a SOFT navigation to /dashboard/[eventId]/studio/about/[addon]
 * (a Studio row / featured-card tap) and renders the App-Store detail INSIDE
 * the in-place drawer instead of a full-screen route swap. The page beneath
 * (the Studio grid) stays mounted; only this detail loads.
 *
 * A hard load / shared URL / refresh renders the real full page
 * (studio/about/[addon]/page.tsx) — this interceptor does not run then, so it's
 * purely additive. The owner-already-owns-it redirect lives on the full page;
 * the grid only links here for services the couple does NOT own, so no redirect
 * is needed in the drawer path.
 */
export const dynamic = 'force-dynamic';

export default async function InterceptedAddOnDetail({
  params,
}: {
  params: Promise<{ eventId: string; addon: string }>;
}) {
  const { eventId, addon } = await params;
  return (
    <SectionDrawer label="Service details">
      <AddOnDetailView eventId={eventId} addon={addon} />
    </SectionDrawer>
  );
}
