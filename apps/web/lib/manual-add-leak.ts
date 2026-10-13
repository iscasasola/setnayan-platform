/**
 * manual-add-leak.ts — IS A HAND-TYPED RECORD REALLY A SHOP THIS COUPLE
 * ALREADY GOT A QUOTE FROM ON SETNAYAN?
 *
 * The fee-leak check of "Add your own" (check document 2026-10-07, "The
 * handshake protects the booking fee", item 2; build plan PR2; drawn in
 * `prototypes/suppliers_add_your_own_2026-10-10.html` cases A and D): a name, or
 * a price within the owner's tolerance (2026-10-10: "10% allowance +-. so if
 * 100,000 that is between 90-110k"), that matches a quote THIS event already
 * received IN THE SAME CATEGORY stamps the record with that shop
 * (`event_manual_vendors.leak_match_vendor_profile_id`). The stamp alone bills
 * nobody — fee rule B (`booking_fee_attribution_for`) decides, and only a shop
 * that is linked to the booking can ever be charged.
 *
 * Owner, 2026-10-12: a name match the couple dismissed with "Not them?" does NOT
 * count — `nameDismissed` turns the name half off. The price half stands (the
 * couple dismissed a NAME, not a quote).
 * Owner, 2026-10-12: couples are NOT told about the booking fee — nothing in
 * this file produces a sentence; the stamp is never shown to the couple.
 *
 * PURE: the server action decides with it, the walk draws its card with
 * `nameMatchesShop`, the test executes both.
 */
import { priceWithinTolerance } from './booking-fee-gate';

/** A shop on this event, in the record's category, with the quote it sent (₱; null = none yet). */
export type QuotedShop = { vendorProfileId: string; name: string; quotePhp: number | null };

/** Lower-case letters and digits, single spaces — the prototype's `norm`. */
export function normShopName(t: string | null | undefined): string {
  return String(t ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Names shorter than this never match — "Lo" is not Kusina ni Lola. */
export const LEAK_NAME_MIN = 3;

/**
 * Does what the couple typed name this shop? Either contains the other, after
 * `normShopName` ("lola" ⊂ "kusina ni lola"; "kusina ni lola catering" ⊃ it).
 */
export function nameMatchesShop(typed: string, shopName: string): boolean {
  const n = normShopName(typed);
  const h = normShopName(shopName);
  if (n.length < LEAK_NAME_MIN || h.length < LEAK_NAME_MIN) return false;
  return h.includes(n) || n.includes(h);
}

export type LeakInput = {
  typedName: string;
  /** The price the couple recorded, ₱ (null = none — the first walk asks no price). */
  typedPricePhp: number | null;
  /** The couple pressed "Not them?" on the name step. */
  nameDismissed: boolean;
  /** Only shops in THIS record's category, on THIS event. */
  shops: ReadonlyArray<QuotedShop>;
  /** `platform_settings.fee_leak_price_tolerance` (a fraction). */
  tolerance: number;
};

/**
 * The shop the record matches, or null. Only a shop that has QUOTED counts —
 * the leak is a quote taken off Setnayan. The name half first (it is the
 * couple's own word for who they mean), then the price half; among several
 * price matches, the closest quote.
 */
export function pickLeakMatch(i: LeakInput): string | null {
  const quoted = i.shops.filter((s) => s.quotePhp != null && s.quotePhp > 0);
  if (quoted.length === 0) return null;
  if (!i.nameDismissed) {
    const byName = quoted.find((s) => nameMatchesShop(i.typedName, s.name));
    if (byName) return byName.vendorProfileId;
  }
  const byPrice = quoted
    .filter((s) => priceWithinTolerance(i.typedPricePhp, s.quotePhp, i.tolerance))
    .sort((a, b) => Math.abs((a.quotePhp ?? 0) - (i.typedPricePhp ?? 0)) - Math.abs((b.quotePhp ?? 0) - (i.typedPricePhp ?? 0)));
  return byPrice[0]?.vendorProfileId ?? null;
}
