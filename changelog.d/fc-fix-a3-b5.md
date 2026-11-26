## 2026-11-25 · fix(final check, area 3, money rows): a failed price, order or E-Gift read says "Couldn't read"

From the final check of the staging copy (area 3, money-signin rows, display only). No amount, fee, plan, payer or sign-in rule changes, and every price still comes from the same catalogue row.

- **One reader, one sentence:** `readV2Sku` (lib/v2/sku-catalog-v2.ts) reads the row `formatV2Sku` always read and also says whether the read failed; `formatV2Sku` now reads through it. `PRICE_UNREAD` ("Couldn't read the price") lives in `lib/php.ts`.
- **I-01:** E-Gifts reads through `readEgiftMethods`. A refused read says "Couldn't read your E-Gift methods" instead of "No e-gift methods yet" and an add form.
- **E-03 / E-13:** the Maker's and Our story's Event Pro offers say they couldn't read the price, instead of dropping it.
- **I-03:** Save the Date says it couldn't read the opening's price, instead of claiming the opening is part of Event Pro; the Event Pro line does the same.
- **M-02:** Keep full resolution says it couldn't read the price, instead of a bare icon.
- **M-03:** the Thank-You film says it couldn't read the price, instead of "isn't on sale" (dormant while the SKU is free for all).
- **S-01:** an add-on's About page says it couldn't read the price; a refused order read shows "Couldn't check your order" (to the orders list) instead of offering "Get" again.
- **I-02:** the custom-address refusal is a sentence, not the key `needs_custom_address`; an unknown refusal never prints the raw address-bar text.
- **E-13 (owner ruling, Add 45):** a failed plan read on Our story says "We couldn’t check your plan, try again." in every place the Event Pro offer stood; no upsell and no paid limit is drawn from it (`PLAN_UNREAD`, lib/php.ts).
- **After launch (owner):** I-02’s lock + price + checkout door · M-02’s checkout over the ⚙ sheet. **Waits for the owner’s price:** S-01’s two Setnayan AI prices.
- Guard: `lib/a-failed-price-read-says-couldnt-read.test.ts`.

SPEC IMPACT: None. Honest-state wording on shipped pages; no price, plan or product decision changes.
