/**
 * THE EVENT HUB PRO UNLOCK LABEL — one pure helper, and deliberately NOT in a
 * client file (see `rail-rows.ts` for why a `'use client'` module is a boundary a
 * server page may not call across). Both the server page and the three client
 * panels may import it.
 *
 * ⛔ NO PRICE IS TYPED HERE, OR IN ANY FILE UNDER `website/editor`. The editor
 * used to paint a hard-coded figure on three unlock buttons while the catalogue
 * row — `platform_retail_catalog_v2`, admin-managed, the ONLY price a customer is
 * charged — said something else (repriced by the owner 2026-09-23). The server
 * page now reads the row once with `formatV2Sku('COUPLE_WEBSITE_PRO')` and hands
 * the formatted string down.
 *
 * 🔑 NULL MEANS "THE CATALOGUE DID NOT ANSWER", and the button then carries no
 * figure at all. Never a remembered number and never ₱0 — either would look
 * exactly like a real answer. The buy surface it links to states the live price.
 *
 * Held by `unlock-label.test.ts`.
 */

export const UNLOCK_EVENT_HUB_PRO = 'Unlock Event Hub PRO';

/** The unlock CTA's words: with the live catalogue price, or with none. */
export function unlockLabel(priceLabel: string | null): string {
  const price = priceLabel?.trim();
  return price ? `${UNLOCK_EVENT_HUB_PRO} · ${price}` : UNLOCK_EVENT_HUB_PRO;
}

/**
 * The formatted catalogue price, or null when there is no trustworthy figure.
 *
 * Takes the formatter as an argument so this file stays free of server-only
 * imports. A missing row, a non-number, or a non-positive amount all yield null:
 * a ₱0 unlock button is a wrong answer that looks right.
 */
export function proPriceLabelFrom(
  pricePhp: number | string | null | undefined,
  format: (php: number) => string,
): string | null {
  if (pricePhp === null || pricePhp === undefined) return null;
  const n = typeof pricePhp === 'number' ? pricePhp : Number(pricePhp);
  if (!Number.isFinite(n) || n <= 0) return null;
  return format(n);
}
