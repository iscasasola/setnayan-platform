/**
 * service-merge-forward-db.ts — the server read for the trade forwarding map.
 *
 * Split from the pure `service-merge-forward.ts` for the same reason
 * `taxonomy-db` is split from `taxonomy-snapshot`: the resolver must be
 * unit-testable without pulling in `next/headers`.
 *
 * 🔒 FAILS SILENT, DELIBERATELY, AND AS ITS OWN QUERY.
 * This is a SEPARATE read rather than three more characters in `getTaxonomy()`'s
 * select. Naming an unknown column makes PostgREST refuse the WHOLE query, and
 * `getTaxonomy` answers a refused query by returning the CONSTANT fallback — so
 * widening that select would have meant that in the window between this code
 * deploying and its migration applying, the entire DB-driven taxonomy silently
 * reverted to a hardcoded one, app-wide, with nothing thrown. As its own query,
 * the worst case is an empty map: no forwarding, which is exactly today's
 * behaviour.
 */
import 'server-only';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { forwardMapFromRows, type MergeForwardMap } from './service-merge-forward';

const EMPTY: MergeForwardMap = Object.freeze({});

/**
 * Every trade that was merged away → the trade it became. Cached per request.
 * Returns {} on any error, and on a database that has not run the migration yet.
 */
export const getServiceMergeForwards = cache(async (): Promise<MergeForwardMap> => {
  try {
    const sb = await createClient();
    const { data, error } = await sb
      .from('canonical_service_taxonomy')
      .select('canonical_service,merged_into')
      .not('merged_into', 'is', null);
    if (error || !data) return EMPTY;
    return forwardMapFromRows(
      data as { canonical_service: string; merged_into: string | null }[],
    );
  } catch {
    return EMPTY;
  }
});
