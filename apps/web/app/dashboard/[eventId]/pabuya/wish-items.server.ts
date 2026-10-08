import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { cleanGiftRegistryUrl, GIFT_REGISTRY_URL_ERROR } from '@/lib/gift-registry';
import { parseClientRef, wishPhotoPolicy } from '@/lib/r2-client-ref';
import {
  GIFT_SUM_FIELDS,
  WISH_ITEM_SELECT,
  WISH_NAME_MAX,
  WISH_NOTE_MAX,
  gotAfterGifts,
  sumSent,
  type GiftSumRow,
  type WishItemRow,
} from '@/lib/wish-list';
import { cleanWishPrice } from '@/lib/wish-list-studio';

/**
 * THE WISH LIST'S FOUR WRITES — `saveWishItem` · `deleteWishItem` ·
 * `moveWishItem` · `setWishItemGot` (owner 2026-10-08, E-Gifts › Wish list;
 * design `EGIFTS_WISH_LIST_2026-10-08_fable.md` § 2 + § 6 E-PR2).
 *
 * ── WHY THIS IS NOT A "use server" FILE ────────────────────────────────────
 * Every exported "use server" function is one Vercel route, and production is
 * refused above 2,048 (`scripts/lint-server-action-budget.mjs`; it has stopped
 * production twice). So these four are plain server functions, and they are
 * reached through the E-Gifts page's ONE existing door — `saveEgiftMethod` in
 * `actions.ts`, when the form carries `wish_op` — exactly as `saveCustomSection`
 * carries six intents. +0 exported actions.
 *
 * ── LIVE, NOT DRAFTED (owner: "live") ──────────────────────────────────────
 * A wish is a row, like a way to give: it saves at once and guests see it right
 * away. Nothing here touches the hub draft, and ✓ Apply does not cover it.
 *
 * ── WHO MAY ────────────────────────────────────────────────────────────────
 * Every write goes through the signed-in person's OWN client, so
 * `event_wish_items_host_all` (RLS) is the authorization boundary — the same
 * boundary, and the same predicate, as the ways to give. A write RLS refuses
 * matches no row, and a zero-row write is SAID, never reported as kept.
 *
 * ── THE WORD IS "SENT" ─────────────────────────────────────────────────────
 * Got it is the couple's own mark here ('host'). The automatic mark follows what
 * guests say they sent (`gotAfterGifts`) and is re-settled when the PRICE moves.
 */

export type WishWriteResult = { ok: true } | { ok: false; error: string };

export const WISH_OPS = ['save', 'delete', 'move', 'got'] as const;
export type WishOp = (typeof WISH_OPS)[number];

export function wishOpOf(raw: unknown): WishOp | null {
  return typeof raw === 'string' && (WISH_OPS as readonly string[]).includes(raw) ? (raw as WishOp) : null;
}

const NOT_KEPT = 'Couldn’t keep that. Nothing was changed — please try again.';
const GONE = 'That wish isn’t there any more — reopen E-Gifts and try again.';

function str(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === 'string' ? v.trim() : '';
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The one door `actions.ts` opens: which of the four, then that write. */
export async function wishListWrite(eventId: string, formData: FormData): Promise<WishWriteResult> {
  const op = wishOpOf(formData.get('wish_op'));
  if (!op) return { ok: false, error: NOT_KEPT };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Please sign in again.' };
  switch (op) {
    case 'save':
      return saveWishItem(supabase, eventId, user.id, formData);
    case 'delete':
      return deleteWishItem(supabase, eventId, formData);
    case 'move':
      return moveWishItem(supabase, eventId, formData);
    case 'got':
      return setWishItemGot(supabase, eventId, formData);
  }
}

/**
 * Add a wish (no `wish_item_id`) or keep an open one's fields.
 *
 * A new wish lands at the end of the couple's order. An edit writes the five
 * fields the sheet shows and, when the PRICE moved, re-settles the automatic
 * mark against what guests say they sent — a couple's own mark is never touched.
 */
export async function saveWishItem(
  supabase: SupabaseClient,
  eventId: string,
  userId: string,
  formData: FormData,
): Promise<WishWriteResult> {
  const name = str(formData, 'name');
  if (name.length === 0) return { ok: false, error: 'Give it a name.' };
  if (name.length > WISH_NAME_MAX) return { ok: false, error: `Keep the name to ${WISH_NAME_MAX} characters.` };

  const price = cleanWishPrice(formData.get('price') ?? '');
  if (price === undefined) return { ok: false, error: 'Type the price as a number, or leave it empty for any amount.' };

  /* A shop link pasted without its scheme is still a link. */
  const linkRaw = str(formData, 'link');
  const linkTyped = /^https?:\/\//i.test(linkRaw)
    ? linkRaw.replace(/^https?/i, (scheme) => scheme.toLowerCase())
    : linkRaw === ''
      ? ''
      : `https://${linkRaw}`;
  const link = cleanGiftRegistryUrl(linkTyped);
  if (link === undefined) return { ok: false, error: GIFT_REGISTRY_URL_ERROR };

  const noteRaw = str(formData, 'note');
  if (noteRaw.length > WISH_NOTE_MAX) return { ok: false, error: `Keep the note to ${WISH_NOTE_MAX} characters.` };
  const note = noteRaw === '' ? null : noteRaw;

  const id = str(formData, 'wish_item_id');
  if (id !== '' && !UUID.test(id)) return { ok: false, error: GONE };

  /* The photo comes from <FileUpload> as an `r2://bucket/key` ref. It is pinned
     to THIS event's own wish-list folder in the public media bucket — the guest
     page will draw it for anyone with the link, so a ref naming anything else
     (another event's file, a private bucket) is refused, never stored. On an
     edit, the ref the row ALREADY holds may be echoed back. */
  const photoRaw = str(formData, 'photo_r2_key');
  let photo: string | null = null;
  if (photoRaw !== '') {
    if (parseClientRef(photoRaw, wishPhotoPolicy(eventId))) photo = photoRaw;
    else if (id === '') return { ok: false, error: 'That photo could not be used — please add it again.' };
  }

  if (id === '') {
    const { data: last, error: lastErr } = await supabase
      .from('event_wish_items')
      .select('sort_order')
      .eq('event_id', eventId)
      .order('sort_order', { ascending: false })
      .limit(1);
    if (lastErr) return { ok: false, error: NOT_KEPT };
    const next = ((last?.[0] as { sort_order?: number } | undefined)?.sort_order ?? -1) + 1;
    const { data: made, error } = await supabase
      .from('event_wish_items')
      .insert({
        event_id: eventId,
        name,
        price_php: price,
        link_url: link,
        note,
        photo_r2_key: photo,
        sort_order: next,
        created_by_user_id: userId,
      })
      .select('wish_item_id');
    if (error || !made || made.length === 0) return { ok: false, error: NOT_KEPT };
    return { ok: true };
  }

  /* An edit: read the row (its mark, its price, its photo) and what was sent
     toward it BEFORE writing, so a read that fails changes nothing. */
  const [rowRes, sumRes] = await Promise.all([
    supabase
      .from('event_wish_items')
      .select(WISH_ITEM_SELECT)
      .eq('wish_item_id', id)
      .eq('event_id', eventId)
      .maybeSingle(),
    supabase.from('event_gift_records').select(GIFT_SUM_FIELDS).eq('event_id', eventId).eq('wish_item_id', id),
  ]);
  if (rowRes.error || sumRes.error) return { ok: false, error: NOT_KEPT };
  const row = rowRes.data as unknown as WishItemRow | null;
  if (!row) return { ok: false, error: GONE };

  if (photoRaw !== '' && !photo) {
    if (photoRaw !== (row.photo_r2_key ?? '')) return { ok: false, error: 'That photo could not be used — please add it again.' };
    photo = row.photo_r2_key;
  }

  const patch: Record<string, unknown> = { name, price_php: price, link_url: link, note, photo_r2_key: photo };
  if (price !== row.price_php) {
    const settle = gotAfterGifts({ price_php: price, got_by: row.got_by }, sumSent((sumRes.data ?? []) as unknown as GiftSumRow[]));
    if (settle) {
      patch.got_by = settle.got_by;
      patch.got_at = settle.got_by ? new Date().toISOString() : null;
    }
  }

  const { data: kept, error } = await supabase
    .from('event_wish_items')
    .update(patch)
    .eq('wish_item_id', id)
    .eq('event_id', eventId)
    .select('wish_item_id');
  if (error) return { ok: false, error: NOT_KEPT };
  if (!kept || kept.length === 0) return { ok: false, error: GONE };
  return { ok: true };
}

/** Remove a wish. Its gifts stay on the couple's list as "Any gift" (the FK sets them free). */
export async function deleteWishItem(supabase: SupabaseClient, eventId: string, formData: FormData): Promise<WishWriteResult> {
  const id = str(formData, 'wish_item_id');
  if (!UUID.test(id)) return { ok: false, error: GONE };
  const { data: gone, error } = await supabase
    .from('event_wish_items')
    .delete()
    .eq('wish_item_id', id)
    .eq('event_id', eventId)
    .select('wish_item_id');
  if (error) return { ok: false, error: NOT_KEPT };
  if (!gone || gone.length === 0) return { ok: false, error: GONE };
  return { ok: true };
}

/**
 * The couple's order — ONE call per drag: `order` is every wish id, top to
 * bottom, and each takes its place 0, 1, 2 … An id that is not this event's
 * wish, a wish left out, or one named twice refuses the whole move.
 */
export async function moveWishItem(supabase: SupabaseClient, eventId: string, formData: FormData): Promise<WishWriteResult> {
  const order = str(formData, 'order')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (order.length === 0 || order.some((id) => !UUID.test(id)) || new Set(order).size !== order.length) {
    return { ok: false, error: NOT_KEPT };
  }
  const { data: rows, error: readErr } = await supabase
    .from('event_wish_items')
    .select('wish_item_id, sort_order')
    .eq('event_id', eventId);
  if (readErr || !rows) return { ok: false, error: NOT_KEPT };
  const have = new Map((rows as Array<{ wish_item_id: string; sort_order: number }>).map((r) => [r.wish_item_id, r.sort_order]));
  if (have.size !== order.length || order.some((id) => !have.has(id))) return { ok: false, error: GONE };

  for (const [place, id] of order.entries()) {
    if (have.get(id) === place) continue;
    const { data: moved, error } = await supabase
      .from('event_wish_items')
      .update({ sort_order: place })
      .eq('wish_item_id', id)
      .eq('event_id', eventId)
      .select('wish_item_id');
    if (error || !moved || moved.length === 0) return { ok: false, error: NOT_KEPT };
  }
  return { ok: true };
}

/**
 * The couple's own Got it switch: on = "we have it" (marked by you), off = open
 * again. Off always opens the wish, even one the gifts had marked — "flip it off
 * if it isn't in your account yet".
 */
export async function setWishItemGot(supabase: SupabaseClient, eventId: string, formData: FormData): Promise<WishWriteResult> {
  const id = str(formData, 'wish_item_id');
  const got = str(formData, 'got');
  if (!UUID.test(id) || (got !== '1' && got !== '0')) return { ok: false, error: GONE };
  const patch = got === '1' ? { got_at: new Date().toISOString(), got_by: 'host' } : { got_at: null, got_by: null };
  const { data: kept, error } = await supabase
    .from('event_wish_items')
    .update(patch)
    .eq('wish_item_id', id)
    .eq('event_id', eventId)
    .select('wish_item_id');
  if (error) return { ok: false, error: NOT_KEPT };
  if (!kept || kept.length === 0) return { ok: false, error: GONE };
  return { ok: true };
}
