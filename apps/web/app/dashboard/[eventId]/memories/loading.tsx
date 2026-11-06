import { ListPageSkeleton } from '@/components/skeletons';

/**
 * Memories' own boundary, so a tap on the fifth tab does not borrow the event Home's shimmer (a title bar and a
 * subtitle this page does not have — the jump `galleries/loading.tsx` describes).
 */
export default function Loading() {
  return <ListPageSkeleton rows={3} toolbar={false} />;
}
