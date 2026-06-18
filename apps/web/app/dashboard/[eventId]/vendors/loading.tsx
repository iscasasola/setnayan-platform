import { ListPageSkeleton } from '@/components/skeletons';

export default function VendorsLoading() {
  return <ListPageSkeleton rows={8} stats={4} actions={1} />;
}
