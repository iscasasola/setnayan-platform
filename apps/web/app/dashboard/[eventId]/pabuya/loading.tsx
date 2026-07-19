import { ListPageSkeleton } from '@/components/skeletons';

export default function PabuyaLoading() {
  return <ListPageSkeleton rows={3} toolbar={false} stats={0} actions={1} />;
}
