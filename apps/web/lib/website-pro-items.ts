/**
 * apps/web/lib/website-pro-items.ts
 *
 * THE PRO ITEMS — one list, named the way the couple sees them. Nine since
 * 2026-09-28 (below); count the array, never this sentence.
 *
 * 🔄 TEN → NINE, 2026-09-28 — THE FREE-VS-PRO REDRAW. Owner, verbatim: *"free
 * to change design, change text, size, color, background color, only when you
 * start adding themes will it be pro. adding media for background."* So
 * "Background color" and "Button color" left the list (both are free for every
 * couple now — `HUB_FREE_LOOK_EVENT_COLUMNS` in `lib/hub-look-pro.ts`), and the
 * thing he named instead joined it: "Photo and video backgrounds" — media behind
 * a scene or behind the whole page, which the Maker has gated since 2026-09-24.
 *
 * 🔄 EIGHT → NINE, 2026-09-24. Owner ("A then", DECISION_LOG "Event Hub Pro
 * includes the logo animation"): `COUPLE_WEBSITE_PRO` now also confers
 * `ANIMATED_MONOGRAM` (SKU_OWNERSHIP_ALIASES in lib/entitlements.ts). The ₱500
 * standalone stays on sale; this list names the inclusion so the Pro offer
 * says what it buys.
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
 * Event Hub controller needs the SAME names on the server, and a resolver
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
 * ONE unlock that opens all nine, and its figure is read live from
 * `platform_retail_catalog_v2` via `formatV2Sku` — never typed into source. The
 * `couple-website-pro.ts` docblock records why: three different figures for one
 * product once lived in a single file.
 */
import { PRO_THEMES } from '@/lib/invite-themes';

/**
 * 🎨 THE PRO THEMES, COUNTED — never typed. Owner 2026-09-29, *"Okay use modern
 * and cyber FREE"*: Modern and Cyber Neon joined Classic as free themes, and
 * this item — which said "9" as a typed digit — would have gone on selling two
 * themes every couple already has. The number is the registry's count of
 * shipped Pro themes (`PRO_THEMES` in `lib/invite-themes.ts`), so a tier flip
 * rewrites the sentence instead of leaving it to rot.
 */
export const PRO_THEMES_ITEM = `${PRO_THEMES.length} Event Hub themes, invite link included` as const;

/** The nine Pro items, named the way the couple sees them. */
export const WEBSITE_PRO_ITEMS = [
  'Cinematic Reveal',
  'Save-the-Date video',
  'Photo gallery',
  'Background music',
  'Editorial editing',
  // Media behind a scene or behind the whole page (owner 2026-09-28: "adding
  // media for background"). The COLOURS that stood here are free now.
  'Photo and video backgrounds',
  // The Pro themes (owner 2026-09-24/25: "themes are part of pro except
  // classic"; 2026-09-29: except Classic, Modern and Cyber Neon). Still names
  // the invite link, because the theme dresses the invite door too — and the
  // number is COMPUTED from the registry (`PRO_THEMES_ITEM` above), held by
  // `says-what-it-includes.test.ts` and `free-themes-are-free.test.ts`.
  PRO_THEMES_ITEM,
  // The logo animation (owner 2026-09-24, "A then"). Granted by the
  // ANIMATED_MONOGRAM ← COUPLE_WEBSITE_PRO alias; the couple meets it on the
  // Logo Maker, where the owned state reads "Included with Event Hub Pro".
  'Animated logo',
  // The Pro QR (owner 2026-09-27: "QR on Pro makes the logo use their logo on
  // the center. and change the shape, pattern style"). Free codes carry the
  // Setnayan mark; Pro puts the couple's own logo in the centre and opens Shape
  // (square · circle) · Pattern · Colour on the Maker's Details page. The old
  // "Custom QR per guest" product folded into this item (lib/qr-look.ts).
  'Your logo on every QR code',
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
 * the nine the unlock covers — but it may never be the reason a couple is asked
 * for money. The free ruling is reversible and the owner's to reverse; until he
 * does, this constant is what keeps the offer honest.
 */
export const NOT_SOLD_ON: readonly WebsiteProItem[] = ['Editorial editing'];
