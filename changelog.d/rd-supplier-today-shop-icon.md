## 2026-10-24 · fix(supplier-nav): Today wears the shop's storefront, not a house

Owner, 2026-10-24: "Shop icon not home icon on Shop's Dashboard Today." The supplier
dashboard's Today tab drew lucide `Home` (a house — the couple's event Home). It now
draws `Store` (the storefront), the same glyph the couple's menu uses for suppliers,
in all four places that decide it: the phone bar's code item (`vendor-bottom-nav.tsx`),
the laptop rail (`VENDOR_DESTINATIONS`), and BOTH registry default slots
(`vendor.bottom-nav.home` — the one the phone bar actually draws — and
`vendor.sidebar.overview`, the rail's). The registry wins over the code, so changing
only the code would have left the house on every real bar.

The Shop tab keeps `ShoppingBag`, so the two tabs stay distinct. Prod
`nav_slot_override` holds no `vendor.*` rows (read-only check 2026-10-24), so no
migration: the code defaults are what production draws.

New guard in `vendor-bar-is-four.test.ts`: Today is `Store` on the bar and the rail,
with and without the registry defaults applied, and never the same glyph as Shop.

SPEC IMPACT: None.
