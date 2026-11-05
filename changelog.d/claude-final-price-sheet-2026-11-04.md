## 2026-11-04 · feat(pricing): the owner's FINAL price sheet — one price on the website and in the app

Supersedes #7213 (its commits are carried here). All figures live in the catalogue tables, set by migration
`20271308555594_the_final_price_sheet.sql`; no price is typed in product code.

- **Couple** (`platform_retail_catalog_v2`):
  - Papic 150 ₱99 · Papic 1000 ₱499 · Papic 3000 ₱999.
  - NEW **Event Plus** ₱2,990 (`EVENT_PLUS`: 100 Papic credits + Setnayan AI; counts toward Pro through THE CAP).
  - **Event Pro** ₱5,690 (`COUPLE_WEBSITE_PRO`, was ₱6,590; 1,000 credits, topped up from Plus).
  - Live Watch ₱1,990 · Music Maker ₱2,990 · Patiktok ₱2,490.
  - Setnayan AI is off sale (`SETNAYAN_AI*` inactive; events that own it keep it; the charge path refuses it).
- **New columns** `gift_price_php` and `included_papic_credits`, and the grant source `plan_included`.
- **Supplier** (`vendor_billing_catalog`):
  - Solo ₱990 / ₱9,900 · Pro ₱2,490 / ₱24,900 · Ultra ₱5,990 / ₱59,900 (owner, same day: "ULTRA = ₱5,990 PER 4 WEEKS…", superseding ₱9,990).
  - Deep Search ₱499 (Pro, Ultra) / ₱799 (Free, Verified, Solo). AI chatbot ₱1,490 / ₱1,990. Both are two catalogue rows per band now, instead of a typed matrix.
  - 3D booth ₱1,490 · photo challenge ₱1,490.
  - Extra branch ₱1,990 and seat ₱990, sold to Ultra only (the button is hidden and the server refuses other plans).
  - Six storage rows priced but INACTIVE, because the purchase is not built.
  - Every 4-week row has a yearly sibling at exactly 10× (owner, "EVERY 4-WEEK PURCHASE HAS A YEARLY PRICE = 10×"): seat ₱9,900 and branch ₱19,900 a year, plus new extra category ₱499 / ₱4,990 and +2 service cards ₱99 / ₱990. All are dark (no purchase built). Guard: `tests/db/a-year-is-ten-four-week-cycles.db.test.ts`.
  - The ₱500 supplier Papic pack is retired. Shops now buy the couple's three packs into the shop wallet.
- **Gift prices**:
  - What a Verified-and-up supplier pays to gift a product is stored per row.
  - The booking-fee gift keeps the same photos and is charged at the gift price (`setnayan_gift_for_fee(BIGINT, UUID)` + TS mirror). Free pays the list price.
- **Apple**:
  - `event_plus`, `event_pro` and the three `papic_pack_*` are on sale; the AI IAPs and `event_hub_pro` are retired but still deliver.
  - The 8 supplier gift products are listed but NOT sellable; the supplier-buyer purchase is not built.
  - In the app, a booking fee that carries the gift is refused on the web rail.
  - Doc: `build-sessions/APPLE-IAP-PRICES-2026-11-04.md`.
- **Copy sweep**: every customer surface reads the catalogue. The guard is `lib/no-record-of-the-older-prices.test.ts`, with a reasoned allowlist.
- **CI repair after merging main**:
  - The on-the-day pack picker is a PickMenu, not a raw `<select>`.
  - The admin Papic editor's seed now holds the sheet's ₱99 / ₱499 / ₱999. It still held ₱90 / ₱490 / ₱990, and the catalogue is unchanged.
  - The dev money lab reads a pack list.
  - Two structural tests now accept the shared wallet writer and the `{ giftPrice }` argument.
  - The App Store names "Papic 1000" are allowlisted as identifiers.
  - The secret-scan false positives are pinned.

SPEC IMPACT: None. The rulings are already recorded in the corpus `DECISION_LOG.md` 2026-11-04 rows ("FINAL PRICE SHEET", "STORAGE BY THE YEAR", "SUPPLIER PRICE SHEET", "SIX OWNER ANSWERS", "DEEP SEARCH AND CHATBOT KEEP TWO PRICES BY PLAN", "GIFT PRICES", "EVERY 4-WEEK PURCHASE HAS A YEARLY PRICE = 10×", "ULTRA = ₱5,990 PER 4 WEEKS / ₱59,900 PER YEAR"); this PR implements them.
