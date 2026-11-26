/* Instant loading shell for /vendor-dashboard/attributes — per-category attribute form. */
import { FormPageSkeleton } from '@/components/skeletons';

export default function Loading() {
  // 👻 Ghost: the pinned row's title is known (`ToolPin title="Attributes"`), so it shows at once.
  return <FormPageSkeleton title="Attributes" />;
}
