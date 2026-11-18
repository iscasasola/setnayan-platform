/* Instant loading shell for /vendor-dashboard/repertoire — portfolio/repertoire card grid. */
import { GridPageSkeleton } from '@/components/skeletons';

export default function Loading() {
  // 👻 Ghost (motion standard 18 Nov 2026): the title is known, so it shows at once; the rest is grey.
  return <GridPageSkeleton title="Your repertoire" />;
}
