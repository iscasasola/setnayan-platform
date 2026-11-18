# PLAN PURCHASE TRACE — a Verified supplier buys Plus / Pro / Ultra (2026-11-16)

Branch `claude/plan-purchase-audit`. Traced in code against `origin/main` (`d16227fe`), not against production.
Anchors are greppable symbols, never line numbers. Plan names: `solo` = **Plus**, `pro` = **Pro**,
`enterprise` = **Ultra** (`planWord`, `lib/vendor-plan-change-words.ts`).

Proven on the PGlite replay: `apps/web/tests/db/a-verified-shop-can-buy-a-plan.db.test.ts` (Plus, Pro and Ultra each
go chosen → paid → active → lapse back to Verified; an unverified shop is refused; a reject after a confirm changes nothing).

Legend: **PASS** · **FAULT → FIXED** (pure code, in this PR, with a guard that goes red without the fix) ·
**FAULT → OWNER** (needs a ruling, see the end).

---

## 0 · What an UNVERIFIED shop sees

| Step | File · symbol | Verdict |
|---|---|---|
| Every paid plan is listed, never hidden; its button is the shared 🔒 "Opens once you are Verified · N of 4 papers" | `app/vendor-dashboard/subscription/_components/plan-sheet.tsx` · `button()` → `LockButton lock="plans"`, `papersProgress` from `plan-screen.tsx` (`countCompleteRequiredSlots` / `REQUIRED_DOC_COUNT`) | PASS |
| The Verified row offers "Get verified" → `/vendor-dashboard/profile#docs` | `plan-sheet.tsx` · `p.key === 'verified' && !verified` | PASS |
| A hand-posted form is still refused by the database | `create_vendor_subscription` · `RAISE EXCEPTION 'NOT_VERIFIED…'` (latest body: `20271177335213_the_plan_change_ladder.sql`) → `startSubscriptionPurchase` turns it into "Verify your shop before subscribing…" | PASS (db test: *an unverified shop is refused*) |

## 1 · Plan page → choose a plan

| Step | File · symbol | Verdict |
|---|---|---|
| Prices are the catalogue's | `plan-screen.tsx` · `fetchV2VendorCatalog()` → `priceBySku`; an unread price shows no figure and no Pay button | PASS |
| The form posts ONLY `sku_code` | `plan-sheet.tsx` · `<input name="sku_code" value={`${p.key}_vendor_${cycle}`}>` | PASS |
| "What you pay today" (proration, credit) | `lib/plan-sheet.ts` · `payToday`; unused value from `vendor_unused_plan_value_php`; a failed read says so on the row | PASS |
| A term shorter than the days held says why instead of a button | `termIsTooShort` / `termTooShortMessage`; server twin `TERM_TOO_SHORT` | PASS |
| The store app (iOS shell) never sells a plan | `plan-sheet.tsx` · `if (storeShell) return null` | PASS |

## 2 · Checkout → payment instructions

| Step | File · symbol | Verdict |
|---|---|---|
| The DB prices the order from `vendor_billing_catalog` (`is_active = TRUE`), resolves the shop from `auth.uid()`, refuses a non-admin | `create_vendor_subscription` | PASS (db test asserts `amount_php` = catalogue price) |
| One open plan change at a time | `ONE_PLAN_CHANGE_PENDING` | PASS |
| An `orders` row is minted with the RPC's own (prorated) amount + `SUB-` reference, so proof has somewhere to go | `app/vendor-dashboard/subscription/actions.ts` · `startSubscriptionPurchase` → `orderRowFor` / `vendorSubscriptionServiceKey` | PASS — fail-soft is logged (`logQueryError … will_throw`) and falls back to the Plan screen's own instructions |
| Credit covers the whole bill → applied on the spot, no ₱0 payment screen | `alreadyPaid` → `?applied=1` | PASS |
| Owner notified that a plan order started | `notifyAdminsSubscriptionPending` (`lib/subscription-purchase-notify.ts`) | PASS (bell + push + morning digest — admin notices are never emailed per owner 2026-11-15, `lib/admin/admin-notices-stay-in-the-app.ts`) |
| …but it named a **Plus** order "a **solo** (monthly) subscription" — the local `TIER_LABEL` had no `solo` | same file, `TIER_LABEL` | **FAULT → FIXED** — `tierName` → `planWord`. 🔒 `lib/a-plan-is-named-the-same-everywhere.test.ts` |
| The payment page `/pay/<reference>` mints the QR with the figure inside, takes the screenshot | `app/pay/[reference]/page.tsx` · `lib/payable-by-reference.ts` · `orderGrossOwed` | PASS |

### 2b · No payment gateway (owner ruling 16 Nov: *"no pay mode for now. just our qr for now. the manual approval method"*)

| Step | File · symbol | Verdict |
|---|---|---|
| `/pay/<ref>` offers only Setnayan's own receiving accounts — "Scan our <account> QR, or transfer / send to our number" | `app/_components/payment/payment-rails.tsx` · `railCardWords`, `ChannelToggle` (kinds `bank` / `ewallet`) | PASS — no card, PayMongo, Maya, Apple Pay or Stripe button on the plan path |
| No gateway route exists to call | `app/api/webhooks/` holds only `persona` and `veriff` (identity checks); `confirm_vendor_subscription_by_reference` is service-role only and has no caller | PASS — the "future Maya / PayMongo webhook" in `startSubscriptionPurchase`'s docblock is a comment, not a path |

## 3 · Payment logged

| Step | File · symbol | Verdict |
|---|---|---|
| The shop logs the transfer + screenshot | `app/pay/[reference]/actions.ts` · `submitPaymentProof` (refuses unless `payable.status === 'awaiting_payment'`) | PASS |
| Owner told the moment money moves | `notifyAdminsPaymentProofSubmitted` (`lib/order-admin-notify.ts`) | PASS |

## 4 · Admin confirms

Two desks can confirm one plan payment.

| Step | File · symbol | Verdict |
|---|---|---|
| **/admin/payments** approves the order → activation hook calls `approve_vendor_subscription` with the admin's OWN session; failure throws (order stays recoverable) | `lib/sku-activation.ts` · `PREFIX_HOOKS` entry for `purchaseIdFromVendorSubscriptionServiceKey` | PASS |
| **/admin/subscriptions** "Confirm payment & activate plan" | `app/admin/subscriptions/actions.ts` · `approveSubscription` → `approve_vendor_subscription`; error → banner; `{already}` does not re-notify; `{deferred}` says "nothing changes yet" | PASS |
| The approve RPC is idempotent and admin-only | `_apply_subscription_credit` (`status = 'paid'` → `{already:true}`), `is_console_admin()` | PASS (db test + `plan-activation-needs-a-real-admin.db.test.ts`) |
| A stale lower plan cannot silently downgrade a live higher one | `guard_vendor_tier_no_silent_downgrade` (`20271115090000`) | PASS |
| **Reject** was a zero-row UPDATE treated as success: `reject_vendor_subscription` is `UPDATE … WHERE status = 'pending_payment'` returning VOID. On an already-paid plan (second admin, stale tab, payments desk got there first) it changed nothing, the admin read "Order marked rejected" and the shop was told its upgrade "couldn't be confirmed" about a live plan | `rejectSubscription` | **FAULT → FIXED** — reads the row back; only `status = 'rejected'` is announced, otherwise the admin is told what the row really says and the shop is told nothing. 🔒 `app/admin/subscriptions/a-reject-that-changed-nothing-says-so.test.ts` + db test *rejecting a plan that is already paid changes nothing* |
| Confirming/rejecting at **/admin/subscriptions** moves only `vendor_subscriptions` — the `orders` row stays `awaiting_payment` forever, so `/pay/<ref>` kept a **live QR** for a plan already on (pay twice) or already refused | `lib/payable-by-reference.ts` · `fetchPayableByReference` read `statusOf(order.status)` alone | **FAULT → FIXED** — `planAwarePayableStatus(order.status, planStatus)` (`lib/payable-status.ts`): plan `paid` → settled, `rejected`/`superseded` → closed, anything else → the order's own answer. Covers the page AND `submitPaymentProof`. **A refused plan read fails closed** (independent audit): `unchecked` → no QR (the page returns before any code is minted), "We couldn't check this payment just now… Try again", and the proof action logs nothing. 🔒 `lib/a-confirmed-plan-is-not-payable-again.test.ts` |
| …the same open order means a plan confirmed at /admin/subscriptions never gets a **receipt**, and the Plan screen's receipts list (`orders … status = 'paid'`) never shows it — a paid plan reads like no payment | `plan-screen.tsx` · `planOrdersRead` | **FAULT → OWNER Q1** |
| Admin fallback label also lacked Plus | `app/admin/subscriptions/page.tsx` · `planName` | **FAULT → FIXED** (same guard) |
| Shop told the plan is on | `notifyVendorSubscriptionActivated` ("Your **solo** plan is active" for Plus before this PR) / payments desk → `notifyBuyerIfAny` | PASS after the planWord fix |

## 5 · Plan active → what changes on the shop

| Step | File · symbol | Verdict |
|---|---|---|
| `tier_state`, `tier_expires_at` (+28 / +365 days, stacking on renewal, fresh term on upgrade), `tier_billing_cycle` | `_apply_subscription_credit` | PASS (db test: 28 days, tier = plan) |
| In search at all: every plan once **verified** — the queries gate on `verification_state`, never on tier. A paid plan requires Verified, so "plan paid but Not in search" cannot come from the plan | `TIER_CAPS` comment "Appears in marketplace search — every plan once verified"; `create_vendor_subscription` NOT_VERIFIED | PASS |
| Reach in couple search: Free·Verified 20 km · Plus 30 · Pro 100 · Ultra nationwide; read on the next search, no cache | `lib/wizard-recommendations.ts` (`radiusOk`) · `app/dashboard/[eventId]/vendors/_actions/category-search.ts` (`withinRadius`) via `tierCaps(...).serviceRadiusKm` | PASS on activation |
| …but both read **raw** `tier_state`. The lapse sweep is login-driven, so an Ultra whose days ended kept nationwide reach (and Pro's 100 km, and the day-1 true name) in every couple's search until it next opened its dashboard | same two files | **FAULT → FIXED** — `tier_expires_at` selected beside `tier_state`, passed through `liveTierState` (`lib/vendor-tier-lapse.ts`, the same rule as `endedPlanReadsFree`). 🔒 `lib/search-reads-the-live-plan.test.ts` |
| Limits (photos, storage, seats) follow `TIER_CAPS` / `portfolioPhotoCap` / `storageAllowanceBytes` | `plan-screen.tsx` rows | PASS (read, not walked) |

## 6 · Renewal and expiry

| Step | File · symbol | Verdict |
|---|---|---|
| Nothing renews by itself; "Keep <plan>" buys the next term and stacks on the days held | `plan-sheet.tsx` · `button(p, 'renew')`; `_apply_subscription_credit` `GREATEST(now(), tier_expires_at) + period` | PASS |
| Within 14 days the end date turns orange on the Plan screen | `plan-screen.tsx` · `expiresSoon` → `plan-rows.tsx` | PASS — but it is the ONLY warning: no notice or email before a paid plan ends | **OWNER Q2** |
| The plan ends: the Plan screen asks the sweep before drawing, and never prints a past day as the future | `tierHasLapsed` → `sweep_vendor_tier_expiry`; `endedPlanReadsFree` | PASS (db test: lapses to Verified) |
| Downgrade waits for the paid days; a scheduled plan lands at term end | `deferred` branch + applier in `sweep_vendor_tier_expiry` | PASS (`vendor-plan-change.db.test.ts`) |

## 7 · Add-ons

| Step | File · symbol | Verdict |
|---|---|---|
| Deep Search — every plan; price re-read from `vendor_billing_catalog` (`is_active`), unverified refused before pricing, order + `/pay/<ref>` | `app/vendor-dashboard/deep-search/actions.ts` · `runVendorDeepSearch`, `resolveDeepSearchPricePhp` | PASS (price path read; not walked) |
| Extra seat / branch (Ultra) — figures from the catalogue rows `SEAT_SKU_CODE` / `BRANCH_SKU_CODE`, unread → no figure | `plan-screen.tsx` · `seatPricePhp` / `branchPricePhp` | PASS (price path read; not walked) |
| AI chatbot, specialized tools, Ultra "+1"s are folded into the plans (owner 2026-11-14); a bought window still shows while it runs | `plan-screen.tsx` · `bought` | PASS |

---

## Owner questions

**Q1 · One desk for a plan payment?** Confirming at /admin/subscriptions switches the plan on but leaves its order open and
mints no receipt, so the supplier's Plan screen shows no receipt for a plan they paid for (this PR already stops `/pay`
asking for the money again). **My pick:** /admin/subscriptions' Confirm sends the admin to that plan's order on
/admin/payments (the desk that matches the bank message, settles the order and mints the receipt) instead of activating
on its own; Reject stays.

**Q2 · Warn before a paid plan ends?** Today the only warning is the end date turning orange on the Plan screen in the
last 14 days; nothing tells a supplier who is not looking. **My pick:** one in-app notice 7 days before `tier_expires_at`
(no email until you say so — house rule "no new emails").
