import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { cleanGiftAmount } from '@/lib/gift-record';
import { GIFT_SUM_FIELDS, gotAfterGifts, sumSent, type GiftSumRow, type WishGotBy } from '@/lib/wish-list';
import { GIFT_AMOUNT_NOT_A_NUMBER } from '@/lib/wish-list-studio';

/**
 * THE COUPLE'S THREE WRITES ON A GIFT RECORD — correct the amount · move it to
 * another wish (or to "Any gift") · remove it / put it back (owner 2026-10-08:
 * "yes. it will accumulate all the gift and mark them one by one"; design
 * `EGIFTS_WISH_LIST_2026-10-08_fable.md` § 2 "One gift open" + § 6 E-PR5).
 *
 * ── WHY THIS IS NOT A "use server" FILE ────────────────────────────────────
 * Every exported "use server" function is one Vercel route against a hard
 * ceiling. These ride the E-Gifts page's ONE door — `saveEgiftMethod`, when the
 * form carries `wish_op` — through `wishListWrite`, as the wish list's own four
 * writes do. +0 exported actions.
 *
 * ── WHO MAY ────────────────────────────────────────────────────────────────
 * The signed-in person's OWN client: `event_gift_records_host_all` (RLS) is the
 * boundary, and the table gives a browser role SELECT and UPDATE only — a host
 * can correct a record, never invent one and never destroy one. A write RLS
 * refuses matches no row, and a zero-row write is SAID, never reported as kept.
 * Every read and write also filters on `event_id`: a record's `wish_item_id` is
 * a single-column key, so nothing else ties a wish to the same event.
 *
 * ── REMOVE IS SOFT ─────────────────────────────────────────────────────────
 * `removed_at` — a fake, a double entry or a typo leaves every sum, and can be
 * put back. Nothing here deletes a row or a screenshot.
 *
 * ── GOT IT FOLLOWS THE SUM ("when amount is reached.") ─────────────────────
 * After the record changes, every wish it touched (the one it counted toward,
 * and the one it now counts toward) is added up again and `gotAfterGifts`
 * decides: marked 'auto' when the sum reaches the price, cleared when an 'auto'
 * mark is no longer reached. The couple's own mark ('host') is never touched.
 *
 * A record is what a guest SAYS they sent — nothing here says a gift arrived.
 */

export type GiftWriteResult = { ok: true } | { ok: false; error: string };

export const GIFT_OPS = ['gift-amount', 'gift-move', 'gift-remove'] as const;
export type GiftOp = (typeof GIFT_OPS)[number];

export function giftOpOf(raw: unknown): GiftOp | null {
  return typeof raw === 'string' && (GIFT_OPS as readonly string[]).includes(raw) ? (raw as GiftOp) : null;
}

const NOT_KEPT = 'Couldn’t keep that. Nothing was changed — please try again.';
const GIFT_GONE = 'That gift isn’t on your list any more — close this and open E-Gifts again.';
const WISH_GONE = 'That wish isn’t there any more — pick another, or “Any gift”.';
export const GIFT_MARK_NOT_SETTLED =
  'The gift was changed, but its wish’s “Got it” could not be brought up to date — open the wish and set it yourself.';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function str(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === 'string' ? v.trim() : '';
}

/**
 * Add one wish's gifts up again and write what `gotAfterGifts` decides.
 * `false` = the wish could not be read or written (the caller says so).
 */
export async function settleWishGot(supabase: SupabaseClient, eventId: string, wishId: string): Promise<boolean> {
  const [wishRes, sumRes] = await Promise.all([
    supabase.from('event_wish_items').select('wish_item_id, price_php, got_by').eq('wish_item_id', wishId).eq('event_id', eventId).maybeSingle(),
    supabase.from('event_gift_records').select(GIFT_SUM_FIELDS).eq('event_id', eventId).eq('wish_item_id', wishId),
  ]);
  if (wishRes.error || sumRes.error) return false;
  const wish = wishRes.data as { wish_item_id: string; price_php: number | null; got_by: WishGotBy | null } | null;
  /* The wish was removed meanwhile: there is no mark left to settle. */
  if (!wish) return true;
  const settle = gotAfterGifts({ price_php: wish.price_php, got_by: wish.got_by }, sumSent((sumRes.data ?? []) as unknown as GiftSumRow[]));
  if (!settle) return true;
  const { data: marked, error } = await supabase
    .from('event_wish_items')
    .update({ got_by: settle.got_by, got_at: settle.got_by ? new Date().toISOString() : null })
    .eq('wish_item_id', wishId)
    .eq('event_id', eventId)
    .select('wish_item_id');
  return !error && (marked ?? []).length > 0;
}

/** The one door `wishListWrite` opens for a gift record: which of the three, then that write. */
export async function giftRecordWrite(supabase: SupabaseClient, eventId: string, op: GiftOp, formData: FormData): Promise<GiftWriteResult> {
  const id = str(formData, 'gift_record_id');
  if (!UUID.test(id)) return { ok: false, error: GIFT_GONE };

  /* The record as it stands — read BEFORE writing, so a read that fails changes nothing. */
  const recRes = await supabase
    .from('event_gift_records')
    .select('gift_record_id, wish_item_id')
    .eq('gift_record_id', id)
    .eq('event_id', eventId)
    .maybeSingle();
  if (recRes.error) return { ok: false, error: NOT_KEPT };
  const rec = recRes.data as { gift_record_id: string; wish_item_id: string | null } | null;
  if (!rec) return { ok: false, error: GIFT_GONE };

  let patch: Record<string, unknown>;
  const touched: Array<string | null> = [rec.wish_item_id];

  if (op === 'gift-amount') {
    const amount = cleanGiftAmount(formData.get('amount'));
    if (amount === undefined) return { ok: false, error: GIFT_AMOUNT_NOT_A_NUMBER };
    patch = { amount_php: amount };
  } else if (op === 'gift-move') {
    const to = str(formData, 'wish_item_id');
    if (to === '') {
      patch = { wish_item_id: null };
    } else {
      if (!UUID.test(to)) return { ok: false, error: WISH_GONE };
      /* 🔒 The wish it moves to must be THIS event's. */
      const wishRes = await supabase.from('event_wish_items').select('wish_item_id').eq('wish_item_id', to).eq('event_id', eventId).maybeSingle();
      if (wishRes.error) return { ok: false, error: NOT_KEPT };
      if (!wishRes.data) return { ok: false, error: WISH_GONE };
      patch = { wish_item_id: to };
      touched.push(to);
    }
  } else {
    const removed = str(formData, 'removed');
    if (removed !== '1' && removed !== '0') return { ok: false, error: NOT_KEPT };
    patch = { removed_at: removed === '1' ? new Date().toISOString() : null };
  }

  const { data: kept, error } = await supabase
    .from('event_gift_records')
    .update(patch)
    .eq('gift_record_id', id)
    .eq('event_id', eventId)
    .select('gift_record_id');
  if (error) return { ok: false, error: NOT_KEPT };
  if (!kept || kept.length === 0) return { ok: false, error: GIFT_GONE };

  /* Got it follows the sum — on every wish this record counted or now counts toward. */
  let settled = true;
  for (const wishId of new Set(touched.filter((w): w is string => typeof w === 'string'))) {
    if (!(await settleWishGot(supabase, eventId, wishId))) settled = false;
  }
  return settled ? { ok: true } : { ok: false, error: GIFT_MARK_NOT_SETTLED };
}
