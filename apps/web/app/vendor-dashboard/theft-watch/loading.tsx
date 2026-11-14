import { ListPageSkeleton } from '@/components/skeletons';

/**
 * 🔑 IT EXISTS TO STOP BORROWING A TITLE THIS SCREEN DOES NOT DRAW (design template, rule 1). Without this file the
 * nearest boundary is `vendor-dashboard/loading.tsx`, which paints a page-title bar; this screen draws no heading of its own,
 * so the borrowed shimmer promised chrome that never arrived. Status-neutral: the route already streamed through the
 * parent boundary. Same shape as `vendor-dashboard/booking-fees/loading.tsx`.
 */
export default function Loading() {
  return <ListPageSkeleton rows={5} toolbar={false} />;
}
