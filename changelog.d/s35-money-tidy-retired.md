## 2026-09-18 · chore(money): drop the retired token wallet and Supplies vertical

Source: S26's ranked orphan baseline (`apps/web/tests/db/ugat-both-ends.baseline.txt`,
PR #5625). The token wallet was RETIRED 2026-05-11 (locked decision) and the
Setnayan Supplies vertical (0018) never got past schema-ahead-of-UI. Both
left orphans behind — a caller-less end with nobody to build the other side
of, because the feature itself is gone. **Chose (b): delete the end that
remains**, for every item in the baseline except two, which are false
positives for "retired":

- **Migration `20271234329420`** drops 8 token-wallet RPCs
  (`approve_vendor_token_purchase`, `confirm_vendor_token_purchase_by_reference`,
  `consume_lead_token_hold_for`, `create_vendor_token_purchase`,
  `grant_member_purchased_tokens`, `grant_vendor_lifetime_tokens`,
  `redeem_vendor_token_voucher`, `reject_vendor_token_purchase`) and 5 tables
  (`vendor_token_boosters`, `supplier_vendor_skus`, `supplier_vendor_sku_pricing`,
  `supplies_orders`, `supplies_order_line_items`) — **all 5 tables re-verified
  at 0 rows in prod immediately before writing the migration.** Also drops the
  now-dangling `vendor_payouts.supplies_order_id` FK (`vendor_payouts` holds 0
  rows of any `payout_type`); the column and its `payout_type` CHECK/XOR stay,
  reducing `vendor_payouts` further is a separate decision.
- `lib/notifications.ts` — removes `vendor_token_purchase_pending` /
  `vendor_tokens_credited` from the `NotificationType` union and their two
  label/tone map entries. **The Postgres enum values are NOT dropped** —
  Postgres can't drop a single enum value without recreating the whole type,
  and 2 historical notification rows already carry
  `vendor_token_purchase_pending`. Those 2 rows now render without a friendly
  label/tone (object lookup returns `undefined`, not a crash) — a cosmetic
  regression on admin history, traded for closing the actual orphan (no app
  file ever emits either type).
- Test/baseline upkeep so the drop doesn't go red: `anon-table-grants-closed.db.test.ts`
  (5 entries removed, 2 batch floors + the combined floor lowered — a
  dropped table can't be named in a grant check, `has_table_privilege` throws
  on a missing relation), `anon-rpc-surface.baseline.txt` (3 stale lines for
  functions that no longer exist), `ugat-concept.baseline.txt` (2 stale
  "declined" lines), `user-delete-refusing-fks.baseline.txt` +
  `user-fk-behaviour.generated.txt` (regenerated via
  `UPDATE_FK_BEHAVIOUR=1 pnpm --filter @setnayan/web test:db` — the third
  deliberate user-delete blocker, `supplies_orders_buyer_user_id_fkey`, is
  gone with its table) and `lib/user-delete-blockers.ts`'s matching entry, and
  `supabase/security/exposure-surface.baseline.txt` (regenerated via
  `pnpm --filter @setnayan/web exposure:baseline` — 76 lines removed, 0 added,
  confirming a narrowing, never a widening).
- **`data-subject-register.ts`'s `supplier_vendor_skus` entry and
  `export-coverage-guardrail.test.ts` / `erasure/coverage-guardrail.test.ts`'s
  `supplies_orders` entries are deliberately LEFT IN PLACE** — both scans
  derive their schema from a text union of every historical `CREATE TABLE`
  across `supabase/migrations` and do not parse `DROP TABLE`, so the table
  stays "seen" and removing the entry would fail their own "every
  person-bearing/subject-bearing table is classified" gate. Same pattern
  those files already use for `patiktok_*`, `panood_roam_*`,
  `telemetry_events` etc.
- Comment/doc corrections so nothing keeps claiming these objects exist:
  `apps/web/CONNECTION_MATRIX.md`, the Supplies-marketplace page + product
  catalog docblocks (their "PR 3b" plan assumed this exact schema — flagged
  stale, not deleted, since the plan's shape is still useful context for
  whoever revives the vertical), `lib/erasure/purge.ts` and
  `app/admin/users/actions.ts` ("exactly THREE still refuse" → TWO), and
  `lib/booking-fee-charge.ts`'s dangling reference to the dropped RPC.

**NOT dropped, on purpose — both are false positives for "retired":**
- `confirm_vendor_subscription_by_reference` — subscriptions are LIVE. Its own
  migration comment calls it a "Webhook/service-role entry point," and
  `vendor-dashboard/subscription/actions.ts`'s docblock says the future
  automation path is "a webhook handler, not a rebuild." No caller today
  because the webhook doesn't exist yet, not because the feature died.
- `components/billing/ManualCheckoutModal.tsx` — `changelog.d/manual-checkout-modal-fit.md`
  already recorded this as "the client half of the deliberately-parked
  manual-QR gateway... Parked pending KYC, not decayed." That decision
  stands.

**Verified:** targeted `apps/web/tests/db/*.db.test.ts` (32 tests) and the
directly-touched unit tests (51 tests) pass; full `apps/web` `tsc --noEmit`
is clean.

SPEC IMPACT: None — both retirements (token wallet, Supplies vertical) were
already locked decisions; this closes the schema/RPC surface those decisions
left behind rather than changing product scope.
