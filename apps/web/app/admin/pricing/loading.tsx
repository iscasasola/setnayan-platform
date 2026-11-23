/* Loading shell for admin/pricing — owner perf pass 2026-06-03 (instant animated skeleton). */
import { TablePageSkeleton } from '@/components/skeletons';

/**
 * ⚠ THE ACTIONS COUNT FOLLOWS THE MASTHEAD — and it has already been wrong once in each direction.
 *
 * Until 23 Nov 2026 this was `actions={1}`: the default tab's masthead (`_surfaces/pricing-surface.tsx`) held an
 * unconditional "Download legacy catalog report" button, and losing that reservation once (the 2026-08-25 default
 * flip) made a 44px control drop in on every load. The admin clean port (#8018, owner 19 Nov) moved that link down
 * beside the legacy catalogue it downloads, so the masthead is title-only and a reserved slot would now collapse when
 * the page lands. 🔑 The masthead lives in the tab surface, not page.tsx —
 * `the-skeleton-promises-only-what-the-page-draws.test.ts` reads both, so a button added back there fails until this
 * says 1 again.
 */
export default function Loading() {
  return <TablePageSkeleton actions={0} />;
}
