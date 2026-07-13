import { SectionDrawer } from '../../_components/section-drawer';
import EventActivityPage from '../../activity/page';

/**
 * Intercepts a SOFT navigation to /dashboard/[eventId]/activity (e.g. the
 * Overview "See all recent activity" link) and renders the activity feed in the
 * in-place drawer. Composes the real page component — one source of the view.
 * Hard load / refresh renders the full page normally.
 */
export const dynamic = 'force-dynamic';

export default async function InterceptedActivity({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  return (
    <SectionDrawer label="Recent activity">
      <EventActivityPage params={params} />
    </SectionDrawer>
  );
}
