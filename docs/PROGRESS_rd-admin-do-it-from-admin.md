# PROGRESS — rd/admin-do-it-from-admin (P5a, PR 1 of 2: money)

Stopped mid-build on 2026-10-01 by controller order (moving to a cloud session).
**Nothing here has been typechecked, linted or tested.** Treat every file as a draft.
Second half (b)(c)(d)(e) is a separate branch: `rd/admin-do-it-from-admin-2`.

Measured before starting: server actions 1225 / 1225 (`node apps/web/scripts/lint-server-action-budget.mjs`).
No new exported "use server" function has been added on this branch (all new work is intent
branches or non-exported helpers). Bundle not measured yet.

## Done (a2 — receiving accounts become a LIST), unverified

- **Migration** `supabase/migrations/20271258278351_receiving_accounts_are_a_list.sql` (made with
  `pnpm migration:new`): adds `platform_settings.receiving_accounts jsonb NOT NULL DEFAULT '[]'`
  + CHECK is-array, and copies today's GCash then BDO fields into it ONCE (ids `gcash`, `bdo`;
  only rails with a number or QR; only while the list is empty). Column, not a table: the
  singleton already has admin-write / authenticated-read (20271014400000 grants table-level
  SELECT to authenticated, so no new grant). Legacy columns kept as the fallback.
- **`lib/payment-channels.ts`** — the ONE rule, now list-aware: `PayChannel = string`,
  `ReceivingAccount`, `parseReceivingAccounts`, `serializeReceivingAccounts`,
  `legacyReceivingAccounts` (fallback when list empty/unread), `receivingAccounts`,
  `usesAccountList`, `openAccounts`, `openChannels`, `openRailOptions` (`OpenRail {id,label}`),
  `channelLabel`, `isChannelOpen`, `resolveChannel`, `openRailDetails` (now
  `{accounts[], open: OpenRail[]}`). `PAY_CHANNEL_LABEL` removed. `PAY_CHANNELS` = the two
  legacy ids (only ones with cap meters).
- **`lib/platform-settings.ts`** — `receiving_accounts` on the row, fetched by its OWN probe
  (missing column costs only the list); `fetchPlatformSettingsMeasured` returns
  `accountsReadFailed`.
- **`lib/payment-destination.ts`** — `PAYMENT_ACCOUNT_LIST_COLUMN`, `ACCOUNT_DESTINATION_FIELDS`
  (account_name, number), `changedAccountDestinations`, `describeAccountChange`.
- **Shared payment UI** — `payment-rails.tsx` (`RailIdentity`, `ChannelToggle({channel,
  onChange, rails})`, `PaymentDetailsBlock({info})` with label/kind words, `railBadge`,
  `openRailsFromSettings`; `railFromSettings` removed), `pay-rails-block.tsx` (`rails` prop).
- **Consumers converted**: /pay page + pay-panel (`rails` prop, `railsClosed = info === null`),
  /pay action (channel must be an id in the list, else `bank_transfer`), papic order page +
  papic buy action, inline checkout drawer, checkout action (`channelLabel` in refusal),
  orders/[orderId] + booking-fees (`openAccounts(...).map` for `everyOpenRailCarriesAmount`),
  6 supplier pay pickers (`openRails: readonly OpenRail[]`, `openRails.map`), their 4 server
  pages (`openRailOptions`), branch-manager + shop page, custom-configurator (3+ = select).
- **`app/admin/settings/actions.ts`** — `savePaymentInstruments` gained intents
  `account_save | account_toggle | account_move | account_remove` (non-exported helper
  `saveReceivingAccount`); default branch now saves ONLY caps + balances (it must never write a
  destination again). New account or new name/number ⇒ `approve_payment_account_change` with
  payload `{kind:'account', account:{…}}`; label/kind/order/switch save at once; last account
  can't be removed. `uploadMerchantQr` / `removeMerchantQr` take any account id as `kind`.
  `executePaymentAccountChange` handles `account`, `qr` (any id) and legacy `fields` (also
  patches the list entry). `writeAccountList` mirrors gcash/bdo `*_enabled` (+ legacy QR /
  name / number columns on approval) so the fallback never re-opens a closed rail.

## Not done

1. **Admin page `app/admin/settings/payment-methods/page.tsx` is NOT converted** — it still
   imports `PAY_CHANNEL_LABEL` and posts the old bdo/gcash fields (will not compile).
   Draft of the new top half: `docs/wip/payment-methods-page-top.draft.tsx.txt` (list of
   `AccountCard`s, "Add an account", "Monthly limits" for gcash/bdo, QR guidance). Still to
   write: `AccountCard` (toggle/move/remove/edit forms as SIBLING forms — lint-nested-forms;
   per-account QR block with "QR says: <tag 59>" via `parseTlv` from lib/emv-qr.ts),
   `AccountFields` (label · Bank/E-wallet two radios · account name · number), `ChannelSwitch`
   minus its checkbox and with a `label` prop, imports (`receivingAccounts`, `PAY_CHANNELS`,
   `Plus`), `notice` in searchParams, `accountsReadFailed` from the measured read.
   `settings/_components/qr-upload-form.tsx` `kind` type → `string`.
2. Labels: `lib/admin-approvals.ts` approve_payment_account_change label → "Change a receiving
   account (money)"; `lib/two-admin-promise.ts` note should mention the list.
3. **Guards to update (structure changed, keep the property):**
   `lib/the-receiving-account-has-one-door.test.ts` (add `receiving_accounts` to scanned
   targets; `changedAccountDestinations(` instead of `changedDestinationFields(`; request count
   still 2 — account_save + QR; "rail controls save without approval" → the toggle branch has
   no `admin_approval_requests`), `lib/a-closed-rail-hands-out-no-account-number.test.ts`
   (openRailDetails shape; pickers use `openRails.map(`/`pay.open`; /pay asks `openAccounts`;
   `railsClosed = info === null`), `lib/payment-channels.test.ts` (`isPayChannel` semantics;
   add list tests: order, fallback when empty, malformed entry dropped, closed account hidden),
   `app/_components/payment/one-payment-surface.test.ts`, `app/pay/one-payment-page.test.ts`,
   any test pinning "from your BDO or GCash confirmation" (copy changed in /pay action).
4. **(a) not started**: Record a payment received (intent branch `intent=record` on
   `approvePayment`: read order, `canLogPaymentAgainstOrder`, insert with
   `createMoneyWriterClient()` + `paymentRowFor`/`guestPaymentRowFor` in the same shape as
   `logPayment`, hidden idempotency uuid, then `approvePaymentCore` promote=true); form on
   /admin/payments when `q` resolves to exactly one order ("Paid into" = native select of
   `receivingAccounts`); row 13 (approvePayment redirect carries `q` — add hidden `q` to the
   approve forms); row 16 (transactions-ledger side reads keep errors, column says "couldn't
   read", Received KPI null if payments read failed); ledger rows link to
   `/admin/payments?filter=all&q=<public_id>`. Rows 1, 2, 14 already shipped in #6212.
5. Ugat db tests (schema-claims / concept-coverage), prod-schema snapshot check, changelog
   fragment `changelog.d/rd-admin-do-it-from-admin.md` (SPEC IMPACT: None), every guard
   sabotage-checked once, typecheck/lint/lint-*.mjs, bundle + action numbers, PR routine.

## Next step

Finish the payment-methods page from the draft, then `pnpm typecheck` from apps/web and fix
fallout, then update the guards in item 3, then build (a).

## Gotchas found

- `rereadPaymentReceipt` IS called (payments/page.tsx form) — cannot be retired; use an
  intent branch on `approvePayment` instead.
- `lib/an-ai-may-not-approve-money.test.ts` forbids the one-click `decisive` predicate from
  reading the AI receipt read. The owner answer "Confirm only when Setnayan AI matched amount +
  reference" is about the prototype's Next-card Confirm (Work tab, not built). Holding back is
  allowed by the 2026-07-11 rule, letting money through is not — flag to the owner, don't wire
  the AI verdict into approval.
- Receiving-account changes are Vendor Agreement § 9.1 two-admin actions; the list keeps that
  gate (and exactly two request sites, as the one-door guard expects).
- Payment amounts on payments.channel feed the cap meter by exact id match (`gcash`/`bdo`).
- Bare `grep` returns nothing in worktrees — use `/usr/bin/grep`.
