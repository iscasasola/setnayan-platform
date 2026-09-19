import { FAITH_REGISTRY } from '@/lib/faith-registry';
import type { VendorServiceCoverage } from '@/lib/vendor-service-public';

/**
 * The service card's "Serves" line — ONE builder for every surface that draws
 * the card (S43 · 5). It lived as a private helper inside `app/v/[slug]/page.tsx`,
 * so the Explore grid, which draws the SAME `ServiceCardView`, could not reach
 * it and its cards showed no Serves line at all. Moved verbatim.
 *
 * Pure: no React, no I/O.
 */

/** faithCol (Title-Case storage key) → couple-facing label, from the single
 *  faith registry ([[lib/faith-registry.ts]]). Unknown values pass through. */
const FAITHCOL_TO_LABEL: ReadonlyMap<string, string> = new Map(
  FAITH_REGISTRY.map((e) => [e.faithCol, e.label]),
);

/**
 * The card's "Serves" line from its coverage row — event types first, faiths
 * after an em-dash. EMPTY faiths = "All faiths" (the column contract: an empty
 * array means all faiths welcomed). No coverage row → null → no line rendered.
 * e.g. "Wedding · Debut — All faiths" / "Wedding — Catholic, Muslim".
 */
export function buildServesLine(
  coverage: VendorServiceCoverage | undefined,
  eventTypeLabelByKey: ReadonlyMap<string, string>,
): string | null {
  if (!coverage) return null;
  const types = coverage.event_types
    .map(
      (t) =>
        eventTypeLabelByKey.get(t) ??
        t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    )
    .filter((t) => t.length > 0);
  const faiths =
    coverage.faiths.length === 0
      ? 'All faiths'
      : coverage.faiths.map((f) => FAITHCOL_TO_LABEL.get(f) ?? f).join(', ');
  if (types.length === 0) return faiths === 'All faiths' ? null : faiths;
  return `${types.join(' · ')} — ${faiths}`;
}
