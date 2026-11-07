import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getInspirationParts } from './inspiration-parts-db';
import { inspirationPartsInOrder } from './inspiration-parts';
import { logQueryError } from './supabase/error-detect';
import { buildFindInspiration, type FindInspiration, type FindInspirationPhoto } from './find-inspiration';

/**
 * The inspiration box's ONE read for Suppliers › Find (`lib/find-inspiration.ts`): the couple's own photos under their
 * own RLS-bound client (`event_inspiration_assets_host_select` — a viewer the couple's board does not reach reads none,
 * which is the truth for them), with the supplier each was picked from. A refused read is `{ read: 'unread' }` — said,
 * never drawn as an empty board. `onList` = the marketplace shops already on the couple's list for this event.
 */
export async function readFindInspiration(
  supabase: SupabaseClient,
  eventId: string,
  onList: ReadonlySet<string>,
): Promise<FindInspiration> {
  const [snapshot, res] = await Promise.all([
    getInspirationParts(),
    supabase
      .from('event_inspiration_assets')
      .select('slot_key, image_url, created_at, library_asset_id, asset:moodboard_library_assets ( vendor_profile_id )')
      .eq('event_id', eventId)
      .is('removed_at', null)
      .not('slot_key', 'is', null)
      .order('created_at', { ascending: false })
      .limit(500),
  ]);
  if (res.error) {
    logQueryError('readFindInspiration', res.error, { event_id: eventId }, 'graceful_degrade');
    return buildFindInspiration(inspirationPartsInOrder(snapshot), null, onList);
  }
  type Row = { slot_key: string | null; image_url: string | null; library_asset_id: string | null; asset: { vendor_profile_id: string | null } | { vendor_profile_id: string | null }[] | null };
  const photos: FindInspirationPhoto[] = ((res.data ?? []) as Row[]).flatMap((r) => {
    if (!r.slot_key || !r.image_url) return [];
    const asset = Array.isArray(r.asset) ? r.asset[0] : r.asset;
    return [{ slotKey: r.slot_key, imageUrl: r.image_url, fromSupplier: r.library_asset_id !== null, vendorProfileId: asset?.vendor_profile_id ?? null }];
  });
  return buildFindInspiration(inspirationPartsInOrder(snapshot), photos, onList);
}
