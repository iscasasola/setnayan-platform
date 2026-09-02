/**
 * apps/web/lib/website-pro-items.ts
 *
 * THE SEVEN PRO ITEMS — one list, named the way the couple sees them.
 *
 * These names shipped inside `app/dashboard/[eventId]/website/editor/
 * _components/pro-panels.tsx`, which is a `'use client'` component file. The
 * Event Hub controller needs the SAME seven names on the server, and a resolver
 * that imported them from a client component would drag `next/link` and
 * `lucide-react` into a pure module and into every test that touches it.
 *
 * 🔑 SO THE LIST MOVED HERE AND `pro-panels.tsx` NOW IMPORTS IT — it is not
 * copied. Two lists of the same seven strings is precisely the failure this repo
 * has paid for most often: two mechanisms that disagree about one fact, each
 * passing its own suite. `WEBSITE_PRO_ITEMS` is still exported from
 * `pro-panels.tsx` under its old name so nothing that already imports it moves.
 *
 * ⛔ NO PRICE LIVES HERE. `COUPLE_WEBSITE_PRO` (titled "Event Hub Pro") is the
 * ONE unlock that opens all seven, and its figure is read live from
 * `platform_retail_catalog_v2` via `formatV2Sku` — never typed into source. The
 * `couple-website-pro.ts` docblock records why: three different figures for one
 * product once lived in a single file.
 */

/** The seven Pro items, named the way the couple sees them. */
export const WEBSITE_PRO_ITEMS = [
  'Cinematic Reveal',
  'Save-the-Date video',
  'Photo gallery',
  'Background music',
  'Editorial editing',
  'Background color',
  'Button color',
] as const;

export type WebsiteProItem = (typeof WEBSITE_PRO_ITEMS)[number];

/**
 * ⛔ THE ONE ITEM THE UMBRELLA MAY NOT BE SOLD ON.
 *
 * `EDITORIAL_PRO` joined `FREE_FOR_ALL_SKUS` on 2026-08-23 — `eventSkuActive`
 * short-circuits before any order lookup, so EVERY couple already has editorial
 * editing. `lib/couple-website-pro.ts` states the constraint in its own words:
 * *"Event Hub PRO may NOT be SOLD on this inclusion while it is free."*
 *
 * It stays in the list — the controller SHOWS it, because it is genuinely one of
 * the seven the unlock covers — but it may never be the reason a couple is asked
 * for money. The free ruling is reversible and the owner's to reverse; until he
 * does, this constant is what keeps the offer honest.
 */
export const NOT_SOLD_ON: readonly WebsiteProItem[] = ['Editorial editing'];
