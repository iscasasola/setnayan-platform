/**
 * 🛒 THE GIFT STORE'S CART — PURE (no I/O), so the store, the buy action and the tests all use ONE rule.
 *
 * ⚖ OWNER-APPROVED PROTOTYPE `gifts-interactive` v16 (2026-11-17, "build it"):
 *   • the store lists every gift once as a single (− n +) and once as a "10 + 1" bundle (− n +);
 *   • any mix of singles and bundles is ONE order, paid once;
 *   • the cart bar reads "N tickets (M free) · save ₱X", the total, then "Buy now · ₱total";
 *   • a single stops at 9 — "9 is the most here. Want 10? Take the 10 + 1 bundle below and get 1 free.";
 *   • − is not pressable at 0; + (and a ticket's Add) is not pressable when it would take the ORDER past the most in one
 *     payment (owner 17 Nov: "We do not allow transactions above 100,000." — `lib/max-payment.ts`, an admin setting).
 *
 * 💰 NO PRICE IS TYPED HERE. Every centavo is the catalogue's: a single at its pack's list price (`srpCentavos`, from
 * `platform_retail_catalog_v2.retail_price_php`), a bundle at its own catalogue price (`priceCentavos`). "Free" and
 * "save" are WORKED OUT from those two (`bundleFreePacks`), never stated.
 */

import { bundleFreePacks, isShopGiftBundleCode, type ShopGiftBundle, type ShopGiftPack } from './shop-gifts';
import { maxPaymentCentavos } from './max-payment';

/**
 * The most of ONE item the store takes in one order (prototype v16: the stepper runs 0 … 9, for singles and bundles
 * alike; at 9 the single says "9 is the most here" and points at the bundle). Not money — a count the owner drew.
 */
export const SHOP_GIFT_STORE_MOST_EACH = 9;

/** How many different items one order may carry (6 gifts × single + bundle = 12 rows in the store today). */
export const SHOP_GIFT_STORE_MAX_LINES = 24;

/** The cart: how many of each item, by catalogue code (a single's pack code or a bundle's `GIFT_BUNDLE_*` code). */
export type GiftCart = Readonly<Record<string, number>>;

/** One priced line of the cart, as the store and the buy action both see it. Money in whole centavos. */
export type GiftCartLine = {
  code: string;
  /** The gift that lands in stock (a bundle's pack, or the single itself). */
  pack: ShopGiftPack;
  bundle: ShopGiftBundle | null;
  qty: number;
  /** One unit: the pack's list price, or the bundle's own price. */
  unitCentavos: number;
  lineCentavos: number;
  /** Packs this line lands (a bundle lands its whole count per unit). */
  tickets: number;
  /** Of `tickets`, how many are free (a bundle's free packs × qty). */
  free: number;
  /** What the bundle saves against buying its packs one at a time at list price. 0 for a single. */
  saveCentavos: number;
};

export type GiftCartSummary = {
  lines: GiftCartLine[];
  tickets: number;
  free: number;
  saveCentavos: number;
  totalCentavos: number;
};

/** Every item the store sells, in the store's order: singles (Papic, then Event), then the 10 + 1 bundles. */
export type GiftStoreItem = { code: string; pack: ShopGiftPack; bundle: ShopGiftBundle | null; unitCentavos: number };

export function storeItems(packs: readonly ShopGiftPack[], bundles: readonly ShopGiftBundle[]): GiftStoreItem[] {
  return [
    ...packs.map((p) => ({ code: p.code, pack: p, bundle: null, unitCentavos: p.srpCentavos })),
    ...bundles.map((b) => ({ code: b.code, pack: b.pack, bundle: b, unitCentavos: b.priceCentavos })),
  ];
}

function lineOf(item: GiftStoreItem, qty: number): GiftCartLine {
  const b = item.bundle;
  const free = b ? bundleFreePacks(b) * qty : 0;
  const save = b ? Math.max(0, b.quantity * b.pack.srpCentavos - b.priceCentavos) * qty : 0;
  return {
    code: item.code,
    pack: item.pack,
    bundle: b,
    qty,
    unitCentavos: item.unitCentavos,
    lineCentavos: item.unitCentavos * qty,
    tickets: (b ? b.quantity : 1) * qty,
    free,
    saveCentavos: save,
  };
}

/** The cart, priced: lines in the store's order (unknown codes and zero counts dropped), and its totals. */
export function summarizeCart(
  cart: GiftCart,
  packs: readonly ShopGiftPack[],
  bundles: readonly ShopGiftBundle[],
): GiftCartSummary {
  const lines: GiftCartLine[] = [];
  for (const item of storeItems(packs, bundles)) {
    const qty = Math.trunc(Number(cart[item.code] ?? 0));
    if (qty > 0) lines.push(lineOf(item, qty));
  }
  return {
    lines,
    tickets: lines.reduce((s, l) => s + l.tickets, 0),
    free: lines.reduce((s, l) => s + l.free, 0),
    saveCentavos: lines.reduce((s, l) => s + l.saveCentavos, 0),
    totalCentavos: lines.reduce((s, l) => s + l.lineCentavos, 0),
  };
}

/** Why one more of an item cannot go in (or 'ok'). */
export type AddVerdict = 'ok' | 'most_each' | 'over_max' | 'not_on_sale';

/**
 * Can `by` more of `code` go in? Not past 9 of one item, and not when the ORDER's total would pass the most in one
 * payment (`maxPhp`, the admin setting). Equal to the most is allowed — the ruling refuses "above".
 */
export function canAdd(
  cart: GiftCart,
  code: string,
  packs: readonly ShopGiftPack[],
  bundles: readonly ShopGiftBundle[],
  maxPhp: number,
  by = 1,
): AddVerdict {
  const item = storeItems(packs, bundles).find((i) => i.code === code);
  if (!item) return 'not_on_sale';
  const have = Math.max(0, Math.trunc(Number(cart[code] ?? 0)));
  if (have + by > SHOP_GIFT_STORE_MOST_EACH) return 'most_each';
  const total = summarizeCart(cart, packs, bundles).totalCentavos + item.unitCentavos * by;
  return total > maxPaymentCentavos(maxPhp) ? 'over_max' : 'ok';
}

/** The cart with one more / one less of `code` (never below 0, never past the caps — the caller asks `canAdd` first). */
export function bump(cart: GiftCart, code: string, by: number): GiftCart {
  const next = Math.max(0, Math.min(SHOP_GIFT_STORE_MOST_EACH, Math.trunc(Number(cart[code] ?? 0)) + by));
  const out: Record<string, number> = { ...cart };
  if (next === 0) delete out[code];
  else out[code] = next;
  return out;
}

// ── the form ↔ the server ───────────────────────────────────────────────────

/** The cart as the form posts it: `CODE:qty` items joined by commas — codes and counts only, NEVER a price. */
export function encodeCart(cart: GiftCart): string {
  return Object.entries(cart)
    .filter(([, n]) => Number.isInteger(n) && n > 0)
    .map(([c, n]) => `${c}:${n}`)
    .join(',');
}

const CODE_SHAPE = /^[A-Z0-9_]{2,64}$/;

/**
 * Parse what the form posted. Null when it is not a well-formed cart: empty, too many items, a code twice, a code of the
 * wrong shape, or a count that is not a whole number from 1 to 9. The server trusts nothing else from the browser.
 */
export function parseCart(raw: unknown): Array<{ code: string; qty: number }> | null {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 2000) return null;
  const out: Array<{ code: string; qty: number }> = [];
  const seen = new Set<string>();
  for (const part of raw.split(',')) {
    const m = /^([A-Z0-9_]+):(\d{1,3})$/.exec(part.trim());
    if (!m) return null;
    const code = m[1]!;
    const qty = Number(m[2]);
    if (!CODE_SHAPE.test(code) || seen.has(code)) return null;
    if (!Number.isInteger(qty) || qty < 1 || qty > SHOP_GIFT_STORE_MOST_EACH) return null;
    seen.add(code);
    out.push({ code, qty });
  }
  if (out.length === 0 || out.length > SHOP_GIFT_STORE_MAX_LINES) return null;
  return out;
}

export type PricedCart =
  | { ok: true; summary: GiftCartSummary }
  | { ok: false; reason: 'malformed' | 'not_on_sale' | 'over_max' };

/**
 * 🔒 THE SERVER'S PRICE OF A POSTED CART — the buy action runs this against the catalogue it READ itself. Every code
 * must be on sale now (a single pack, or a bundle whose gift is on sale), and the order must stay within the most in one
 * payment. The browser names items and counts; this decides what they cost.
 */
export function priceCart(
  raw: unknown,
  packs: readonly ShopGiftPack[],
  bundles: readonly ShopGiftBundle[],
  maxPhp: number,
): PricedCart {
  const asked = parseCart(raw);
  if (!asked) return { ok: false, reason: 'malformed' };
  const codes = new Set(storeItems(packs, bundles).map((i) => i.code));
  const cart: Record<string, number> = {};
  for (const a of asked) {
    if (!codes.has(a.code)) return { ok: false, reason: 'not_on_sale' };
    if (isShopGiftBundleCode(a.code) !== bundles.some((b) => b.code === a.code)) return { ok: false, reason: 'not_on_sale' };
    cart[a.code] = a.qty;
  }
  const summary = summarizeCart(cart, packs, bundles);
  if (summary.lines.length !== asked.length || summary.totalCentavos <= 0) return { ok: false, reason: 'not_on_sale' };
  if (summary.totalCentavos > maxPaymentCentavos(maxPhp)) return { ok: false, reason: 'over_max' };
  return { ok: true, summary };
}
