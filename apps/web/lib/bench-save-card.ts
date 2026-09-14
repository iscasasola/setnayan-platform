/**
 * bench-save-card — which of a shop's service cards a bench save is FOR.
 * Owner's test round 1, 2026-09-11.
 *
 * A couple saving from a bench row ("More in Live Band") is saving the shop's
 * LIVE BAND card, not the shop in general. The save used to record only the
 * shop: `event_vendors.service_id` stayed NULL and the category came from the
 * shop's FIRST listed service. A two-service shop saved from its second tile was
 * filed under its first, the inquiry anchored on an arbitrary card, and the
 * saved card lost that card's cover, price and inclusions.
 *
 * PURE. The caller hands in the shop's ACTIVE cards, the tile id and the tile's
 * canonical services; this picks one, deterministically — earliest created,
 * then by id — because two cards made in the same statement share a timestamp
 * and an unordered read returns them in any order.
 *
 * ⚠ A card may store the TILE ID, not a canonical (`host_mc`, whose canonicals
 * are `host_emcee` · `tea_ceremony_master`). The tile id is matched too, the
 * same widening `canonicalsForScope` in the bench search makes — ask only the
 * canonicals and a Host / MC save finds no card. (Found writing this module's
 * test: Saysay's own Host / MC card stores `host_mc`.)
 */

export type ShopCard = {
  vendor_service_id: string;
  category: string | null;
  created_at: string | null;
};

export function cardForTile(
  cards: readonly ShopCard[],
  tile: string,
  tileCanonicals: readonly string[],
): ShopCard | null {
  const wanted = new Set([...tileCanonicals, tile]);
  const matches = cards.filter((c) => c.category != null && wanted.has(c.category));
  if (matches.length === 0) return null;
  return [...matches].sort((a, b) => {
    const at = a.created_at ?? '';
    const bt = b.created_at ?? '';
    if (at !== bt) return at < bt ? -1 : 1;
    return a.vendor_service_id < b.vendor_service_id ? -1 : a.vendor_service_id > b.vendor_service_id ? 1 : 0;
  })[0]!;
}
