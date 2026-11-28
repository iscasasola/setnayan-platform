/**
 * /papic/order/[token] — a guest's Papic order while the server answers. The switch, the token and the order row are
 * decided by `./layout.tsx` before this streams, so a 404 is never sent as a 200 + skeleton. The heading is the
 * order's own description (grey here), then the amount and the ways to pay.
 */
import { FormPageSkeleton } from '@/components/skeletons';

export default function PapicOrderLoading() {
  return <FormPageSkeleton title fields={3} />;
}
