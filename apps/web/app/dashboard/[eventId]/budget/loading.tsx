import { ListPageSkeleton } from '@/components/skeletons';

export default function BudgetLoading() {
  return <ListPageSkeleton rows={6} toolbar={false} stats={4} actions={0} />;
}
