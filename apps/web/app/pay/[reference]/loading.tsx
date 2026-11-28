/**
 * /pay/[reference] — the pay page while the server answers. Sign-in, sign-up, "not yours / not real" and the store
 * shell's /web-only are decided by `./layout.tsx` before this streams, so none of them is sent as a 200 + skeleton.
 * The heading is the order's own title (not known here, so grey), then the amount and the pay panel.
 */
import { FormPageSkeleton } from '@/components/skeletons';

export default function PayLoading() {
  return <FormPageSkeleton title fields={3} />;
}
