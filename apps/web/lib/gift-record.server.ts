import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { giftsAreOn } from '@/lib/event-answers';
import { guestDisplayName } from '@/lib/guests';
import { giftShotPolicy, parseClientRef } from '@/lib/r2-client-ref';
import { GIFT_SUM_FIELDS, WISH_ITEM_SELECT, gotAfterGifts, sumSent, type GiftSumRow, type WishItemRow } from '@/lib/wish-list';
import {
  GIFT_AMOUNT_NEEDED,
  GIFT_MESSAGE_TOO_LONG,
  GIFT_NOT_ACCEPTING,
  GIFT_NOT_KEPT,
  GIFT_NOT_RECOGNISED,
  GIFT_SHOT_REFUSED,
  GIFT_WISH_GONE,
  cleanGiftAmount,
  cleanGiftMessage,
  giftGiverName,
  onlyWayToGive,
} from '@/lib/gift-record';

/**
 * apps/web/lib/gift-record.server.ts (server-only)
 *
 * THE ONE WRITER OF A GIFT RECORD — a guest's "I sent it" (owner 2026-10-08;
 * design `EGIFTS_WISH_LIST_2026-10-08_fable.md` § 3: "a guest's record is
 * inserted by a server action that first passes [the recognition rule] and then
 * writes with the admin client — the same shape as the RSVP writes").
 *
 * ── WHY EVERY CHECK IS HERE ────────────────────────────────────────────────
 * `event_gift_records` gives no browser role INSERT (migration 20271266228704):
 * the row is written with the SERVICE ROLE, which RLS does not see. So this
 * function is the whole fence, and it asks — in this order, failing CLOSED at
 * each — everything a policy would have:
 *
 *   1. the reader is a guest of THIS event — the caller hands in the RSVP's own
 *      identity read (`readGuestSessionForEvent`); here the guest row is read
 *      again and must be this event's and not removed. No new token, no name
 *      taken on trust;
 *   2. the event accepts gifts and has a way to give switched on — the same two
 *      facts that decide whether a guest is shown the wish list at all;
 *   3. the wish (when one is named, by its PUBLIC id) is this event's;
 *   4. the amount is a whole number of pesos above zero (no cap is invented —
 *      `cleanGiftAmount`); the message and the name fit their columns;
 *   5. the screenshot, when there is one, is in THIS guest's own private folder
 *      (`giftShotPolicy`) — never another guest's file, never a public one.
 * The rate limit is the caller's (it needs the request); a refusal is returned
 * in words for the guest to read, never thrown and never silent.
 *
 * ── A DECLINED GUEST ───────────────────────────────────────────────────────
 * The design names no reply a guest must have given: the rule is recognition
 * ("invitation link or scanned QR — the same rule as the RSVP"). So a guest who
 * said they cannot come may still tell the couple what they sent — which is
 * exactly when a gift is sent instead. Not coming does not take the invitation
 * link away; a guest REMOVED from the list is no longer a guest and is refused.
 *
 * ── GOT IT ─────────────────────────────────────────────────────────────────
 * "when amount is reached." After the record is kept, the wish's not-removed
 * records are added up and `gotAfterGifts` decides — 'auto' when they reach the
 * price; never for a wish with no price; never over the couple's own mark.
 *
 * Setnayan never holds or sees the money. This row is what a guest SAYS.
 */

export type GiftRecordInput = {
  /** The wish's PUBLIC id (`S89H-…`), or null/'' for a gift toward no wish. */
  wishId?: unknown;
  amount?: unknown;
  message?: unknown;
  /** Read only when the invitation carries no name. */
  name?: unknown;
  /** `r2://…` from the guest presign route, or empty. */
  shotRef?: unknown;
};

export type GiftRecordResult =
  | {
      ok: true;
      giverName: string;
      amountPhp: number;
      wishName: string | null;
      hasShot: boolean;
      hasMessage: boolean;
      /** This record took the wish to its price, and it is now marked got. */
      nowGot: boolean;
      /** The event's slug, for the caller to refresh the guest's pages. */
      slug: string | null;
    }
  | { ok: false; error: string };

export type GiftRecordSession = { guest_id: string; event_id: string };

const PUBLIC_WISH_ID = /^S89H-[0-9A-HJKMNP-TV-Z]{10}$/;

export async function recordGift(
  admin: SupabaseClient,
  session: GiftRecordSession | null,
  eventId: string,
  input: GiftRecordInput,
): Promise<GiftRecordResult> {
  /* 1 · a guest of THIS event */
  if (!session || session.event_id !== eventId || !session.guest_id) return { ok: false, error: GIFT_NOT_RECOGNISED };

  const [eventRes, guestRes, waysRes] = await Promise.all([
    admin.from('events').select('event_id, slug, gifts_on').eq('event_id', eventId).maybeSingle(),
    admin
      .from('guests')
      .select('guest_id, event_id, display_name, first_name, last_name, deleted_at')
      .eq('guest_id', session.guest_id)
      .eq('event_id', eventId)
      .maybeSingle(),
    admin.from('event_egift_methods').select('method_kind').eq('event_id', eventId).eq('is_enabled', true),
  ]);
  if (eventRes.error || guestRes.error || waysRes.error) {
    console.error('[supabase-error] recordGift: a check could not be read', eventRes.error ?? guestRes.error ?? waysRes.error, { eventId });
    return { ok: false, error: GIFT_NOT_KEPT };
  }
  const event = eventRes.data as { event_id: string; slug: string | null; gifts_on: boolean | null } | null;
  const guest = guestRes.data as {
    guest_id: string;
    display_name: string | null;
    first_name: string | null;
    last_name: string | null;
    deleted_at: string | null;
  } | null;
  if (!event) return { ok: false, error: GIFT_NOT_KEPT };
  if (!guest || guest.deleted_at != null) return { ok: false, error: GIFT_NOT_RECOGNISED };

  /* 2 · the event accepts gifts, and has a way to give on */
  const ways = (waysRes.data ?? []) as Array<{ method_kind: string }>;
  if (!giftsAreOn(event.gifts_on) || ways.length === 0) return { ok: false, error: GIFT_NOT_ACCEPTING };

  /* 4 · the amount, the word, the name */
  const amountPhp = cleanGiftAmount(input.amount);
  if (amountPhp === undefined) return { ok: false, error: GIFT_AMOUNT_NEEDED };
  const message = cleanGiftMessage(input.message);
  if (message === undefined) return { ok: false, error: GIFT_MESSAGE_TOO_LONG };
  const who = giftGiverName(guestDisplayName({ display_name: guest.display_name, first_name: guest.first_name ?? '', last_name: guest.last_name ?? '' }), input.name);
  if ('refused' in who) return { ok: false, error: who.refused };

  /* 5 · the screenshot is this guest's own upload, in the private folder */
  const shotRaw = typeof input.shotRef === 'string' ? input.shotRef.trim() : '';
  let shot: string | null = null;
  if (shotRaw !== '') {
    if (!parseClientRef(shotRaw, giftShotPolicy(eventId, session.guest_id))) return { ok: false, error: GIFT_SHOT_REFUSED };
    shot = shotRaw;
  }

  /* 3 · the wish is this event's */
  const wishId = typeof input.wishId === 'string' ? input.wishId.trim() : '';
  let wish: WishItemRow | null = null;
  if (wishId !== '') {
    if (!PUBLIC_WISH_ID.test(wishId)) return { ok: false, error: GIFT_WISH_GONE };
    const wishRes = await admin.from('event_wish_items').select(WISH_ITEM_SELECT).eq('public_id', wishId).eq('event_id', eventId).maybeSingle();
    if (wishRes.error) {
      console.error('[supabase-error] recordGift: the wish could not be read', wishRes.error, { eventId });
      return { ok: false, error: GIFT_NOT_KEPT };
    }
    wish = (wishRes.data as unknown as WishItemRow | null) ?? null;
    if (!wish) return { ok: false, error: GIFT_WISH_GONE };
  }

  /* the write — service role; a zero-row insert is a refusal, never a thank-you */
  const { data: kept, error: keepErr } = await admin
    .from('event_gift_records')
    .insert({
      event_id: eventId,
      wish_item_id: wish?.wish_item_id ?? null,
      amount_php: amountPhp,
      screenshot_r2_key: shot,
      message,
      giver_name: who.name,
      giver_guest_id: session.guest_id,
      method_kind: onlyWayToGive(ways.map((w) => w.method_kind)),
    })
    .select('gift_record_id');
  if (keepErr || !kept || kept.length === 0) {
    if (keepErr) console.error('[supabase-error] recordGift: insert', keepErr, { eventId });
    return { ok: false, error: GIFT_NOT_KEPT };
  }

  /* Got it — "when amount is reached". The record is kept either way. */
  let nowGot = false;
  if (wish) {
    const sums = await admin.from('event_gift_records').select(GIFT_SUM_FIELDS).eq('event_id', eventId).eq('wish_item_id', wish.wish_item_id);
    if (sums.error) {
      console.error('[supabase-error] recordGift: the wish could not be added up', sums.error, { eventId });
    } else {
      const settle = gotAfterGifts({ price_php: wish.price_php, got_by: wish.got_by }, sumSent((sums.data ?? []) as unknown as GiftSumRow[]));
      if (settle?.got_by === 'auto') {
        const marked = await admin
          .from('event_wish_items')
          .update({ got_at: new Date().toISOString(), got_by: 'auto' })
          .eq('wish_item_id', wish.wish_item_id)
          .eq('event_id', eventId)
          /* only a wish that is still OPEN — never over a mark the couple made meanwhile */
          .is('got_at', null)
          .select('wish_item_id');
        if (marked.error) console.error('[supabase-error] recordGift: the wish could not be marked', marked.error, { eventId });
        else nowGot = (marked.data ?? []).length > 0;
      }
    }
  }

  return {
    ok: true,
    giverName: who.name,
    amountPhp,
    wishName: wish?.name ?? null,
    hasShot: shot != null,
    hasMessage: message != null,
    nowGot,
    slug: event.slug,
  };
}
