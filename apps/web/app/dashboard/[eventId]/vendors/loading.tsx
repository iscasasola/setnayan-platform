import { ListPageSkeleton } from '@/components/skeletons';
import { LastSeenFallback } from '@/app/_components/last-seen/last-seen-fallback';

export default function VendorsLoading() {
  // 💾 Last-seen data shows at once, then refreshes (owner 2026-10-02) — the
  // skeleton stays for a first visit, a filtered view, or nothing kept.
  return (
    <LastSeenFallback page="suppliers">
      <ListPageSkeleton rows={8} stats={4} />
    </LastSeenFallback>
  );
}
