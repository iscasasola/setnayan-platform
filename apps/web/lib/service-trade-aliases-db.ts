/**
 * service-trade-aliases-db.ts — the server read for `canonical_service_aliases`.
 *
 * Split from the pure `service-trade-aliases.ts` for the same reason
 * `service-merge-forward-db.ts` is split from `service-merge-forward.ts`:
 * the resolver must be unit-testable without pulling in `next/headers`.
 *
 * 🔒 FAILS SILENT, DELIBERATELY, AND AS ITS OWN QUERY. An error or a missing
 * migration returns an empty list — no aliases — which is exactly the state
 * this feature was in before it existed. A supplier must never see the
 * maker break because a synonym table hiccuped.
 *
 * ⚠ RE-FILTERS `reviewed_at IS NOT NULL` IN THE QUERY even though the RLS
 * policy already restricts an ordinary session read to reviewed rows —
 * belt-and-braces, the same posture `recallPhrase` takes re-validating a
 * stored href it could otherwise trust. If this is ever read with the admin
 * client (which bypasses RLS), the explicit filter is the only thing
 * standing between an unreviewed row and a supplier.
 */
import 'server-only';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import type { TradeAliasRow } from './service-trade-aliases';

/**
 * Every REVIEWED alias row. Cached per request. Returns `[]` on any error
 * or on a database that has not run the migration yet.
 */
export const getReviewedTradeAliasRows = cache(async (): Promise<TradeAliasRow[]> => {
  try {
    const sb = await createClient();
    const { data, error } = await sb
      .from('canonical_service_aliases')
      .select('phrase,canonical_service,reviewed_at')
      .not('reviewed_at', 'is', null);
    if (error || !data) return [];
    return data as TradeAliasRow[];
  } catch {
    return [];
  }
});
