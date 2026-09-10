/**
 * service-card-address.ts — where a marketplace service card sends a couple.
 *
 * ── TWO DESTINATIONS, ONE CARD (owner, 2026-09-09) ─────────────────────────
 * The card BODY opens that service's details; the shop LOGO opens the shop.
 * He picked that over one-destination and over logo-only.
 *
 * ── WHY BOTH ADDRESSES ARE BARE-ROOT `/{slug}` ─────────────────────────────
 * The supplier's own dashboard shows them `/{slug}` and calls it, verbatim,
 * *"your address for good"*. The marketplace card was sending couples to
 * `/v/{slug}` — the LEGACY form. Both resolve, and the shop page canonicalises
 * to the bare root, so nothing was broken; but the one link a shop is shown and
 * the one a couple is given were different strings, and only one of them is the
 * address we promised. The vendor sitemap already emits the bare root (its own
 * docblock had gone stale saying otherwise), so this makes three surfaces agree.
 *
 * ⛔ `/v/{slug}` IS NOT RETIRED AND MUST KEEP RESOLVING. Printed QR codes,
 * bookmarks, and every `/v/` link already handed out have to survive. This
 * module decides what we MINT from here on; it removes nothing.
 *
 * ── WHY `?service=` AND NOT A ROUTE OF ITS OWN ─────────────────────────────
 * The per-service details screen already ships, and it is already linkable:
 * `renderVendorBySlug` reads `?service=<public id>` and opens that card's sheet
 * on arrival. So the details address is a QUERY on the shop page, not a new
 * page — RULE 0, nothing new was drawn.
 *
 * 🔑 IT DEGRADES, IT NEVER DEAD-ENDS. The sheet is behind
 * `NEXT_PUBLIC_SERVICE_DETAILS_ENABLED`, which is off. With the flag off the
 * parameter is read and ignored, so the link lands on the shop page — exactly
 * where the card already sent people. The day the owner flips the flag the same
 * link opens the service. Nothing here turns a dark feature on.
 *
 * Pure: no React, no I/O, no environment. Both halves are unit-tested.
 */

/** The minimum a caller must know to address a card. */
export type AddressableServiceCard = {
  businessSlug: string | null;
  row: { public_id?: string | null };
};

/**
 * The shop's public address — the one its owner was promised.
 *
 * null when the shop has no slug. A caller must render the row UNLINKED rather
 * than substituting `#` or `/explore`: a control that goes somewhere unrelated
 * is worse than no control.
 */
export function shopAddress(businessSlug: string | null | undefined): string | null {
  const slug = businessSlug?.trim();
  return slug ? `/${slug}` : null;
}

/**
 * This card's details address.
 *
 * Falls back to the plain shop address when the card carries no public id — the
 * card still belongs to a shop, and the shop page lists it. Returns null only
 * when there is no shop address at all.
 *
 * ⚠ The public id is NOT taken from the rendered `ServiceCard`. That view model
 * omits `publicId` entirely while the details flag is off (a deliberate
 * byte-identical-payload contract pinned by `service-details-dark.test.ts`), so
 * reading it from there would silently produce a shop-only link today and a
 * service link later. It is read from the DATABASE ROW, which always carries it.
 */
export function serviceCardAddress(card: AddressableServiceCard): string | null {
  const shop = shopAddress(card.businessSlug);
  if (!shop) return null;
  const publicId = card.row.public_id?.trim();
  if (!publicId) return shop;
  return `${shop}?service=${encodeURIComponent(publicId)}`;
}
