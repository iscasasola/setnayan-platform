/**
 * /proposals/[publicId] — a quote while the server answers. Sign-in and "not yours" are decided by `./layout.tsx`
 * before this streams, so a 307 / 404 is never sent as a 200 + skeleton. The quote's title is its own (grey here).
 */
import { DetailPageSkeleton } from '@/components/skeletons';

export default function ProposalLoading() {
  return <DetailPageSkeleton title />;
}
