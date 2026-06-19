// Papic crew — seat-roster card-grid shell.
import { GridPageSkeleton } from '@/components/skeletons';

export default function Loading() {
  return <GridPageSkeleton tiles={4} cols="sm:grid-cols-2" />;
}
