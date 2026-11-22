/* Instant loading shell for /vendor-dashboard/repertoire — portfolio/repertoire card grid. */
import { GridPageSkeleton } from '@/components/skeletons';

export default function Loading() {
  // 👻 Ghost (motion standard 18 Nov 2026): the redraw puts the title in `ToolPin`, which this guard cannot read as an
  // <h1>, so the title is grey like the other tool pages (Creators · Theft Watch · Attributes).
  return <GridPageSkeleton />;
}
