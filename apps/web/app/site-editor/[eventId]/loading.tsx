/**
 * Loading shell for the landing-site editor at /site-editor/[eventId] — the
 * surface the couple's "Website" nav doorway actually opens (the retired
 * /dashboard/[eventId]/website route just redirects here).
 *
 * The board/canvas-shaped skeleton gives instant page structure; <BoardPageSkeleton>
 * wraps <Screen>, which now fades in the unified gold-particle brand loader
 * (owner 2026-07-05) with website-specific narration (ROUTE_STEPS.website). The
 * earlier bespoke <LoadingNarration> strip is retired — the brand loader narrates.
 */
import { BoardPageSkeleton } from '@/components/skeletons';

export default function SiteEditorLoading() {
  return <BoardPageSkeleton />;
}
