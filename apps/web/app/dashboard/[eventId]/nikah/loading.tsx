import { ListPageSkeleton } from '@/components/skeletons';

/** The five essentials — a stacked list of rows under an sr-only heading. */
export default function Loading() {
  return <ListPageSkeleton rows={5} toolbar={false} actions={0} />;
}
