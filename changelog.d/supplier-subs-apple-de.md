## 2026-11-22 · feat(plans): supplier plans billed by Apple, plan changes, and the in-app plan door (supplier subscriptions D + E)

Owner-locked 22 Nov (corpus `SUPPLIER_SUBSCRIPTIONS_BUILD_SPEC_2026-11-22.md`, late build list items D + E, §3 store shell, §5 one entitlement / one channel).

- **Apple (D).** App Store Server Notifications v2 now handle the three "Supplier plans" subscriptions (`supplier_plus/pro/ultra_monthly`): SUBSCRIBED · DID_RENEW · DID_CHANGE_RENEWAL_PREF · DID_FAIL_TO_RENEW · GRACE_PERIOD_EXPIRED · EXPIRED · REFUND · REVOKE (`lib/iap/supplier-subscription.server.ts`, dispatched first in `lib/iap/notifications.server.ts`). FAMILY_SHARED is refused. One subscription = one shop: `vendor_app_store_subscriptions` maps `originalTransactionId` to the shop its first `appAccountToken` named; a restore on a second shop is refused.
- **One entitlement.** Apple grants through the shipped `_apply_subscription_credit` and ends through `sweep_vendor_tier_expiry` (migration `20271359936839_a_shop_plan_billed_by_apple.sql`); Apple's `expiresDate` is the clock of an Apple-billed month.
- **One channel.** `vendor_plan_billing_channel`; a web purchase on an Apple-billed shop is refused at the table (`APP_STORE_BILLED`, said plainly on the Plan page and after a press); Apple never grants a web-billed shop.
- **Grace hook.** DID_FAIL_TO_RENEW records `status = billing_retry` and `billing_failed_at` (first failure, cleared on recovery). The earned-grace rule itself is another PR.
- **E.** Up = now, down = end of the paid month (Apple's group levels; the web's existing ladder). A refunded / charged-back plan order (admin refund, Maya reversal) or an Apple REFUND/REVOKE drops the plan at once (`vendor_plan_money_reversed`); the storage allowance of the plan dropped to then holds uploads. `vendor_subscriptions.status` gains `refunded`.
- **In-app door.** Shop ⚙ › Plan and billing in the iPhone app (where Apple can sell) offers Plus · Pro · Ultra at StoreKit's own price with the shop as the `appAccountToken`; the confirm folds into `confirmAppStorePurchase` (server actions unchanged at 1251).

SPEC IMPACT: None — builds spec items D + E as written; App Store Connect steps for the owner are listed in the PR body.
