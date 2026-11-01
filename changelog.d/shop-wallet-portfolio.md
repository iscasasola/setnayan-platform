## 2026-10-25 · feat(shop-wallet): the portfolio pays past its free room from the shop wallet (2/2)

Owner, 23 Oct (option A): every shop has 50 portfolio credits free; after that 1 credit a photo from the SHOP wallet,
paid once, kept while the shop exists. Replaces #6823's "More photos with Papic credits is coming soon" refusal.

- **One step** — migration `the_portfolio_saves_and_spends_in_one_step`: `shop_portfolio_commit(vendor, refs[],
  spend_ref)` writes `portfolio_r2_keys` AND the `portfolio_spend` wallet row in one transaction under the wallet's
  per-shop lock. charge = max(0, after − max(free, kept)); free = 50 (a constant inside, never a parameter) or the
  shop's personal-invite allowance (`portfolio_photo_allowance`, read from the row). Grandfathered: stored photos are
  always kept; a removal frees a free spot, never a credit. A save the wallet cannot cover writes nothing
  (`insufficient`); another shop is `not_owner`; anon cannot call it. `shop_portfolio_ref_credits`: a clip 8, a photo 1.
- **Both writers go through it** — the gallery save (`updateVendorProfileField('portfolio')`, same export — action
  budget +0) and "Put on my page" (`putAlbumPhotoOnMyPage`). `FieldSaveResult` carries the save's answer.
- **The uploader** (Your collections › Portfolio photos): "48 of 50 free · 2 free left" + bar; "Then 1 credit a photo
  · Shop wallet · 128" (a door to Money's sheet); the rule in the ⓘ; the Save carries the charge before the tap ("Save 3
  · 3 credits · wallet 128 → 125"); a short wallet turns the button into a door to the wallet; an unread wallet saves
  free photos only and says so (Retry). `maxFiles` = page + free room + wallet. Lab: `/dev/supplier-lab?s=collections
  &port=48|50|spend|short|unread`.
- `lib/shop-portfolio-credits.ts` (pure quote + words), `fetchShopWalletBalance`; `SHOP_WALLET_HREF` moved into the pure
  `lib/shop-wallet.ts`.
- Guards: `lib/shop-portfolio-credits.test.ts` (formula · SQL mirror · both writers · unread wallet),
  `tests/db/the-portfolio-saves-and-spends-in-one-step.db.test.ts`; re-pointed `plans-price-reach-not-income` 3c and
  `put-photo-on-my-page` 4. Ugat J49 notes the commit.
- ⚠ Not built (owner questions): clips in the portfolio (priced 8, not accepted — the column is image-only across its
  readers); the wallet's event album stays private; packs no longer need the Papic switch.

SPEC IMPACT: None beyond the corpus DECISION_LOG row "Shop wallet — option A" (2026-10-23) this implements.
