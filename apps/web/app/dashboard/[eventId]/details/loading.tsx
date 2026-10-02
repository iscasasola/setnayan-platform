/* Loading shell for dashboard/[eventId]/details — owner perf pass 2026-06-03 (instant animated skeleton). */
import { FormPageSkeleton } from '@/components/skeletons';
import { LastSeenFallback } from '@/app/_components/last-seen/last-seen-fallback';

// 💾 Last-seen data shows at once, then refreshes (owner 2026-10-02) — the
// skeleton stays for a first visit, a filtered view, or nothing kept.
export default function EventDetailsLoading() {
  return (
    <LastSeenFallback page="details">
      <FormPageSkeleton />
    </LastSeenFallback>
  );
}
