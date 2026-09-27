import { FeedPageSkeleton } from '@/components/skeletons';

// The Schedule rebuild (2026-09-28) moved the header's controls below the
// masthead — Announce sits beside the Journey · Preparation · Event Day switch —
// so the masthead itself carries no button and the skeleton reserves none
// (`the-skeleton-promises-only-what-the-page-draws.test.ts`).
export default function ScheduleLoading() {
  return <FeedPageSkeleton items={5} />;
}
