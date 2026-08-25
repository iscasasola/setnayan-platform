// Loading shell mirroring the Orders route (order/receipt list).
import { ListPageSkeleton } from '@/components/skeletons';

export default function Loading() {
  return <ListPageSkeleton actions={1} />;
}
