/* Instant loading shell for /vendor-dashboard/notifications — notification list. The title is the house PageMasthead
   (sr-only, A6-15), so the skeleton draws no title bar. */
import { ListPageSkeleton } from '@/components/skeletons';

export default function Loading() {
  return <ListPageSkeleton actions={1} />;
}
