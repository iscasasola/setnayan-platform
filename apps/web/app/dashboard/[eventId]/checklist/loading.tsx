import { ListPageSkeleton } from '@/components/skeletons';

/**
 * What is left to do before the day — a stacked list of steps.
 *
 * 🔑 IT EXISTS TO STOP BORROWING THE EVENT-HOME SHIMMER. Without this file the
 * nearest boundary is `[eventId]/loading.tsx`, which draws a 40px title bar and
 * a subtitle because EVENT HOME genuinely has both. This screen has neither —
 * its masthead renders an sr-only heading and nothing visible — so the borrowed
 * shimmer promised ~64px of chrome that never arrived and the page jumped up
 * when it landed. Eight screens inherited that promise; this is one of them.
 */
export default function Loading() {
  return <ListPageSkeleton rows={6} toolbar={false} actions={1} />;
}
