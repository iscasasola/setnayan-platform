## 2026-10-26 · feat(papic): the Thank-You Video is free for every event, on the web and in the app

Owner, verbatim: *"let us remove thank you from the inapp purchase"* → *"make it free for now"*. Measured first:
**zero** `PAPIC_ADDON_THANK_YOU` orders (any status) and zero order lines in production, ever. Nobody paid, so nobody is
owed a refund or a credit.

- **Both halves, as the Live Photo Wall precedent (2026-08-11) requires.** Deactivating the row alone would lock the film
  for everyone.
  - `PAPIC_ADDON_THANK_YOU` joins `FREE_FOR_ALL_SKUS` (`lib/entitlements.ts`), so every ownership predicate answers yes
    with no order.
  - Migration `_thank_you_video_is_free` sets `is_active = false` ONLY so nothing quotes a price. `retail_price_php`
    is kept, so "for now" can be reversed with its figure.
- **The Thank You page** reads the film as owned for every event: no checkout, no Apple sheet, and "Save to my phone"
  downloads straight away, on the web and in the app.
- **iPhone app:** `com.setnayan.app.papic_thank_you` leaves `IAP_PRODUCTS` (retired, never offered). Its id is kept in
  the new `RETIRED_IAP_PRODUCT_IDS`, which also lists the eleven Event Hub Pro part ids, so none is ever reused.
- **No price anywhere:**
  - /pricing's paid "Thank-you film" row follows the now-inactive row;
  - the Papic page's paid marker is gone ("Free.");
  - `llms.txt` drops the row from `REQUIRED_RETAIL` and says "free" (a quoted inactive row drops the file to its stub),
    and its fixture is marked inactive;
  - onboarding's offered set reads only active rows.
- **Guards:**
  - new `lib/thank-you-video-is-free.test.ts`: both halves, the retired product, the page's checkout, llms.txt, the
    public pages. Sabotage-checked: taking it out of the free set turns it red;
  - `kwento-is-free.test.ts` moves the owner's 2026-08-21 "the film stays paid" line to today's ruling (the shot
    ladder stays paid);
  - `entitlements.test.ts` stand-in paid SKU repointed to `PAKANTA` (a free SKU would test nothing);
  - `products.test.ts` and the App Store order db test lose the Thank You product.

SPEC IMPACT: corpus `DECISION_LOG.md` new row "THE THANK-YOU VIDEO IS FREE FOR EVERY EVENT"; `Pricing.md` row updated.
Owner-facing: do NOT attach `com.setnayan.app.papic_thank_you` to an App Store version.
