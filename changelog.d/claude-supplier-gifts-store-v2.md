## 2026-11-17 · feat(gifts): Your gifts becomes a store — one order for any mix of gifts and 10 + 1 bundles, paid once, capped at the most in one payment

Owner, 17 Nov 2026, on the approved prototype `gifts-interactive` v16: *"build it"*. And, on the ceiling: *"We do not allow transactions above 100,000."*

Shop › Promote › **Your gifts** (`shop-gifts-section.tsx`, extended in place — the section, its `id="gifts"`, the free booking-fee row, Next event with us, Badge rewards and the quiet line all stay):

- **Top row** is one card of five: Total (available + held) · Available · Held · Given · **History**. The heading under it is "Available", no count chip.
- **Tap a ticket** → a sheet with the prototype's "For your client / For you" copy and **Add 1** / **Add 10 + 1**. Add opens the store scrolled to that row, which flashes.
- **The store** (`gift-store.tsx`): Papic then Event singles (− n +, at most 9, then "9 is the most here. Want 10? Take the 10 + 1 bundle below and get 1 free."), then "10 + 1 bundles · pay 10, get 11" for every gift. A bundle has no count cap (owner 17 Nov, "Yes, all picks") — only the most in one payment limits it; singles stay at 9. The cart bar reads "N tickets (M free) · save ₱X", the total, **Buy now · ₱total**, and "₱100,000 is the most in one payment." − is not pressable at 0; + and Add are not pressable when they would pass the ceiling ("Would pass ₱100,000").
- **Buy now** posts codes and counts only to the shipped `buyVendorPapicPortfolioPack` (new `for=gift_cart` branch — no new server action) and goes straight to `/pay/<reference>` (BDO first). `/pay` is unchanged.
- **Transaction history** is its own screen: bought orders ("Waiting for approval" once a payment is sent, "In your gifts" once approved, "Not paid yet" opens its payment page again, "Refunded") and gifts given. After paying the shop sees "Payment sent. We're checking it".

Money: every ₱ is the catalogue's (`platform_retail_catalog_v2` list price for a single, the bundle row's own price for a bundle). The server re-prices the posted cart (`lib/shop-gift-cart.ts` `priceCart`) and refuses anything malformed, off sale, or over the ceiling. The ceiling is a new admin setting, `platform_settings.max_payment_php` (seeded 100000, edited in Admin › Settings › Payment methods, audited `max_payment_php_edit`), checked on every branch of the action before a rail is picked — the single-gift and Papic-pack paths too.

Migration `20271350291059_gift_cart_orders_and_the_payment_max`: `platform_settings.max_payment_php`; new `shop_gift_order_lines` (one row per item: sku, qty, unit price snapshot, line total GENERATED; RLS at create, shop-read only, no session writes); `shop_gift_stock_entries.purchase_line_no` with the once-key widened to (order_id, kind, purchase_line_no) — the old single-gift path is line 0 and unchanged; `shop_gift_grant_order_lines` (lands each line once, refuses lines that do not add up to the order total) and `shop_gift_reverse_order_lines`, service_role only, called from `lib/sku-activation.ts` (`grantShopGiftCart` / `reverseShopGiftCart`). Approval stays a human's (`an-ai-may-not-approve-money` unchanged).

Tests: `lib/shop-gift-cart.test.ts`, `lib/max-payment.test.ts`, `lib/shop-gift-history.test.ts`, `lib/the-gift-store-types-no-price.test.ts` (no typed ₱ in the store; the action prices and caps before the rail), `tests/db/a-gift-store-order-lands-once.db.test.ts` (a 3-line order delivers all 3, approving twice delivers once, a mismatch refuses, a refund reverses once, the old path still lands line 0, RLS). Rosters: Ugat claims, exposure baseline, store-shell, order-price-authority, export-completeness, erasure coverage.

Not in this change: "0 stock blocks booking", one gift per quote, a `/pay` redesign, admin batch-receipt matching.

SPEC IMPACT: New admin setting `platform_settings.max_payment_php` (owner-ruled 100,000 ceiling per payment) and the gift-store order shape — to be recorded in the corpus DECISION_LOG once the owner signs off the migration shape (flagged NEEDS-OWNER in the PR).
