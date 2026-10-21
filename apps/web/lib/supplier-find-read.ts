/**
 * readFindList — the ONE read behind Find a supplier's category list.
 *
 * Two surfaces draw that list (owner 2026-10-21 — *"Why do i have this find
 * supplier button? When we have the search bar at the bottom?"* ⇒ the button
 * goes; the bottom search shows the categories when it is empty):
 *
 *   /dashboard/[eventId]/vendors/categories   the Find page (it keeps working
 *                                             for every link that still opens it)
 *   /dashboard/[eventId]/vendors              the Suppliers page — the bottom
 *                                             search's empty state
 *
 * Both call THIS, and both draw the result with `FindCategoryList`
 * (`app/dashboard/[eventId]/vendors/_components/find-category-list.tsx`), so the
 * two can never show different groups, a different order, or a different
 * "Booked ✓ / Joining soon" on the same row.
 *
 * 🔑 WHICH categories show is the bench's own scope (`buildShortlistFolders`
 * with no vendor rows — `applicable_event_types`, `marketplace_hidden`, faith);
 * `buildFindList` only regroups it (see `lib/supplier-find.ts`).
 *
 * ⚠ A refused booked read is NOT "nothing booked": `booked` stays null, no row
 * says "Booked ✓", and `bookedMeasured: false` makes the list say once that it
 * could not check. Supplier counts are a soft signal — unknown (null) on failure.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { buildCoupleFaithSet } from '@/lib/taxonomy-filters';
import {
  buildShortlistFolders,
  homeTileForRow,
  LOCKED_VENDOR_STATUSES,
} from '@/lib/shortlist-taxonomy';
import { TAXONOMY_MAP } from '@/lib/taxonomy';
import type { TaxonomySnapshot } from '@/lib/taxonomy-db';
import { fetchVendorCountsByService, rollUpCountsToTile } from '@/lib/vendor-counts';
import { buildFindList, type FindList } from '@/lib/supplier-find';

/** tile → the words of every service under it, so the one search finds
 *  "tent" inside Chairs & tents. Built once per process from the code map. */
const SERVICES_BY_TILE: ReadonlyMap<string, readonly string[]> = (() => {
  const out = new Map<string, string[]>();
  for (const [service, entry] of Object.entries(TAXONOMY_MAP)) {
    if (!entry.tile) continue;
    const words = service.replace(/_/g, ' ');
    const arr = out.get(entry.tile);
    if (arr) arr.push(words);
    else out.set(entry.tile, [words]);
  }
  return out;
})();

export type FindListRead = {
  list: FindList;
  /** False when the booked read was refused — the list then says so once. */
  bookedMeasured: boolean;
};

export async function readFindList(args: {
  /** The viewer's RLS client — the booked read is the couple's own. */
  supabase: SupabaseClient;
  eventId: string;
  eventType: string;
  ceremonyType: string | null;
  secondaryCeremonyType: string | null;
  taxonomy: TaxonomySnapshot;
  solemn: boolean;
  /** The one search box, as typed ('' = the whole list). */
  query?: string;
}): Promise<FindListRead> {
  const { supabase, eventId, eventType, taxonomy, solemn } = args;

  // The bench's own scope — the ONLY place the category list comes from.
  const folders = buildShortlistFolders({
    vendorRows: [],
    eventType,
    faithSet: buildCoupleFaithSet({
      eventType,
      ceremonyType: args.ceremonyType,
      secondaryCeremonyType: args.secondaryCeremonyType,
    }),
    taxonomy,
    eventId,
  });

  // Booked = a committed supplier in that category.
  const { data: bookedRows, error: bookedError } = await supabase
    .from('event_vendors')
    .select('category, category_key')
    .eq('event_id', eventId)
    .is('archived_at', null)
    .in('status', [...LOCKED_VENDOR_STATUSES]);
  if (bookedError) {
    logQueryError('readFindList.booked', bookedError, { event_id: eventId }, 'graceful_degrade');
  }
  const bookedMeasured = !bookedError && bookedRows !== null;
  const booked: Set<string> | null = bookedMeasured ? new Set<string>() : null;
  for (const r of (bookedRows ?? []) as Array<{ category: string | null; category_key: string | null }>) {
    // The row the supplier is drawn under — a moved one's may be finer than its category.
    const tile = r.category ? homeTileForRow({ category: r.category, category_key: r.category_key }) : null;
    if (tile) booked?.add(tile);
  }

  // Supplier counts — a soft signal; unknown (null) when the read fails.
  let counts: Map<string, number> | null = null;
  try {
    const perTile = rollUpCountsToTile(await fetchVendorCountsByService(createAdminClient()));
    counts = new Map([...perTile].map(([t, c]) => [t as string, c.total]));
  } catch {
    counts = null;
  }

  const list = buildFindList({
    folders,
    eventType,
    solemn,
    booked,
    counts,
    query: args.query ?? '',
    servicesByTile: SERVICES_BY_TILE,
  });
  return { list, bookedMeasured };
}
