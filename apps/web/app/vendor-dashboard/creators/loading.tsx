import { ListPageSkeleton } from '@/components/skeletons';

/**
 * Browsing creators — a reach bar and a list of storytellers.
 *
 * 🔑 IT EXISTS TO STOP BORROWING A TITLE THIS SCREEN DOES NOT DRAW. Until
 * 2026-09-30 every sub-Pro shop got the full-page plan panel here, whose big
 * heading made the borrowed `vendor-dashboard/loading.tsx` title bar honest.
 * The page is try-first now (everyone browses), and its masthead renders an
 * sr-only heading only — so without this file the borrowed shimmer promised a
 * title that never arrived and the page jumped when it landed.
 *
 * ⚖ Status-neutral: the route already streamed through
 * `vendor-dashboard/loading.tsx`, so the HTTP status was committed early either way.
 */
export default function Loading() {
  return <ListPageSkeleton rows={6} />;
}
