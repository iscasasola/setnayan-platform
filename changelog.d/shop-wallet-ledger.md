## 2026-10-23 · feat(shop-wallet): one Papic-credit wallet per shop — packs land in it, Money is its one home (1/4)

Owner, 23 Oct, on the prototype `shop_wallet_portfolio_credits_2026-10-23`: **option A — ONE SHOP WALLET.** Packs go
into one shop balance, spendable on the portfolio or on any event the shop is booked on; the 50-credit event gift and
the booking-fee credits stay with their event.

- **The ledger** — migration `shop_papic_wallet_ledger_and_the_shop_pack`: `shop_papic_wallet_entries`, append-only
  and signed (packs in, spends out, a refunded pack taken back as a `reversal`). The sign is tied to the kind by a named
  CHECK; a pack lands once per order (`(order_id, kind)` unique); a spend lands once per thing it paid for
  (`(vendor_profile_id, spend_ref)` unique). RLS at CREATE TABLE: a shop reads only its own rows; no session writes.
  `shop_papic_wallet_spend` is the only spend door — it locks the shop, re-reads the balance under the lock and refuses
  what it cannot cover (service-role only). `shop_papic_wallet_balance` is the one sum.
- **The pack is a shop purchase** — `vendor_papic_portfolio_pack` is now `vendor_addon_metered`, titled "Papic credit
  pack — 100 credits for your shop" (price untouched — admin-managed). `buyVendorPapicPortfolioPack` (same export, the
  server-action budget is at its ceiling) mints with `eventId: null`; the booked-event check, the per-event fee lock and
  the Papic-capture kill switch no longer apply to a shop purchase. The activation hook writes the wallet (idempotent
  per order); a refund writes a `reversal` row (new deactivate arm — the per-event pack never had one).
- **Customers › Money › SETNAYAN** — one new row, "Shop wallet · N Papic credits" ("Portfolio and any event · packs you
  bought"; "₱500 pack · checking" while a pack waits; "needs a new screenshot" on a resubmit; on a failed read "Couldn't
  read it right now — nothing was spent" + Retry, never 0). Its sheet (`?seg=money&wallet=1`): balance, Came from (packs
  one by one, portfolio and event spends folded), the events' own pots (each a door to that event's Papic), and Buy a
  pack (rail ▾ + Buy; "Pack unavailable" when the SKU is off; the shipped PaymentsPausedNote when every rail is closed;
  hidden in the App Store shell; withheld when the balance is unread).
- Guards: `tests/db/the-shop-wallet-spends-once.db.test.ts` (no double spend, sign/kind, once per order, RLS, the sum
  below zero after a refund); updated `activation-ownership-gate`, `order-price-authority`, `the-fee-unlocks-the-event`
  (the pack left the per-event fee list, reasoned), the pack-SKU db test. Ugat J49 carries the wallet's claims.
- ⚠ The prototype paints Buy gold; the owner's look call "every main is terracotta" (2026-10-12) keeps it terracotta.

SPEC IMPACT: corpus DECISION_LOG row "Shop wallet — option A" (2026-10-23) records the build; prototype
`shop_wallet_portfolio_credits_2026-10-23.html` is the contract.

## 2026-10-25 · fix(shop-wallet): a credit pack sells only while Papic is on
Owner, asked whether a shop may buy packs while Papic is off: "No. Papic needs to be on." The pack action refuses before minting an order when `isVendorPapicCaptureEnabled()` is false, and the wallet sheet draws no Buy (the balance still shows). Guard: `a-pack-needs-papic-on.test.ts`.
SPEC IMPACT: None (ruling recorded in DECISION_LOG with the pricing batch).
