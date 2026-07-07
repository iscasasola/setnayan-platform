/**
 * Leaf-suggestion server read — assembles the couple's context + the live
 * vendor taxonomy/availability and returns ranked "you might also want this"
 * suggestions for the checklist. Every fetch is defensive: any failure returns
 * an empty list so suggestions NEVER block the checklist render.
 *
 * Two-vocabulary bridge (see Adaptive_Checklist_Build_Plan §2): the taxonomy is
 * read at leaf grain (getCoverageTaxonomy → canonical_service), availability
 * from per-leaf vendor counts, and the couple's already-planned scope from the
 * tile-grained interested_categories.
 */
import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCoverageTaxonomy } from './vendor-coverages';
import { fetchVendorCountsByService } from './vendor-counts';
import {
  rankLeafSuggestions,
  type LeafTaxNode,
  type LeafSuggestion,
} from './leaf-suggestions-core';

export type { LeafSuggestion } from './leaf-suggestions-core';

/**
 * Up to `limit` relevance-gated, diverse service suggestions for an event.
 * Returns [] when nothing fits (no budget/vendors), the tables are absent, or
 * any read errors — the caller renders no card in that case.
 */
export async function suggestLeafCategories(
  eventId: string,
  limit = 3,
): Promise<LeafSuggestion[]> {
  try {
    const supabase = await createClient();

    const { data: event } = await supabase
      .from('events')
      .select('event_type, style_preferences')
      .eq('event_id', eventId)
      .maybeSingle();

    const eventType = (event?.event_type as string | null | undefined) ?? null;
    const stylePrefs = (event?.style_preferences ?? {}) as Record<string, unknown>;
    const planned = Array.isArray(stylePrefs.interested_categories)
      ? (stylePrefs.interested_categories as string[])
      : [];
    const plannedTileIds = new Set(planned);

    // Flatten the leaf-grain taxonomy tree.
    const taxonomy = await getCoverageTaxonomy();
    const leaves: LeafTaxNode[] = [];
    for (const parent of taxonomy) {
      for (const branch of parent.branches) {
        for (const l of branch.leaves) {
          leaves.push({
            canonicalService: l.canonicalService,
            label: l.label,
            tileId: branch.tileId,
            tileLabel: branch.label,
            allowedEventTypes: l.allowedEventTypes,
          });
        }
      }
    }
    if (leaves.length === 0) return [];

    // Per-leaf availability (verified vendors only — the default gate).
    const admin = createAdminClient();
    const counts = await fetchVendorCountsByService(admin);
    const countFor = (canonicalService: string) => counts.get(canonicalService)?.total ?? 0;

    return rankLeafSuggestions(leaves, countFor, { eventType, plannedTileIds, limit });
  } catch {
    // Suggestions are a nice-to-have — never surface an error to the couple.
    return [];
  }
}
