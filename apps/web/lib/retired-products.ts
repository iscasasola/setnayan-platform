/**
 * retired-products.ts — THE ONE LIST OF COUPLE PRODUCTS WE NO LONGER SELL.
 *
 * Owner, 2026-11-20, verbatim: *"Retire Patiktok and Music Maker ( we do not
 * want to serve this anymore)"*. Measured that day: zero purchases of either
 * (event_software_activations_v2, onboarding_order_items, shop_gift_purchases
 * all empty for both codes), so nobody loses anything.
 *
 * What "retired" means here:
 *   · the catalog row is `is_active = false` with a `retired_at` stamp
 *     (migration `retire_patiktok_and_music_maker`), so every catalog-driven
 *     list and checkout already refuses it;
 *   · every hand-written door (cards, menus, feature pages, public pages,
 *     llms.txt, help, JSON-LD) asks THIS module and drops it;
 *   · the engine, its routes and its tables STAY — an event that owns one
 *     (or a plan that grants one, see below) keeps working.
 *
 * Event Ultra no longer LISTS Patiktok (owner 2026-11-20, *"Keep ₱9,990"*: Ultra
 * loses it and keeps its price). ⚠ Its read-side GRANT still stands —
 * `EVENT_ULTRA_GRANTS` (lib/event-ultra.ts) plus the two gifted-Ultra SQL
 * functions that mirror it — so an Ultra event can still open the Patiktok
 * page. Prod had zero Ultra orders on 2026-11-20. Removing the grant is a
 * follow-up (app list + SQL mirror + the db test that holds them equal).
 *
 * Guarded by `lib/retired-products-stay-retired.test.ts`.
 */

/** Catalog service codes (`platform_retail_catalog_v2.service_code`). */
export const RETIRED_PRODUCT_CODES: ReadonlySet<string> = new Set(['PATIKTOK_COMPILER', 'PAKANTA']);

/** Add-on catalogue keys (`ADD_ONS[].key`) and store/menu keys. */
export const RETIRED_ADD_ON_KEYS: ReadonlySet<string> = new Set(['patiktok', 'pakanta']);

/** `/features/<slug>` slugs. */
export const RETIRED_FEATURE_SLUGS: ReadonlySet<string> = new Set(['patiktok', 'music-maker']);

/** Public marketing pages that now redirect (to `/features`). */
export const RETIRED_PUBLIC_PATHS: readonly string[] = ['/patiktok', '/pakanta'];

/** The names a person used to read. */
export const RETIRED_PRODUCT_NAMES: readonly string[] = ['Patiktok', 'Music Maker'];

/** One plain sentence for any surface an old link still reaches. */
export const RETIRED_PRODUCT_LINE = 'We no longer offer this.';

export function isRetiredProductCode(code: string | null | undefined): boolean {
  return code != null && RETIRED_PRODUCT_CODES.has(code);
}

export function isRetiredAddOn(entry: { key: string; serviceKey?: string | null }): boolean {
  return RETIRED_ADD_ON_KEYS.has(entry.key) || isRetiredProductCode(entry.serviceKey);
}
