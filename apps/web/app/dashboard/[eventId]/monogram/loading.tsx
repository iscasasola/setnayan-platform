/**
 * Route-level loading for the couple's Monogram Maker (/dashboard/[eventId]/
 * monogram). The page fetches the event's monogram design before rendering the
 * draw-on studio, so this is a genuine "we're loading your custom stuff"
 * moment — exactly what the brand loader is for. Purely additive: this route
 * previously had no loading.tsx. Per the Organic loaders handoff (owner
 * 2026-06-07). Narration copy lives in @/components/sd-loader.
 */
import { SDLoader, LOADER_STEPS } from '@/components/sd-loader';

export default function Loading() {
  return (
    <div className="min-h-[70vh]">
      <SDLoader steps={LOADER_STEPS.monogram} hint="Personalizing" />
    </div>
  );
}
