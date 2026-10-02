import { FeedPageSkeleton } from '@/components/skeletons';
import { LastSeenFallback } from '@/app/_components/last-seen/last-seen-fallback';

// The Schedule rebuild (2026-09-28) moved the header's controls below the
// masthead — Announce sits beside the Journey · Preparation · Event Day switch —
// so the masthead itself carries no button and the skeleton reserves none
// (`the-skeleton-promises-only-what-the-page-draws.test.ts`).
export default function ScheduleLoading() {
  // 💾 Last-seen data shows at once, then refreshes (owner 2026-10-02) — the
  // skeleton stays for a first visit, a filtered view, or nothing kept.
  return (
    <LastSeenFallback page="schedule">
      <FeedPageSkeleton items={5} />
    </LastSeenFallback>
  );
}
