/* Instant loading shell for /vendor-dashboard/more — mobile overflow nav-card grid. */
import { GridPageSkeleton } from '@/components/skeletons';

export default function MoreLoading() {
  return <GridPageSkeleton tiles={8} cols="sm:grid-cols-2" tileClass="h-28" actions={0} />;
}
