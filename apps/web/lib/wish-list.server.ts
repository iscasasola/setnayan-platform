import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';
import { publicUrlForStoredAsset } from '@/lib/uploads';
import { publicBucketServeRef } from '@/lib/site-media-ref';
import { GIFT_RECORD_SELECT, WISH_ITEM_SELECT, type GiftRecordRow, type WishItemRow } from '@/lib/wish-list';
import { studioWishListFrom, type StudioWishList } from '@/lib/wish-list-studio';

/**
 * apps/web/lib/wish-list.server.ts (server-only)
 *
 * THE COUPLE'S READ OF THEIR WISH LIST — every wish with what guests say they
 * sent toward it, for Studio › E-Gifts (owner 2026-10-08).
 *
 * Read through the HOST's own client: `event_wish_items` and
 * `event_gift_records` are hosts-only under RLS (migration 20271266228704), so
 * this function is handed the signed-in couple's client and reads what the
 * database lets them see — never the service role.
 *
 * 🔑 A REFUSED READ IS SAID, NEVER DRAWN AS EMPTY (the `readEgiftMethods` rule,
 * kept). If EITHER table cannot be read the answer is `{ read: false }`: a list
 * with unreadable gifts would print every wish as "₱0 sent", which is a claim.
 *
 * Every read filters on `event_id` — a record's `wish_item_id` alone does not
 * tie it to this event.
 */
export async function readStudioWishList(supabase: SupabaseClient, eventId: string): Promise<StudioWishList> {
  const [wishRes, giftRes] = await Promise.all([
    supabase
      .from('event_wish_items')
      .select(WISH_ITEM_SELECT)
      .eq('event_id', eventId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),
    supabase
      .from('event_gift_records')
      .select(GIFT_RECORD_SELECT)
      .eq('event_id', eventId)
      .order('created_at', { ascending: false }),
  ]);
  if (wishRes.error) logQueryError('readStudioWishList.wishes', wishRes.error, { event_id: eventId }, 'graceful_degrade');
  if (giftRes.error) logQueryError('readStudioWishList.gifts', giftRes.error, { event_id: eventId }, 'graceful_degrade');
  if (wishRes.error || giftRes.error || !wishRes.data || !giftRes.data) return { read: false };

  return studioWishListFrom(
    wishRes.data as unknown as WishItemRow[],
    giftRes.data as unknown as GiftRecordRow[],
    (ref) => publicUrlForStoredAsset(publicBucketServeRef(ref)),
  );
}
