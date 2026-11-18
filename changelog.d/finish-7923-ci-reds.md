## 2026-11-18 · fix(gifts): the gift store's CI guards — open-rail check, commas, no typed price, shop-shelf baseline, admin page score, logged read

The six guards that were red on the Your gifts store: the buy bar now asks the open-rails list for BDO (still BDO only, no fallback); the ticket sheet's photo count carries its comma and the pack-size thresholds live in `gift-store-sizes.ts`; the plan lab's biggest Papic pack is held apart from the Event rows; the home-shelf write baseline is regenerated (the gift cart is a second `orders` insert in `portfolio-pack-actions.ts`); the admin "Most in one payment" block uses a plain heading and a computed note (page score back to 25); and its `max_payment_php` read logs its error.

SPEC IMPACT: None.
