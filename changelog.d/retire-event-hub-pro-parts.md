## 2026-10-26 · feat(pro): Event Hub Pro is sold whole again, with no more part-by-part on the web or in the app

Owner, verbatim: *"just have the upgrade event hub pro"* → *"i mean no more by part as well on the website."* Event Hub
Pro (`COUPLE_WEBSITE_PRO`) is ONE upgrade everywhere. The eleven parts of 2026-10-22 (`COUPLE_HUB_PART_*`) come off
SALE. Their ownership stays, so a part already paid for keeps working and still counts toward the cap. Measured
2026-10-26: zero part orders and zero part lines in production, so nobody is affected.

- **One switch: the catalogue.** Migration `20271290543004_event_hub_pro_parts_are_retired_from_sale` sets
  `is_active = FALSE` on every part row and refuses to finish if one is still on sale or if Event Hub Pro is not.
  Every web surface already reads it as `hubPartPrices().onSale`, so with no part on sale:
  - the ✓ Apply sheet is the one-unlock sheet ("Unlock Pro and Apply · ₱…");
  - the Maker's quiet line ("Pro parts from ₱500") and the Studio cards' "◆ … from ₱500" lines are gone;
  - onboarding drops "Or buy it part by part later";
  - the server refuses a part order (`resolveHubProCharge`). A part key with no event is now refused outright too,
    before the retail catalogue, which prices a row whatever its `is_active` says.
- **The Event Hub Pro page** (`studio/website-pro`) sells Everything alone. Its eleven parts become one "What Event Hub
  Pro unlocks" list (each part's gates), with no price, no part button, no `?buy=` pick and no "counts toward"
  footer.
- **/pricing** draws no "Everything / Just the parts you need" dropdown (a dropdown of one), and the Event Hub tip drops
  "or just the parts you need". The /pricing/plan quiz already followed the catalogue.
- **The iPhone app** sells Pro whole.
  - The Apply sheet never builds the Apple parts sheet, so "Unlock Pro and Apply" opens `/apple-pro`.
  - `/apple-pro` sells Event Hub Pro alone (no `?buy=` parts; the `AppleProParts` screen is deleted).
  - The eleven `com.setnayan.app.hub_part_*` products are RETIRED out of `IAP_PRODUCTS`, the way
    `mood_board_renders_50` was: StoreKit is never asked for them, `iapProductById` answers null, and the purchase
    start refuses one as unknown. Their ids stay listed in `RETIRED_HUB_PART_PRODUCT_IDS` so none is ever reused.
    They were never attached to a version, and the `event-hub-part` kind is gone.
- **Two sellers that skipped the switch, found and fixed.** The Monogram page and the Panood setup card priced the Logo
  & QR part through `formatV2Sku`, which never reads `is_active`. They would have kept a ₱500 part button after the
  flip. Now Monogram sells Event Hub Pro in place ("Unlock Event Hub Pro"), and Panood says "In Event Hub Pro · ₱…".
- **The address field** names Event Hub Pro, not "the Custom address part", when no part price is read (never in the
  store shell).
- **llms.txt** (what AI assistants read) drops the eleven part codes and the "Or part by part …" sentence. Quoting a
  retired row throws and drops the whole file to its stub, so this had to ship with the migration. Its fixture marks
  the parts inactive.
- `/dev/pro-parts-lab` draws every frame in both states (`&sale=off` = today), and its Apple frames are now `apple` and
  `apple-on`.
- Guards:
  - new `lib/event-hub-pro-is-sold-whole.test.ts`: the migration; every part-price read goes through `onSale` (and
    never `formatV2Sku`), sabotage-checked; the Pro page; /pricing rendered; the server's refusal;
  - `lib/iap/products.test.ts` holds the retired ids to the parts table and asserts none is sold;
  - `lib/pro-parts-in-the-app.test.ts` re-aimed from "the app sells parts" to "the app sells Pro whole".

SPEC IMPACT: corpus `DECISION_LOG.md` new row "EVENT HUB PRO IS SOLD WHOLE AGAIN" (supersedes the selling half of
2026-10-22 "EVENT HUB PRO, PART BY PART" and "EVENT HUB PLUS IS RETIRED — … SOLD PART BY PART", and the /pricing row's
parts dropdown); those rows are marked superseded in place. `Pricing.md` gets the same note. Owner-facing: do NOT
attach the eleven `com.setnayan.app.hub_part_*` products to an App Store version.
