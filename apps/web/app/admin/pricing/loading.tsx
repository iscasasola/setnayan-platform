/* Loading shell for admin/pricing — owner perf pass 2026-06-03 (instant animated skeleton). */
import { TablePageSkeleton } from '@/components/skeletons';

/**
 * ⚠ `actions={1}` IS LOAD-BEARING AND WAS LOST ONCE ALREADY.
 *
 * `TablePageSkeleton` used to hardcode `actions={1}` for every page that used
 * it. When that default flipped to 0 (2026-08-25) this file did not change and
 * its behaviour did — the reservation vanished from a bare re-export nobody
 * edited. /admin/pricing's DEFAULT tab renders an unconditional "Download
 * legacy catalog report" button in its masthead (`_surfaces/pricing-surface.tsx`),
 * so on every plain load a 44px control now dropped in out of nowhere.
 *
 * 🔑 It went unseen because this page has NO `<PageMasthead>` of its own — the
 * masthead lives in the tab surface it imports, and the guard's actions rule
 * only read page.tsx. That asymmetry is closed; see
 * `the-skeleton-promises-only-what-the-page-draws.test.ts`.
 */
export default function Loading() {
  return <TablePageSkeleton actions={1} />;
}
