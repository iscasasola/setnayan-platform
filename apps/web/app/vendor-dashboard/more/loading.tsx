/* Instant loading shell for /vendor-dashboard/more — a short list, one row per
   room (`lib/vendor-more-rows.ts`), since the 2026-10-01 supplier phone app. */
import { ListPageSkeleton } from '@/components/skeletons';

export default function MoreLoading() {
  return <ListPageSkeleton rows={7} toolbar={false} />;
}
