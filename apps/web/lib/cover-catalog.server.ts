import 'server-only';

/**
 * readCoverCatalog — the "Also covers" list for one event, built by the SAME
 * call the Suppliers page draws its rows with (owner 2026-10-20: *"we do not
 * have the categories synced properly"*).
 *
 * `buildShortlistFolders` with the event's own type, faith, taxonomy snapshot
 * (`getTaxonomy` — `service_categories`, admin-editable) and supplier rows, then
 * `coverCatalogFromFolders`. Nothing here decides which rows exist; it only
 * fetches the inputs that call already takes on `vendors/page.tsx`.
 *
 * 🔑 A FAILED READ SAYS SO. An empty list would read as "this event has no
 * categories" — the failure-shaped-like-emptiness the 2026-08-20 handoff is
 * about — so the event read failing returns `{ ok: false }` and the sheet says
 * the list did not load. (The taxonomy itself already falls back to the seeded
 * constant on its own, by design — `taxonomy-db.ts`.)
 */

import { createClient } from '@/lib/supabase/server';
import { getTaxonomy } from '@/lib/taxonomy-db';
import { buildCoupleFaithSet } from '@/lib/taxonomy-filters';
import {
  buildShortlistFolders,
  coverCatalogFromFolders,
  type CoverCatalogFolder,
} from '@/lib/shortlist-taxonomy';
import type { EventVendorRowInput } from '@/lib/wedding-plan-groups';

export type CoverCatalogRead = { ok: true; catalog: CoverCatalogFolder[] } | { ok: false };

export async function readCoverCatalog(eventId: string): Promise<CoverCatalogRead> {
  if (typeof eventId !== 'string' || eventId.length === 0) return { ok: false };
  const supabase = await createClient();
  const [evRes, rowsRes, taxonomy] = await Promise.all([
    supabase
      .from('events')
      .select('event_type, ceremony_type, secondary_ceremony_type')
      .eq('event_id', eventId)
      .maybeSingle(),
    supabase
      .from('event_vendors')
      .select('vendor_id, vendor_name, category, category_key, status, covers_plan_groups')
      .eq('event_id', eventId),
    getTaxonomy(),
  ]);
  if (evRes.error || !evRes.data || rowsRes.error) return { ok: false };
  const ev = evRes.data as {
    event_type: string | null;
    ceremony_type: string | null;
    secondary_ceremony_type: string | null;
  };
  const folders = buildShortlistFolders({
    // The event's suppliers, so a row the page draws only because it holds one
    // of them is offered too — the page's rows, not an approximation of them.
    vendorRows: (rowsRes.data ?? []) as unknown as EventVendorRowInput[],
    eventType: ev.event_type ?? null,
    faithSet: buildCoupleFaithSet({
      eventType: ev.event_type ?? null,
      ceremonyType: ev.ceremony_type ?? null,
      secondaryCeremonyType: ev.secondary_ceremony_type ?? null,
    }),
    taxonomy,
    eventId,
  });
  return { ok: true, catalog: coverCatalogFromFolders(folders) };
}
