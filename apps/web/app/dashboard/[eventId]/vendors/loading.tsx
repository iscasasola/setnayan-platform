// Loading shell mirroring the Vendors route (Plan + Budget accordion of grouped picks).
import { ListPageSkeleton } from '@/components/skeletons';

export default function Loading() {
  return <ListPageSkeleton stats={3} />;
}
