/* Instant loading shell for /vendor-dashboard/team/roles/inquiries — who gets new inquiries. */
import { FormPageSkeleton } from '@/components/skeletons';

export default function Loading() {
  // 👻 Ghost (motion standard 18 Nov 2026): the title is known, so it shows at once; the rest is grey.
  return <FormPageSkeleton title="Who gets new inquiries" />;
}
