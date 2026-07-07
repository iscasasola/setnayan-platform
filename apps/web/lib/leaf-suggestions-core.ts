/**
 * Leaf-suggestion core — turn the vendor taxonomy + availability into ranked
 * "you might also want this service" suggestions for the checklist, so every
 * leaf category gets a fair, relevance-gated chance to reach the couple.
 *
 * Pure (no DB) so it is fully unit-testable; `lib/leaf-suggestions.ts` wraps it
 * with the real getCoverageTaxonomy() + vendor-count reads.
 *
 * Pipeline (research-grounded, see Adaptive_Checklist_Build_Plan §4):
 *   candidates = leaves for this event type
 *     → event-type gate (leaf.allowedEventTypes)
 *     → already-planned exclusion (couple's planned tiles)
 *     → only-when-it-fits gate (≥1 available vendor — hide zero-result)
 *   → selectDiverseLeaves (relevance-first + cross-tile diversity, capped)
 */
import { selectDiverseLeaves, type LeafCandidate } from './leaf-surfacing';

/** A taxonomy leaf, flattened from getCoverageTaxonomy(). */
export type LeafTaxNode = {
  canonicalService: string;
  /** Human label for the leaf ("Photo Booth"). */
  label: string;
  /** Parent tile/branch id — the cross-diversity grouping. */
  tileId: string;
  /** Human label for the parent tile ("Booths"). */
  tileLabel: string;
  /** Event types this leaf applies to; null = all types. */
  allowedEventTypes: string[] | null;
};

export type LeafSuggestion = {
  canonicalService: string;
  label: string;
  tileId: string;
  tileLabel: string;
  vendorCount: number;
};

/** Vendors above this count all read as "plenty available" (relevance ceiling). */
export const RELEVANCE_VENDOR_CAP = 10;

export type LeafCandidateOptions = {
  eventType: string | null;
  /** Tile ids the couple has already engaged — their leaves are not re-suggested. */
  plannedTileIds: ReadonlySet<string>;
};

/**
 * Build relevance-scored candidates from the leaf universe. A leaf survives only
 * if it fits the event type, isn't already planned, and has ≥1 available vendor.
 * Relevance rises with vendor count (more supply → likelier a good fit exists),
 * capped so a mega-category can't crowd out everything else.
 */
export function buildLeafCandidates(
  leaves: readonly LeafTaxNode[],
  countFor: (canonicalService: string) => number,
  opts: LeafCandidateOptions,
): LeafCandidate[] {
  const out: LeafCandidate[] = [];
  for (const leaf of leaves) {
    // Event-type gate. A tagged leaf must include this event type. An UNTAGGED
    // leaf (allowedEventTypes == null) defaults to WEDDING-ONLY, because the
    // taxonomy is wedding-first and `applicable_event_types` is not yet seeded —
    // treating null as "all types" would suggest wedding-only services (e.g. a
    // coordinator) on a birthday. An admin tags a leaf to opt it into other
    // event types. eventType == null (unknown) can't be filtered, so it passes.
    const appliesToType =
      leaf.allowedEventTypes != null
        ? opts.eventType == null || leaf.allowedEventTypes.includes(opts.eventType)
        : opts.eventType == null || opts.eventType === 'wedding';
    if (!appliesToType) continue;
    if (opts.plannedTileIds.has(leaf.tileId)) continue; // already planning this area
    const n = countFor(leaf.canonicalService);
    if (n <= 0) continue; // only-when-it-fits: no available vendor → never surface
    out.push({
      key: leaf.canonicalService,
      category: leaf.tileId,
      relevance: Math.min(1, n / RELEVANCE_VENDOR_CAP),
    });
  }
  return out;
}

/**
 * Rank the fitting leaves into up to `limit` diverse suggestions and hydrate
 * them with display labels + the live vendor count.
 */
export function rankLeafSuggestions(
  leaves: readonly LeafTaxNode[],
  countFor: (canonicalService: string) => number,
  opts: LeafCandidateOptions & { limit?: number },
): LeafSuggestion[] {
  const candidates = buildLeafCandidates(leaves, countFor, opts);
  const picked = selectDiverseLeaves(candidates, { limit: opts.limit ?? 3 });
  const byLeaf = new Map(leaves.map((l) => [l.canonicalService, l]));
  const out: LeafSuggestion[] = [];
  for (const p of picked) {
    const leaf = byLeaf.get(p.key);
    if (!leaf) continue;
    out.push({
      canonicalService: leaf.canonicalService,
      label: leaf.label,
      tileId: leaf.tileId,
      tileLabel: leaf.tileLabel,
      vendorCount: countFor(leaf.canonicalService),
    });
  }
  return out;
}
