/**
 * apps/web/lib/wish-list-guest.ts
 *
 * THE WISH LIST AS A GUEST READS IT — what the E-Gifts page is handed, and the
 * words it prints (owner 2026-10-08, "ok wish list" · "per item"; design
 * `EGIFTS_WISH_LIST_2026-10-08_fable.md` § 2 "Guest", prototype
 * `egifts_wish_list_2026-10-08_fable.html` `guestItem` / `guestWish` /
 * `welcome`, frames 12–17 · 21–24).
 *
 * Pure — no Supabase, no React, no 'server-only' — so the server builds the
 * view, the client draws it, and a test holds every line.
 *
 * ── WHO SEES WHAT ──────────────────────────────────────────────────────────
 * A guest sees each wish and ONE figure beside it: what guests say they sent
 * toward it. Nothing here can carry another guest's name, amount, words or
 * screenshot — `GuestWish` has no field for them, and it is built from
 * `GIFT_SUM_FIELDS` alone (three columns, none of which names a person).
 *
 * ── THE WORD IS "SENT" ─────────────────────────────────────────────────────
 * Setnayan never holds or sees the money, so no line here says a gift was
 * received, paid, verified or funded (`the-guest-text-is-honest.test.ts`).
 */
import { formatPhp } from '@/lib/php';
import { youSentLine } from '@/lib/gift-record';
import { leftToReach, meterPercent, sentByWish, type GiftSumRow, type WishItemRow } from '@/lib/wish-list';

/** One wish, as a guest's page draws it. */
export type GuestWish = {
  /** The wish's PUBLIC id (`S89H-…`) — the handle a guest's own record will name. Never the row's uuid. */
  id: string;
  name: string;
  /** Whole pesos, or null = "any amount". */
  pricePhp: number | null;
  /** A plain URL for the couple's photo of it, or null. */
  photoUrl: string | null;
  note: string | null;
  got: boolean;
  /** Pesos guests say they sent toward it — a sum, never a list. */
  sentPhp: number;
  /** What THIS reader says they sent toward it (their own records only) — 0 for none, or for a reader with no invitation. */
  minePhp: number;
};

/**
 * What the guest page is handed. `read: false` = the wishes or their sums could
 * not be read: the page then draws NO list — it never draws wishes with nothing
 * sent beside them, which would be a claim.
 */
export type GuestWishList = { read: false } | { read: true; wishes: GuestWish[] };

/** The columns the guest read takes from `event_wish_items` (`WISH_GUEST_FIELDS`). */
export type GuestWishRow = Pick<
  WishItemRow,
  'wish_item_id' | 'public_id' | 'name' | 'price_php' | 'photo_r2_key' | 'note' | 'sort_order' | 'got_at'
>;

/**
 * The rows → the view: open wishes in the couple's order, then the got ones
 * ("a got wish … at the end"). A record the couple removed is in no sum.
 */
export function guestWishListFrom(
  wishes: readonly GuestWishRow[],
  sums: readonly GiftSumRow[],
  photoUrlFor: (ref: string | null) => string | null,
  /** The READER's own records (the same three columns) — theirs alone; omitted for a reader with no invitation. */
  mine: readonly GiftSumRow[] = [],
): GuestWishList {
  const sent = sentByWish(sums);
  const own = sentByWish(mine);
  const view = wishes.map((w): GuestWish => ({
    id: w.public_id,
    name: w.name,
    pricePhp: w.price_php,
    photoUrl: photoUrlFor(w.photo_r2_key),
    note: w.note,
    got: w.got_at != null,
    sentPhp: sent.get(w.wish_item_id)?.sentPhp ?? 0,
    minePhp: own.get(w.wish_item_id)?.sentPhp ?? 0,
  }));
  return { read: true, wishes: [...view.filter((w) => !w.got), ...view.filter((w) => w.got)] };
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "4 wishes · 1 got" — beside the list's eyebrow. Null for an empty list. */
export function guestWishCount(wishes: readonly Pick<GuestWish, 'got'>[]): string | null {
  if (wishes.length === 0) return null;
  const got = wishes.filter((w) => w.got).length;
  return `${plural(wishes.length - got, 'wish', 'wishes')}${got ? ` · ${got} got` : ''}`;
}

/** How many wishes are still open. */
export function openWishCount(wishes: readonly Pick<GuestWish, 'got'>[]): number {
  return wishes.filter((w) => !w.got).length;
}

export const GUEST_WISH_GOT = 'Got it ✓ · thank you';
export const GUEST_WISH_ALREADY_GOT = 'Already got — thank you!';
export const GUEST_WISH_HOW = 'Tap a wish to send toward it — or give any amount below.';

/**
 * The line under a wish's name:
 *   got            → "Got it ✓ · thank you"
 *   no price       → "Any amount" (+ " · ₱3,000 sent so far")
 *   gifts so far   → "₱4,000 of ₱4,500 sent"
 *   nothing yet    → "₱3,200" (+ " · the grey one")
 */
export function guestWishLine(w: Pick<GuestWish, 'got' | 'pricePhp' | 'sentPhp' | 'note'> & { minePhp?: number }): string {
  if (w.got) return GUEST_WISH_GOT;
  /* The reader's own gift toward it: "You sent ₱500 ✓ · ₱4,500 of ₱4,500". */
  if ((w.minePhp ?? 0) > 0) return youSentLine(w.minePhp!, w);
  if (w.pricePhp == null) return `Any amount${w.sentPhp > 0 ? ` · ${formatPhp(w.sentPhp)} sent so far` : ''}`;
  if (w.sentPhp > 0) return `${formatPhp(w.sentPhp)} of ${formatPhp(w.pricePhp)} sent`;
  return `${formatPhp(w.pricePhp)}${w.note ? ` · ${w.note}` : ''}`;
}

/** The meter under a wish: drawn once something was sent, or it is got. Null = no meter. */
export function guestWishMeter(w: Pick<GuestWish, 'got' | 'pricePhp' | 'sentPhp'>): { percent: number; got: boolean } | null {
  if (w.got) return { percent: 100, got: true };
  if (w.sentPhp <= 0) return null;
  const percent = meterPercent(w.pricePhp, w.sentPhp);
  return percent == null ? null : { percent, got: false };
}

/** The send sheet's title: "Send for the Air fryer" — or, with no price, "Send a gift toward the Air fryer". */
export function sendSheetTitle(w: Pick<GuestWish, 'name' | 'pricePhp'>): string {
  return w.pricePhp == null ? `Send a gift toward the ${w.name}` : `Send for the ${w.name}`;
}

/**
 * The send sheet's first line, in two pieces so the amount can be set in bold:
 *   "₱500 more" + " reaches ₱4,500 · any amount helps — it goes straight to Maria & Jose's own account."
 *   ""          + "Any amount is welcome — it goes straight to …'s own account."
 */
export function sendSheetLine(
  w: Pick<GuestWish, 'pricePhp' | 'sentPhp'>,
  hostPossessive: string,
): { lead: string; rest: string } {
  const tail = ` — it goes straight to ${hostPossessive} own account.`;
  const left = leftToReach(w.pricePhp, w.sentPhp);
  if (w.pricePhp == null || left == null) return { lead: '', rest: `Any amount is welcome${tail}` };
  if (left <= 0) return { lead: '', rest: `Any amount helps${tail}` };
  return { lead: `${formatPhp(left)} more`, rest: ` reaches ${formatPhp(w.pricePhp)} · any amount helps${tail}` };
}

/** "Wish list · 4 things they'd love" — the Welcome door's extra line. Null when there is no open wish. */
export function wishDoorLine(openWishes: number): string | null {
  if (!Number.isFinite(openWishes) || openWishes <= 0) return null;
  return `Wish list · ${plural(openWishes, 'thing', 'things')} they’d love`;
}

/* ── the look ────────────────────────────────────────────────────────────── */

/** The list's four drawings — one per shipped E-Gifts look. */
export type WishListShape = 'rows' | 'side' | 'tiles' | 'ruled';

/**
 * THE LIST WEARS THE E-GIFTS LOOK ALREADY PICKED in Stages › Style — there is no
 * second picker. `partLook` is the Welcome door's own `data-part-look`
 * (`partLookAttr('gifts', …)`: null for "The door", else `gifts.<id>`).
 *
 *   The door      → Rows        Side rule     → Rows with the rule down the left
 *   Centred       → Tiles       Between rules → Ruled
 */
export function wishListShape(partLook: string | null | undefined): WishListShape {
  if (partLook === 'gifts.centred') return 'tiles';
  if (partLook === 'gifts.ruled') return 'ruled';
  if (partLook === 'gifts.side-rule') return 'side';
  return 'rows';
}
