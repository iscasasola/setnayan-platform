/**
 * apps/web/lib/website-pro-items.ts
 *
 * THE EIGHT PRO ITEMS — one list, named the way the couple sees them.
 *
 * 🔄 SEVEN → EIGHT, 2026-09-11. Owner (Q3 = A, DECISION_LOG "the seven
 * invite-theme questions"): *"the invite theme becomes the eighth Event Hub Pro
 * item. Price and SKU unchanged."* It is not a new unlock and not a new SKU —
 * `COUPLE_WEBSITE_PRO` already gates the four Pro invite themes
 * (`app/[slug]/invite/_lib/load-invite-look.ts`), and this list is what the
 * couple is SHOWN. Until today the umbrella withheld something it did not name.
 *
 * These names shipped inside `app/dashboard/[eventId]/website/editor/
 * _components/pro-panels.tsx`, which is a `'use client'` component file. The
 * Event Hub controller needs the SAME eight names on the server, and a resolver
 * that imported them from a client component would drag `next/link` and
 * `lucide-react` into a pure module and into every test that touches it.
 *
 * 🔑 SO THE LIST MOVED HERE AND `pro-panels.tsx` NOW IMPORTS IT — it is not
 * copied. Two lists of the same eight strings is precisely the failure this repo
 * has paid for most often: two mechanisms that disagree about one fact, each
 * passing its own suite. `WEBSITE_PRO_ITEMS` is still exported from
 * `pro-panels.tsx` under its old name so nothing that already imports it moves.
 *
 * ⛔ NO PRICE LIVES HERE. `COUPLE_WEBSITE_PRO` (titled "Event Hub Pro") is the
 * ONE unlock that opens all eight, and its figure is read live from
 * `platform_retail_catalog_v2` via `formatV2Sku` — never typed into source. The
 * `couple-website-pro.ts` docblock records why: three different figures for one
 * product once lived in a single file.
 */

/** The eight Pro items, named the way the couple sees them. */
export const WEBSITE_PRO_ITEMS = [
  'Cinematic Reveal',
  'Save-the-Date video',
  'Photo gallery',
  'Background music',
  'Editorial editing',
  'Background color',
  'Button color',
  // The invite link's theme (owner Q3 = A, 2026-09-11). Spelt to sit beside its
  // siblings; the couple meets it as "How your invite looks" on
  // Guests → Invite link, which is the only place it is set.
  'Invite link theme',
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
 * the eight the unlock covers — but it may never be the reason a couple is asked
 * for money. The free ruling is reversible and the owner's to reverse; until he
 * does, this constant is what keeps the offer honest.
 */
export const NOT_SOLD_ON: readonly WebsiteProItem[] = ['Editorial editing'];
