import { GridPageSkeleton } from '@/components/skeletons';

/**
 * Shop › Spaces — the date row and the tiles.
 *
 * 🔑 IT EXISTS TO STOP BORROWING A TITLE THIS SCREEN DOES NOT DRAW (design template, rule 1). B4 (final check 25 Nov):
 * the title and its Back moved to the app's top bar through `PageMasthead`, whose heading is sr-only, so the parent
 * `vendor-dashboard/loading.tsx` page-title bar would promise chrome that never arrives. Status-neutral: the route
 * already streamed through the parent boundary. Same shape as `vendor-dashboard/activities/loading.tsx`.
 */
export default function Loading() {
  return <GridPageSkeleton tiles={6} cols="grid-cols-2 sm:grid-cols-3" tileClass="h-28" />;
}
