/**
 * readAddOwnCategories — "What they do" for the add-your-own walk when it is opened OUTSIDE the Suppliers page
 * (Discover's empty search, owner 2026-10-24: *"add my own new supplier's service card manually that i can give the
 * supplier itself"*).
 *
 * 🔑 NOT A NEW LIST. It is the bench's own scope — `buildShortlistFolders` with no vendor rows, the event's type and
 * faith — which is exactly where the Find page's category list comes from (`lib/supplier-find-read.ts`), shaped by
 * the walk's own `addOwnCategoriesFromRows`. One entry per row; a row files the card under itself.
 *
 * ⚠ A refused read is not "no categories": it returns `null`, and the caller draws no add (it says plainly that
 * nothing matched) rather than a walk with nothing to pick.
 */
import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { logQueryError } from '@/lib/supabase/error-detect';
import { buildCoupleFaithSet } from '@/lib/taxonomy-filters';
import { buildShortlistFolders } from '@/lib/shortlist-taxonomy';
import { getTaxonomy } from '@/lib/taxonomy-db';
import { addOwnCategoriesFromRows } from '@/lib/add-your-own';

export type AddOwnCategoryRow = ReturnType<typeof addOwnCategoriesFromRows>[number];

export async function readAddOwnCategories(eventId: string): Promise<AddOwnCategoryRow[] | null> {
  try {
    const supabase = await createClient();
    const { data: ev, error } = await supabase
      .from('events')
      .select('event_id, event_type, ceremony_type, secondary_ceremony_type')
      .eq('event_id', eventId)
      .maybeSingle();
    if (error || !ev) {
      if (error) logQueryError('readAddOwnCategories.event', error, { event_id: eventId }, 'graceful_degrade');
      return null;
    }
    const eventType = (ev.event_type as string | null) ?? 'wedding';
    const folders = buildShortlistFolders({
      vendorRows: [],
      eventType,
      faithSet: buildCoupleFaithSet({
        eventType,
        ceremonyType: (ev.ceremony_type as string | null) ?? null,
        secondaryCeremonyType: (ev.secondary_ceremony_type as string | null) ?? null,
      }),
      taxonomy: await getTaxonomy(),
      eventId,
    });
    const rows = addOwnCategoriesFromRows(folders.flatMap((f) => f.tiles.map((t) => ({ t, group: f.label }))));
    return rows.length > 0 ? rows : null;
  } catch {
    return null;
  }
}
