/**
 * /vendor/fit/[ref] — the fit check while the server answers. "No such shop" is decided by `./layout.tsx` before
 * this streams, so a 404 is never sent as a 200 + skeleton. The heading is the shop's own name (grey here).
 */
import { DetailPageSkeleton } from '@/components/skeletons';

export default function VendorFitLoading() {
  return <DetailPageSkeleton title />;
}
