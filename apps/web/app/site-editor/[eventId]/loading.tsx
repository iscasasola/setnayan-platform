/**
 * Loading shell for the landing-site editor at /site-editor/[eventId] — the
 * surface the couple's "Website" nav doorway actually opens (the retired
 * /dashboard/[eventId]/website route just redirects here).
 *
 * Was a one-line `export { BoardPageSkeleton as default }`. Owner 2026-06-05
 * ("make a loading for website … loading state tells what we are doing") → keep
 * the board/canvas-shaped skeleton, add a cycling <LoadingNarration> strip that
 * narrates the editor load.
 */
import { BoardPageSkeleton } from '@/components/skeletons';
import { LoadingNarration } from '@/components/loading-status';

const WEBSITE_MESSAGES = [
  'Opening your website editor…',
  'Loading your design…',
  'Bringing in your photos…',
  'Almost ready…',
];

export default function SiteEditorLoading() {
  return (
    <div className="space-y-4">
      <LoadingNarration messages={WEBSITE_MESSAGES} className="pt-2" />
      <BoardPageSkeleton />
    </div>
  );
}
