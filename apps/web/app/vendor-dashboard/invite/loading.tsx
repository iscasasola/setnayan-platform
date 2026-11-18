import { ListPageSkeleton } from '@/components/skeletons';

/**
 * QR codes — the codes a supplier hands out, one row each.
 *
 * 🔑 IT EXISTS TO STOP BORROWING A TITLE THIS SCREEN DOES NOT DRAW. The design template (rule 1, 2026-11-14) made
 * this page's "QR codes" title screen-reader only — the pinned row names the page. Without this file the nearest
 * boundary is `vendor-dashboard/loading.tsx`, which paints a page-title bar, so the shimmer would promise chrome
 * that never arrives and the page would jump when it lands. Same fix as `booking-fees/loading.tsx`.
 *
 * ⚖ Status-neutral: this route already streamed through `vendor-dashboard/loading.tsx`.
 */
export default function Loading() {
  return <ListPageSkeleton rows={4} toolbar={false} />;
}
