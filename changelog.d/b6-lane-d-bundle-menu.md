## 2026-11-10 · feat(shop): the Bundle Maker prices itself, and bundle cards wear the service card row (Build 6 · Lane D)

The approved prototypes (specs `prototypes/shop_discounts_bundle_card_open_2026-11-09/` — Bundle Maker v3, Shop Services
Menu v2, Makers as One) built as fixes to the shipped screens, never new ones:

- **Bundle Maker** (`packages/_components/package-editor.tsx`, fixed in place): rises full screen (`RiseScreen`, the
  bars step away, ✕ = Cancel); a **pinned New total** that follows every change and slims to one line while typing;
  each card **at its lowest** (card price − its best discount that reaches every couple); "What the couple gets"
  gathered from the cards, merged and labelled; Total · **Extra bundle discount (pesos only, above ₱0, below the
  total)** · New total; the bundle's **own payment plan** (a copy of the one default, adjustable, adding up to the new
  total, the last payment the automatic balance); **no gift field** (gifts live only in offers); thumb row **Save to my
  shop | Send to this couple** at equal widths. Enter saves.
- **Server-priced:** `savePackage` re-reads the shop's cards, prices and discounts honestly (`lib/bundle-cards.server.ts`
  — a refused read refuses the save) and writes only the total IT computed (`lib/bundle-sums.ts`, the same functions
  the maker runs). A booked bundle keeps its stored price.
- **🔒 The shared lock is wired:** `LOCKS.bundleMaker.server` = `packages/actions.ts`, which asks `canUse('bundleMaker')`;
  the maker page and Shop › Bundles show the shared explainer (Problem → Solution → sample → papers → Get verified).
- **Shop menu:** the list reads **Your bundles and services** (head + section label); each bundle is a **bundle card**
  (the card face Find draws) with the service card row — ✏ Edit · ↗ Share (drawn waiting, as on the service card) ·
  Online/Offline; swipe left deletes after the warning, with Undo; Offline and Delete refused while a booking is open
  (server too: `setPackageActive`, `deletePackage`, whose unread count no longer reads as zero).
- **One default plan:** `DEFAULT_QUOTE_PLAN` (lib/proposal-payment-schedule.ts) — the quote maker's shipped default,
  moved, now read by both makers. `sanitizeScheduleDrafts` split out of `sanitizeAndResolveSchedule` (same coercion).
- Migration `20271336630678_a_bundle_prices_itself_and_carries_its_plan` — `vendor_packages.extra_discount_centavos`
  (≥ 0) + `payment_schedule_json` (drafts, shape-checked). RLS inherited; prod had 0 bundles.
- Guards: `lib/bundle-sums.test.ts` · `packages/the-bundle-maker-is-the-prototype.test.ts` (replaces
  `the-bundle-maker-keeps-its-gift-and-swipe`, whose gift parts the 9 Nov ruling reversed) ·
  `shop/bundle-cards-wear-the-card-row.test.ts` · the lock guard's to-wire list shrinks by `bundleMaker`.

- **2026-11-11 · the row is the shipped one:** each bundle card now renders **`ServiceCardMenuRow` itself** (#7464's
  Edit · Share · Online/Offline), imported — the hand-made twin is gone. The row gained two optional props for a card
  with no door of its own: `onToggle`/`toggling` (the bundle's `bundleCardRow`; a refused Go online names every missing
  item, one per line — `bundleRowRefusal` in `lib/bundle-card-row.ts`) and an optional `share` (absent = Share drawn
  waiting). Service cards are unchanged. Guard `shop/bundle-cards-wear-the-card-row.test.ts` now fails if the bundle
  card draws its own switch/icons or stops importing the row. Merged origin/main (the bundle name's fair-presentation
  note kept on the rewritten maker).

Not built here (each needs another lane or an owner call — listed in the PR): Offers on this bundle (the Offer Maker
owns the link) · the group photo header with ⋯ → % Offers (#7420's shared header + the Offer Maker) · Start the
quote / Make a bundle of these · Send to this couple wiring · the shop-wide default plan setting · Share.

SPEC IMPACT: None — builds approved prototypes and the 2026-11-09 / 2026-11-11 rulings; no ruling changed. Controller
readings flagged in the PR for the owner: which discounts count toward a fixed bundle price (`promo`, `bundle`), and a
bundle's stored price staying put until it is saved again.
