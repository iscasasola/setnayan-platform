import { ListPageSkeleton } from '@/components/skeletons';

/** Loading shimmers; it never looks like the empty list or the "Couldn't load requests" box. */
export default function Loading() {
  return <ListPageSkeleton />;
}
