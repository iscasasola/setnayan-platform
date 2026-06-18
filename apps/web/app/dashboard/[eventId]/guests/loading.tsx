import { GridPageSkeleton } from '@/components/skeletons';

export default function GuestsLoading() {
  return (
    <GridPageSkeleton
      tiles={15}
      cols="grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
      tileClass="h-24"
      actions={2}
    />
  );
}
