/**
 * apps/web/lib/wish-list-studio.ts
 *
 * STUDIO › E-GIFTS › WISH LIST — what the couple's screen is handed, and the
 * words it prints (owner 2026-10-08; design `EGIFTS_WISH_LIST_2026-10-08_fable.md`
 * § 2, prototype `egifts_wish_list_2026-10-08_fable.html` `wishRow` /
 * `wishSection` / `sheetHtml`).
 *
 * Pure — no Supabase, no React, no 'server-only' — so the server builds the
 * view, the client draws it, and a test holds every line.
 *
 * ── THE WORD IS "SENT" ─────────────────────────────────────────────────────
 * Every figure here is what guests SAY they sent. No line in this file may
 * claim more than that (`the-guest-text-is-honest.test.ts` reads it).
 */
import { EGIFT_KIND_META, isEgiftMethodKind } from '@/lib/egift-kinds';
import { formatPhp } from '@/lib/php';
import { giftsAreOn } from '@/lib/event-answers';
import {
  countSent,
  meterPercent,
  sentByWish,
  sumSent,
  type GiftRecordRow,
  type WishGotBy,
  type WishItemRow,
} from '@/lib/wish-list';

/** One gift a guest says they sent toward a wish, as the couple's sheet lists it. */
export type StudioWishGift = {
  id: string;
  giverName: string;
  /** The way they said they used (an E-Gifts kind), or null. */
  methodKind: string | null;
  /** ISO timestamp of the record. */
  at: string;
  message: string | null;
  amountPhp: number;
  /** Did they add a screenshot? (The picture itself is served by wish list 5/5.) */
  hasShot: boolean;
};

/** One wish, as Studio › E-Gifts draws it. */
export type StudioWish = {
  id: string;
  name: string;
  pricePhp: number | null;
  /** The stored `r2://…` ref — what the photo field holds and posts back. */
  photoRef: string | null;
  /** A plain URL for the picture, or null. */
  photoUrl: string | null;
  linkUrl: string | null;
  note: string | null;
  gotBy: WishGotBy | null;
  /** Pesos guests say they sent toward it (removed records never count). */
  sentPhp: number;
  /** Its counted gifts, newest first. */
  gifts: StudioWishGift[];
};

/**
 * A wish as the WRITE answers with it (`saveWishItem`): the row the server
 * kept — its real id, its link as stored, its picture's address, its mark after
 * a price change. The screen lays it over what it drew, so no Maker re-read is
 * owed for an add or an edit. It carries no sum and no gift: a save changes
 * neither, and the screen keeps the ones it holds.
 */
export type StudioWishKept = Omit<StudioWish, 'sentPhp' | 'gifts'>;

/** One row → the fields a save answers with (and the list read builds on). */
export function studioWishKeptFrom(w: WishItemRow, photoUrlFor: (ref: string | null) => string | null): StudioWishKept {
  return {
    id: w.wish_item_id,
    name: w.name,
    pricePhp: w.price_php,
    photoRef: w.photo_r2_key,
    photoUrl: photoUrlFor(w.photo_r2_key),
    linkUrl: w.link_url,
    note: w.note,
    gotBy: w.got_at != null ? (w.got_by ?? 'host') : null,
  };
}

/**
 * The whole section's data. `read: false` = the wishes or their gifts could NOT
 * be read — the screen then says so and draws no list, no "No wishes yet" and no
 * add button (a refused read never renders as empty).
 */
export type StudioWishList =
  | { read: false }
  | {
      read: true;
      /** The couple's order; got wishes are sunk to the end by the screen. */
      wishes: StudioWish[];
      /** Everything guests say they sent — toward a wish or toward none. */
      totalSentPhp: number;
      totalGifts: number;
    };

/* ── the words ───────────────────────────────────────────────────────────── */

export const WISH_LIST_TIP =
  'Things you’d love. Guests send toward one through your own GCash or bank and tell you with a screenshot — Setnayan never holds the money.';
export const WISH_PRICE_TIP =
  'Leave it empty and guests send any amount; a wish with no price never marks itself got';
export const WISH_LIST_EMPTY = 'No wishes yet.';
export const WISH_LIST_NO_WAY =
  'Switch on a way to give — guests can’t send for a wish without one, so the list is kept but not shown.';
export const WISH_LIST_UNREAD_TITLE = 'Couldn’t load your wish list.';
export const WISH_LIST_UNREAD_LINE = 'Your wishes and gifts are still there — this phone couldn’t fetch them.';
export const WISH_SHEET_KEEPS = 'Changes keep as you type';
export const WISH_GIFTS_ONLY_YOU = 'Only you see these.';
export const GIFTS_OFF_TITLE = 'Guests see no E-Gifts.';
export const GIFTS_OFF_LINE = 'Your ways to give, wish list and gifts are kept for when you switch it back on.';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Is this wish marked got (by the gifts, or by the couple)? */
export function studioWishIsGot(w: Pick<StudioWish, 'gotBy'>): boolean {
  return w.gotBy != null;
}

/** Open wishes in the couple's order, then the got ones — "got wishes sink to the end". */
export function studioWishesInOrder<T extends Pick<StudioWish, 'gotBy'>>(wishes: readonly T[]): T[] {
  return [...wishes.filter((w) => !studioWishIsGot(w)), ...wishes.filter(studioWishIsGot)];
}

/** "4 wishes · 1 got" — the count beside the eyebrow (open wishes, then the got ones). */
export function wishListCount(wishes: readonly Pick<StudioWish, 'gotBy'>[]): string | null {
  if (wishes.length === 0) return null;
  const got = wishes.filter(studioWishIsGot).length;
  const open = wishes.length - got;
  return `${plural(open, 'wish', 'wishes')}${got ? ` · ${got} got` : ''}`;
}

/** The link as a row shows it — its address without the scheme. */
function linkWords(link: string | null): string | null {
  if (!link) return null;
  return link.replace(/^https?:\/\//i, '').replace(/\/$/, '');
}

/**
 * The line under a wish's name:
 *   got            → "₱2,500 sent of ₱2,500" (+ " · marked by you")
 *   gifts so far   → "₱4,000 sent of ₱4,500 · 2 gifts"
 *   nothing yet    → "₱3,200" or "Any amount" (+ " · shop.example/…")
 */
export function wishRowLine(w: Pick<StudioWish, 'pricePhp' | 'sentPhp' | 'gifts' | 'gotBy' | 'linkUrl'>): string {
  const n = w.gifts.length;
  const of = w.pricePhp != null ? ` of ${formatPhp(w.pricePhp)}` : '';
  if (studioWishIsGot(w)) return `${formatPhp(w.sentPhp)} sent${of}${w.gotBy === 'host' ? ' · marked by you' : ''}`;
  if (n > 0) return `${formatPhp(w.sentPhp)} sent${of} · ${plural(n, 'gift', 'gifts')}`;
  const link = linkWords(w.linkUrl);
  return `${w.pricePhp == null ? 'Any amount' : formatPhp(w.pricePhp)}${link ? ` · ${link}` : ''}`;
}

/**
 * The same line in two pieces, so the screen can COUNT the sent figure (the
 * button rule's Rule 2) and print the rest as words. `sentPhp` is null when the
 * line does not open with what was sent.
 */
export function wishRowLineParts(
  w: Pick<StudioWish, 'pricePhp' | 'sentPhp' | 'gifts' | 'gotBy' | 'linkUrl'>,
): { sentPhp: number | null; rest: string } {
  const line = wishRowLine(w);
  const lead = studioWishIsGot(w) || w.gifts.length > 0 ? formatPhp(w.sentPhp) : null;
  return lead && line.startsWith(lead) ? { sentPhp: w.sentPhp, rest: line.slice(lead.length) } : { sentPhp: null, rest: line };
}

/** The meter under a wish that has gifts: its fill, and gold while filling / green when got. */
export function wishRowMeter(w: Pick<StudioWish, 'pricePhp' | 'sentPhp' | 'gifts' | 'gotBy'>): { percent: number; got: boolean } | null {
  if (w.gifts.length === 0) return null;
  const got = studioWishIsGot(w);
  const percent = meterPercent(w.pricePhp, w.sentPhp);
  if (percent == null) return got ? { percent: 100, got } : null;
  return { percent: got ? 100 : percent, got };
}

/** The pill beside an open wish's name in its sheet: "₱4,000 of ₱4,500". Null with no gifts. */
export function wishSheetPill(w: Pick<StudioWish, 'pricePhp' | 'sentPhp' | 'gifts'>): string | null {
  if (w.gifts.length === 0) return null;
  return `${formatPhp(w.sentPhp)}${w.pricePhp != null ? ` of ${formatPhp(w.pricePhp)}` : ''}`;
}

/** The honest line under the Got it switch. */
export function wishGotLine(w: Pick<StudioWish, 'pricePhp' | 'gotBy'>): string {
  if (w.gotBy === 'auto' && w.pricePhp != null) {
    return `Reached ${formatPhp(w.pricePhp)} — marked for you. Flip it off if it isn’t in your account yet.`;
  }
  if (w.gotBy === 'host') return 'Marked by you';
  if (w.gotBy === 'auto') return 'Marked for you';
  if (w.pricePhp == null) return 'No price — flip it yourself when it arrives';
  return `Marks itself when the gifts sent reach ${formatPhp(w.pricePhp)}`;
}

/** "₱14,500 said sent · 5 gifts" — or "None yet". */
export function giftsSentLine(totalSentPhp: number, totalGifts: number): string {
  if (totalGifts === 0) return 'None yet';
  return `${formatPhp(totalSentPhp)} said sent · ${plural(totalGifts, 'gift', 'gifts')}`;
}

/** "GCash · Tue 3:12 pm" — the way they said they used, and when. */
export function giftWhenLine(g: Pick<StudioWishGift, 'methodKind' | 'at'>, timeZone = 'Asia/Manila'): string {
  const way = g.methodKind && isEgiftMethodKind(g.methodKind) ? EGIFT_KIND_META[g.methodKind].defaultLabel : null;
  const d = new Date(g.at);
  let when = '';
  if (!Number.isNaN(d.getTime())) {
    const day = new Intl.DateTimeFormat('en-PH', { weekday: 'short', timeZone }).format(d);
    const time = new Intl.DateTimeFormat('en-PH', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone })
      .format(d)
      .replace(/ | /g, ' ')
      .toLowerCase();
    when = `${day} ${time}`;
  }
  return [way, when].filter(Boolean).join(' · ');
}

/* ── the one-setting rule ────────────────────────────────────────────────── */

/** Is at least one way to give switched on? (What `fetchEgiftMethods({ enabledOnly })` would hand a guest.) */
export function aWayToGiveIsOn(methods: readonly { is_enabled: boolean }[]): boolean {
  return methods.some((m) => m.is_enabled);
}

/**
 * IS THE WISH LIST SHOWN TO GUESTS? ONE rule, asked by the Studio's warning, by
 * its "What guests see" line and by the guest page — never three copies.
 *
 *   · "Accept gifts?" is an explicit No   → no (nothing of E-Gifts is drawn);
 *   · no way to give is switched on       → no (a guest could not send for a
 *     wish, so the list is KEPT but not shown);
 *   · there is no wish                    → no (nothing to show).
 *
 * There is deliberately NO switch of its own: the list follows the two settings
 * that already exist.
 */
export function wishListShownToGuests(input: {
  /** `events.gifts_on` (null = never answered = on). */
  giftsOn: unknown;
  methods: readonly { is_enabled: boolean }[];
  wishCount: number;
}): boolean {
  if (!giftsAreOn(input.giftsOn)) return false;
  if (!aWayToGiveIsOn(input.methods)) return false;
  return input.wishCount > 0;
}

/** "Wish list · 4 wishes" — the piece added to the Studio's "What guests see" line; null when guests see no list. */
export function wishListSeenLine(openWishes: number, methods: readonly { is_enabled: boolean }[]): string | null {
  if (openWishes <= 0 || !aWayToGiveIsOn(methods)) return null;
  return `Wish list · ${plural(openWishes, 'wish', 'wishes')}`;
}

/* ── what the sheet posts ────────────────────────────────────────────────── */

/** Typed price → whole pesos, `null` for empty ("any amount"), `undefined` when it is not a price. */
export function cleanWishPrice(raw: unknown): number | null | undefined {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'string') return undefined;
  const digits = raw.replace(/[\s,₱]/g, '');
  if (digits === '') return null;
  if (!/^\d{1,9}$/.test(digits)) return undefined;
  const n = Number(digits);
  return n > 0 ? n : undefined;
}

/* ── the rows → the view ─────────────────────────────────────────────────── */

/**
 * The rows → the screen's view (`lib/wish-list.server.ts` reads the rows and
 * hands in its URL resolver, so this is a unit test with no R2 and no database).
 *
 * A record the couple removed is in neither a sum nor a wish's list; a record
 * toward no wish counts in the total only.
 */
export function studioWishListFrom(
  wishes: readonly WishItemRow[],
  records: readonly GiftRecordRow[],
  photoUrlFor: (ref: string | null) => string | null,
): StudioWishList {
  const sums = sentByWish(records);
  const giftsOf = new Map<string, StudioWishGift[]>();
  for (const r of records) {
    if (r.removed_at != null || r.wish_item_id == null) continue;
    const list = giftsOf.get(r.wish_item_id) ?? [];
    list.push({
      id: r.gift_record_id,
      giverName: r.giver_name,
      methodKind: r.method_kind ?? null,
      at: r.created_at,
      message: r.message,
      amountPhp: r.amount_php,
      hasShot: Boolean(r.screenshot_r2_key),
    });
    giftsOf.set(r.wish_item_id, list);
  }
  const view: StudioWish[] = wishes.map((w) => ({
    ...studioWishKeptFrom(w, photoUrlFor),
    sentPhp: sums.get(w.wish_item_id)?.sentPhp ?? 0,
    gifts: giftsOf.get(w.wish_item_id) ?? [],
  }));
  return { read: true, wishes: view, totalSentPhp: sumSent(records), totalGifts: countSent(records) };
}
