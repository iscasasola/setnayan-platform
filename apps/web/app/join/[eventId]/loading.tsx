// Event join flow — form shell while the event/role loads.
import { FormPageSkeleton } from '@/components/skeletons';

/*
 * `title` is passed ON PURPOSE. The page-header retirement of 2026-08-21 emptied
 * the header on the three AUTHENTICATED trees only — this page is not one of
 * them: it paints a real, visible eyebrow + title of its own, so the skeleton
 * that stands in for it must draw one too.
 */
export default function JoinLoading() {
  return <FormPageSkeleton title />;
}

