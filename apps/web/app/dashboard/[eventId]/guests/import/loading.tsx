/* Loading shell for dashboard/[eventId]/guests/import — owner perf pass 2026-06-03 (instant animated skeleton). */
import { FormPageSkeleton } from '@/components/skeletons';

export default function Loading() {
  // 👻 Ghost (motion standard 18 Nov 2026): the title is known, so it shows at once; the rest is grey.
  return <FormPageSkeleton title="Import guests from a file" />;
}
