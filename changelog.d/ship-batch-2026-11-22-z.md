## 2026-11-22 · ship(batch-z): #8166 a shop's plan billed by Apple (supplier subscriptions D + E)

#8166: Apple's App Store notifications run a shop's plan. A paid Apple period is a `vendor_subscriptions` row switched on by the shared applier, with Apple's `expiresDate` as the clock. Each shop is billed by one channel only, and one Apple subscription belongs to one shop. A plan whose money went back drops at once through one door, `vendor_plan_money_reversed`, for both channels. Migration `20271359936839_a_shop_plan_billed_by_apple.sql` (controller GO pinned to blob 9cd8d2d7e3).

Ship controller: the generated files are regenerated once on top of batch Y. The exposure surface gains the new table `vendor_app_store_subscriptions`: SELECT-only for the shop's admins and for Setnayan admins, no writes for anon or authenticated. It also gains `vendor_subscriptions.app_store_original_transaction_id`, whose grants match its sibling columns, under the table's existing RLS. The dev lab `/dev/apple-plan-door-lab` (404 in production) is listed in the no-door baseline.

SPEC IMPACT: None (#8166's own fragment carries its spec notes)
