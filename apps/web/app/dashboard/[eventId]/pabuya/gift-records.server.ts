import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { cleanGiftAmount } from '@/lib/gift-record';
import { GIFT_SUM_FIELDS, gotAfterGifts, sumSent, type GiftSumRow, type WishGotBy } from '@/lib/wish-list';
import { GIFT_AMOUNT_NOT_A_NUMBER, GIFT_SHOT_UNREAD } from '@/lib/wish-list-studio';
import { readGiftShotUrl } from '@/lib/wish-list.server';

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
 * ── AS FEW REQUESTS AS THE TASK ALLOWS (owner rule, 2026-10-08) ────────────
 *   · correct the amount / remove / put back: ONE write, and it answers with the
 *     wish the record counts toward — no read before it (a write that matches
 *     no row changes nothing and is said);
 *   · move: the record's old wish and the wish it moves to are read TOGETHER,
 *     then the one write;
 *   · Got it: every wish the record touched is added up in ONE pass — two reads
 *     side by side, whatever the number of wishes — and a mark is written only
 *     for a wish whose mark actually changes (usually none);
 *   · a gift toward no wish touches no wish: the write is the whole request.
 *
 * ── AND ONE READ: THE SCREENSHOT OF THE GIFT THAT WAS OPENED ───────────────
 * `gift-shot` rides the same door and writes nothing. It answers with a
 * short-lived signed address of THAT record's screenshot (`readGiftShotUrl`) —
 * asked when the couple opens one gift, never per row of a list.
 *
 * A record is what a guest SAYS they sent — nothing here says a gift arrived.
 */

/**
 * `shotUrl` — only on `gift-shot`: the opened record's screenshot (null = it has none).
 * `kept` — on a refusal that came AFTER the record was changed (its wish's mark
 * could not be brought up to date): the screen keeps the change it drew.
 */
export type GiftWriteResult = { ok: true; shotUrl?: string | null } | { ok: false; error: string; kept?: true };

/** The three writes — each changes a record, so the guests' sums are refreshed after it. */
export const GIFT_WRITE_OPS = ['gift-amount', 'gift-move', 'gift-remove'] as const;
/** The one read — it changes nothing, so nothing is refreshed after it. */
export const GIFT_READ_OP = 'gift-shot';
export const GIFT_OPS = [...GIFT_WRITE_OPS, GIFT_READ_OP] as const;
export type GiftOp = (typeof GIFT_OPS)[number];

export function giftOpOf(raw: unknown): GiftOp | null {
  return typeof raw === 'string' && (GIFT_OPS as readonly string[]).includes(raw) ? (raw as GiftOp) : null;
}

/** Does this op change a record? (`gift-shot` only looks.) */
export function giftOpWrites(op: GiftOp): boolean {
  return op !== GIFT_READ_OP;
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
 * Add the given wishes' gifts up again — ALL of them in one pass, two reads side
 * by side — and write what `gotAfterGifts` decides for each wish whose mark
 * changes. `false` = a wish could not be read or written (the caller says so).
 */
export async function settleWishesGot(supabase: SupabaseClient, eventId: string, wishIds: readonly string[]): Promise<boolean> {
  const ids = [...new Set(wishIds)];
  if (ids.length === 0) return true;
  const [wishRes, sumRes] = await Promise.all([
    supabase.from('event_wish_items').select('wish_item_id, price_php, got_by').eq('event_id', eventId).in('wish_item_id', ids),
    supabase.from('event_gift_records').select(GIFT_SUM_FIELDS).eq('event_id', eventId).in('wish_item_id', ids),
  ]);
  if (wishRes.error || sumRes.error) return false;
  const wishes = (wishRes.data ?? []) as unknown as Array<{ wish_item_id: string; price_php: number | null; got_by: WishGotBy | null }>;
  const sums = (sumRes.data ?? []) as unknown as GiftSumRow[];
  /* A wish removed meanwhile is simply not in the read: there is no mark left to settle. */
  const marks = wishes.flatMap((wish) => {
    const settle = gotAfterGifts({ price_php: wish.price_php, got_by: wish.got_by }, sumSent(sums.filter((r) => r.wish_item_id === wish.wish_item_id)));
    return settle ? [{ wishId: wish.wish_item_id, got_by: settle.got_by }] : [];
  });
  if (marks.length === 0) return true;
  const at = new Date().toISOString();
  const written = await Promise.all(
    marks.map((m) =>
      supabase
        .from('event_wish_items')
        .update({ got_by: m.got_by, got_at: m.got_by ? at : null })
        .eq('wish_item_id', m.wishId)
        .eq('event_id', eventId)
        .select('wish_item_id'),
    ),
  );
  return written.every((w) => !w.error && (w.data ?? []).length > 0);
}

/** The one door `wishListWrite` opens for a gift record: which of the four, then that. */
export async function giftRecordWrite(supabase: SupabaseClient, eventId: string, op: GiftOp, formData: FormData): Promise<GiftWriteResult> {
  const id = str(formData, 'gift_record_id');
  if (!UUID.test(id)) return { ok: false, error: GIFT_GONE };

  /* 🖼 The opened gift's screenshot — a read, for a host only. Nothing is written. */
  if (op === 'gift-shot') {
    const shot = await readGiftShotUrl(supabase, eventId, id);
    if (shot.read) return { ok: true, shotUrl: shot.url };
    return { ok: false, error: shot.gone ? GIFT_GONE : GIFT_SHOT_UNREAD };
  }

  let patch: Record<string, unknown>;
  /** The wish the record LEFT (a move only) — its mark may open again. */
  let left: string | null = null;

  if (op === 'gift-amount') {
    const amount = cleanGiftAmount(formData.get('amount'));
    if (amount === undefined) return { ok: false, error: GIFT_AMOUNT_NOT_A_NUMBER };
    patch = { amount_php: amount };
  } else if (op === 'gift-move') {
    const to = str(formData, 'wish_item_id');
    if (to !== '' && !UUID.test(to)) return { ok: false, error: WISH_GONE };
    /* The record as it stands (which wish it leaves) and — 🔒 — the wish it moves to, which
       must be THIS event's: read together, BEFORE the write, so a read that fails changes nothing. */
    const [recRes, wishRes] = await Promise.all([
      supabase.from('event_gift_records').select('gift_record_id, wish_item_id').eq('gift_record_id', id).eq('event_id', eventId).maybeSingle(),
      to === ''
        ? Promise.resolve({ data: null, error: null })
        : supabase.from('event_wish_items').select('wish_item_id').eq('wish_item_id', to).eq('event_id', eventId).maybeSingle(),
    ]);
    if (recRes.error || wishRes.error) return { ok: false, error: NOT_KEPT };
    const rec = recRes.data as { gift_record_id: string; wish_item_id: string | null } | null;
    if (!rec) return { ok: false, error: GIFT_GONE };
    if (to !== '' && !wishRes.data) return { ok: false, error: WISH_GONE };
    left = rec.wish_item_id;
    patch = { wish_item_id: to === '' ? null : to };
  } else {
    const removed = str(formData, 'removed');
    if (removed !== '1' && removed !== '0') return { ok: false, error: NOT_KEPT };
    patch = { removed_at: removed === '1' ? new Date().toISOString() : null };
  }

  /* THE ONE WRITE — and it answers with the wish the record counts toward now. */
  const { data: kept, error } = await supabase
    .from('event_gift_records')
    .update(patch)
    .eq('gift_record_id', id)
    .eq('event_id', eventId)
    .select('gift_record_id, wish_item_id');
  if (error) return { ok: false, error: NOT_KEPT };
  const now = ((kept ?? []) as unknown as Array<{ gift_record_id: string; wish_item_id: string | null }>)[0];
  if (!now) return { ok: false, error: GIFT_GONE };

  /* Got it follows the sum — on every wish this record counted or now counts toward. */
  const touched = [left, now.wish_item_id].filter((w): w is string => typeof w === 'string');
  if (await settleWishesGot(supabase, eventId, touched)) return { ok: true };
  return { ok: false, error: GIFT_MARK_NOT_SETTLED, kept: true };
}
