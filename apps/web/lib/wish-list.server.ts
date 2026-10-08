import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';
import { publicUrlForStoredAsset } from '@/lib/uploads';
import { publicBucketServeRef } from '@/lib/site-media-ref';
import {
  GIFT_RECORD_SELECT,
  GIFT_SUM_FIELDS,
  WISH_GUEST_FIELDS,
  WISH_ITEM_SELECT,
  type GiftRecordRow,
  type GiftSumRow,
  type WishItemRow,
} from '@/lib/wish-list';
import { guestWishListFrom, type GuestWishList, type GuestWishRow } from '@/lib/wish-list-guest';
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

/**
 * THE GUEST'S READ — the wishes and ONE sum per wish, for `/[slug]/pabuya` and
 * the Welcome door's line (owner 2026-10-08).
 *
 * Handed the SERVICE-ROLE client, behind the page's own published gate — the
 * two tables have no anon policy and no anon grant, exactly as the ways to give
 * are read. The caller decides WHETHER a guest is shown the list at all
 * (`wishListShownToGuests`: gifts accepted · a way to give on).
 *
 * 🔒 WHAT IT CANNOT RETURN. The records are read through `GIFT_SUM_FIELDS` —
 * which wish, how much, removed or not — so no giver's name, words or screenshot
 * is ever in this process's hands on the guest path, let alone on the page.
 *
 * 🔑 A refused read is `{ read: false }` — no list, never a list with nothing
 * sent beside every wish. Both reads filter on `event_id`.
 */
export async function readGuestWishList(
  admin: SupabaseClient,
  eventId: string,
  /** The reader's own guest row on THIS event, when the page knows them — their own gifts are then marked "You sent". */
  readerGuestId: string | null = null,
): Promise<GuestWishList> {
  const [wishRes, sumRes, mineRes] = await Promise.all([
    admin
      .from('event_wish_items')
      .select(WISH_GUEST_FIELDS)
      .eq('event_id', eventId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),
    admin.from('event_gift_records').select(GIFT_SUM_FIELDS).eq('event_id', eventId),
    /* The READER's own records — the same three columns, theirs alone (filtered on their
       own guest id AND this event). Nobody else's record is ever read by name. */
    readerGuestId
      ? admin.from('event_gift_records').select(GIFT_SUM_FIELDS).eq('event_id', eventId).eq('giver_guest_id', readerGuestId)
      : Promise.resolve({ data: [] as unknown[], error: null }),
  ]);
  if (wishRes.error) logQueryError('readGuestWishList.wishes', wishRes.error, { event_id: eventId }, 'graceful_degrade');
  if (sumRes.error) logQueryError('readGuestWishList.sums', sumRes.error, { event_id: eventId }, 'graceful_degrade');
  if (mineRes.error) logQueryError('readGuestWishList.mine', mineRes.error, { event_id: eventId }, 'graceful_degrade');
  if (wishRes.error || sumRes.error || !wishRes.data || !sumRes.data) return { read: false };
  return guestWishListFrom(
    wishRes.data as unknown as GuestWishRow[],
    sumRes.data as unknown as GiftSumRow[],
    (ref) => publicUrlForStoredAsset(publicBucketServeRef(ref)),
    /* A reader's own line that could not be read is simply not drawn — the wish's sum still is. */
    mineRes.error ? [] : ((mineRes.data ?? []) as unknown as GiftSumRow[]),
  );
}
