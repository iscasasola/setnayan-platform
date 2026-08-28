// Loading shell for admin/taxonomy — owner perf pass 2026-06-03 (instant
// animated skeleton). One masthead action since C2 (2026-08-28): the
// "Trade aliases" link.
import { ListPageSkeleton } from '@/components/skeletons';

export default function Loading() {
  return <ListPageSkeleton actions={1} />;
}
