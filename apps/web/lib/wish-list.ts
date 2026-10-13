/**
 * apps/web/lib/wish-list.ts
 *
 * E-GIFTS › THE WISH LIST — the two rows and the two sums (owner 2026-10-08,
 * DECISION_LOG "E-GIFTS WISH LIST"; design `EGIFTS_WISH_LIST_2026-10-08_fable.md`;
 * tables `event_wish_items` + `event_gift_records`, migration 20271266228704).
 *
 * Pure data + arithmetic ONLY — no 'server-only', no Supabase client, no React —
 * so the Studio (client), the guest page (server) and the actions share ONE
 * answer to "how much was sent" and "has it reached its price".
 *
 * ── THE WORD IS "SENT" ─────────────────────────────────────────────────────
 * A gift record is what a guest SAYS they sent through the couple's own GCash,
 * Maya or bank: a screenshot, an amount, a word. Setnayan never holds or sees
 * the money, so nothing here is "received", "paid", "verified" or "funded" —
 * not a function name, not a field, not a label built from them.
 *
 * ── THE RULES THE OWNER GAVE ───────────────────────────────────────────────
 *   · "it will accumulate all the gift and mark them one by one" + "per item" —
 *     gifts add up on the wish the guest picked;
 *   · "when amount is reached" — a wish marks itself got when the gifts sent
 *     reach its price;
 *   · a wish with NO price takes any amount and never marks itself;
 *   · a record the couple REMOVED never counts.
 */

import type { EgiftMethodKind } from '@/lib/egift-kinds';

/* ── limits — each mirrors a CHECK in the migration (pinned by the db test) ── */
export const WISH_NAME_MAX = 60;
export const WISH_NOTE_MAX = 120;
export const WISH_LINK_MAX = 500;
export const GIFT_MESSAGE_MAX = 240;
export const GIFT_GIVER_NAME_MAX = 80;

/** Who marked a wish got: the gifts reaching its price, or the couple's switch. */
export type WishGotBy = 'auto' | 'host';

/** `event_wish_items`, as the hosts read it. */
export type WishItemRow = {
  wish_item_id: string;
  public_id: string;
  event_id: string;
  name: string;
  /** Whole pesos. null = "any amount" — never marks itself got. */
  price_php: number | null;
  /** The tagged `r2://bucket/key` ref (lib/uploads.ts), or null. */
  photo_r2_key: string | null;
  link_url: string | null;
  note: string | null;
  sort_order: number;
  /** null = open. */
  got_at: string | null;
  got_by: WishGotBy | null;
  created_at: string;
  updated_at: string;
};

/** `event_gift_records`, as the hosts read it — a guest's CLAIM, never money. */
export type GiftRecordRow = {
  gift_record_id: string;
  public_id: string;
  event_id: string;
  /** null = a gift toward no wish ("Any gift"). */
  wish_item_id: string | null;
  /** Whole pesos the guest said they sent. */
  amount_php: number;
  screenshot_r2_key: string | null;
  message: string | null;
  giver_name: string;
  giver_guest_id: string | null;
  method_kind: EgiftMethodKind | string | null;
  created_at: string;
  /** The couple's soft Remove. A removed record never counts. */
  removed_at: string | null;
};

/** The least a sum needs from a record. */
export type GiftSumRow = Pick<GiftRecordRow, 'wish_item_id' | 'amount_php' | 'removed_at'>;

/**
 * THE TABLES' CANONICAL LISTS — every column a host reader takes. These two are
 * the `*_SELECT` constants the dup-rule guard treats as canonical: a hand-typed
 * near-copy that drops a column fails CI, which is the point.
 */
export const WISH_ITEM_SELECT =
  'wish_item_id, public_id, event_id, name, price_php, photo_r2_key, link_url, note, sort_order, got_at, got_by, created_at, updated_at';

export const GIFT_RECORD_SELECT =
  'gift_record_id, public_id, event_id, wish_item_id, amount_php, screenshot_r2_key, message, giver_name, giver_guest_id, method_kind, created_at, removed_at';

/**
 * ONE PURPOSE'S PROJECTIONS — deliberately NOT named `*_SELECT` / `*_COLUMNS`,
 * so nothing reads them as the table's whole list.
 *
 *   · the SUM reads three columns and nothing that names a person;
 *   · the GUEST page shows a wish, never who added it or when it changed;
 *   · the GIVER read ("I sent it") asks who this guest is — the everyday name
 *     `guestDisplayName` prints, and whether they are still on the list. It is
 *     asked once to draw the page and again by the write, so it is written down
 *     once, here; it never needs a role or the formal parts of a name;
 *   · the ERASURE sweep asks where a giver's screenshot is kept, and reads
 *     nothing they wrote.
 */
export const GIFT_SUM_FIELDS = 'wish_item_id, amount_php, removed_at';

/** `guests` — the giver. See "ONE PURPOSE'S PROJECTIONS" above. */
export const GIFT_GIVER_FIELDS = 'guest_id, event_id, display_name, first_name, last_name, deleted_at';

/** `event_gift_records` — where a screenshot is kept. See "ONE PURPOSE'S PROJECTIONS" above. */
export const GIFT_SHOT_FIELDS = 'gift_record_id, event_id, giver_guest_id, screenshot_r2_key';

export const WISH_GUEST_FIELDS =
  'wish_item_id, public_id, name, price_php, photo_r2_key, link_url, note, sort_order, got_at';

/** A record counts when the couple has not removed it and its amount is a real, positive peso figure. */
function counts(record: GiftSumRow): boolean {
  return (
    record.removed_at == null &&
    typeof record.amount_php === 'number' &&
    Number.isFinite(record.amount_php) &&
    record.amount_php > 0
  );
}

/**
 * Pesos the given records say were SENT. Removed records never count.
 *
 * Pass the records of ONE wish (or of the whole event for "₱14,500 said sent in
 * 5 gifts"); `sentByWish` splits an event's records per wish in one pass.
 */
export function sumSent(records: readonly GiftSumRow[]): number {
  let total = 0;
  for (const r of records) if (counts(r)) total += r.amount_php;
  return total;
}

/** How many of the given records count (the "· 2 gifts" beside a sum). */
export function countSent(records: readonly GiftSumRow[]): number {
  let n = 0;
  for (const r of records) if (counts(r)) n += 1;
  return n;
}

/** One wish's running figures. */
export type WishSent = { sentPhp: number; gifts: number };

/** The key `sentByWish` files a gift toward no wish under. */
export const ANY_GIFT = '';

/**
 * Every wish's sum in one pass over an event's records, keyed by
 * `wish_item_id` — and `ANY_GIFT` for the gifts toward no wish.
 */
export function sentByWish(records: readonly GiftSumRow[]): Map<string, WishSent> {
  const out = new Map<string, WishSent>();
  for (const r of records) {
    if (!counts(r)) continue;
    const key = r.wish_item_id ?? ANY_GIFT;
    const at = out.get(key) ?? { sentPhp: 0, gifts: 0 };
    at.sentPhp += r.amount_php;
    at.gifts += 1;
    out.set(key, at);
  }
  return out;
}

/**
 * Has what was sent reached the price? ("when amount is reached.")
 *
 * A wish with NO price never reaches — it takes any amount and is only ever
 * marked by the couple's own switch.
 */
export function reachedPrice(pricePhp: number | null | undefined, sentPhp: number): boolean {
  if (typeof pricePhp !== 'number' || !Number.isFinite(pricePhp) || pricePhp <= 0) return false;
  return Number.isFinite(sentPhp) && sentPhp >= pricePhp;
}

/** What is still to send before a priced wish reaches its price; null when there is no price. */
export function leftToReach(pricePhp: number | null | undefined, sentPhp: number): number | null {
  if (typeof pricePhp !== 'number' || !Number.isFinite(pricePhp) || pricePhp <= 0) return null;
  return Math.max(0, pricePhp - (Number.isFinite(sentPhp) ? sentPhp : 0));
}

/** The meter's fill, 0–100. A wish with no price has no meter (null). */
export function meterPercent(pricePhp: number | null | undefined, sentPhp: number): number | null {
  if (typeof pricePhp !== 'number' || !Number.isFinite(pricePhp) || pricePhp <= 0) return null;
  const sent = Number.isFinite(sentPhp) && sentPhp > 0 ? sentPhp : 0;
  return Math.min(100, Math.round((sent / pricePhp) * 100));
}

/**
 * THE AUTOMATIC HALF OF "GOT IT" — what a wish's got state becomes after its
 * gifts changed (a record added, corrected, moved or removed). Written by the
 * ACTION that changed the records, never by a trigger.
 *
 *   · reached, and open            → marked 'auto';
 *   · fell back below, and 'auto'  → cleared;
 *   · 'host' (the couple's switch) → never touched by a sum;
 *   · no price                     → never touched.
 *
 * Returns `null` when nothing is to be written.
 */
export function gotAfterGifts(
  wish: Pick<WishItemRow, 'price_php' | 'got_by'>,
  sentPhp: number,
): { got_by: WishGotBy | null } | null {
  if (wish.got_by === 'host') return null;
  const reached = reachedPrice(wish.price_php, sentPhp);
  if (reached && wish.got_by == null) return { got_by: 'auto' };
  if (!reached && wish.got_by === 'auto') return { got_by: null };
  return null;
}

/** Is this wish got (by the gifts or by the couple)? */
export function wishIsGot(wish: Pick<WishItemRow, 'got_at'>): boolean {
  return wish.got_at != null;
}

/**
 * The list's order: the couple's own order, with got wishes sunk to the end
 * ("Got wishes sink to the end"). Stable — never reorders two open wishes.
 */
export function wishesInOrder<T extends Pick<WishItemRow, 'sort_order' | 'got_at' | 'created_at'>>(
  wishes: readonly T[],
): T[] {
  return [...wishes].sort((a, b) => {
    const ag = a.got_at != null ? 1 : 0;
    const bg = b.got_at != null ? 1 : 0;
    if (ag !== bg) return ag - bg;
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    return a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0;
  });
}

/* Pesos are PRINTED by `formatPhp` (lib/php.ts) — the one money formatter; this
   module adds up and compares, it never spells a figure. */
