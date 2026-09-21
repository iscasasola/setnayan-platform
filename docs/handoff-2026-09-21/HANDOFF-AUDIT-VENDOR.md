# HANDOFF AUDIT — THE SUPPLIER'S JOURNEY

**Measured 2026-09-21** against `origin/main` and the live Supabase prod DB (read-only).
Not against any document. Where a document and the tree disagreed, the tree won and the
disagreement is recorded in § Contradictions.

⚠ **A HANDOFF IS NOT EVIDENCE — including this one.** Every row carries a greppable string
anchor or the SQL that re-measures it. **Never trust a status here without re-running it.**

---

## THE ONE-LINE ANSWER

Almost everything in the supplier journey is **BUILT**. Very little of it has ever been
**EXERCISED**. The live database holds **2 shops, and both are the owner's** — both
`tier_source='admin_comp'`, both wearing a `verified` badge that came from a
`vendor_verification_bypasses` row rather than from the approval flow. So the surfaces that
decide whether a real supplier stays are precisely the ones with **zero production rows**.

The single worst defect is a money lie on the page called **Earnings**, live today.

---

## WHAT A REAL NEW SUPPLIER MEETS ON DAY ONE

Measured from column defaults, not inferred:

```sql
select column_name, column_default from information_schema.columns
 where table_schema='public' and table_name='vendor_profiles'
   and column_name in ('public_visibility','verification_state');
-- public_visibility  → 'hidden'
-- verification_state → 'unverified'
-- tier_state         → 'free'
```

`isShopLive()` (`apps/web/lib/vendor-visibility.ts`) requires **both** columns to read
`verified`. So a brand-new shop is **invisible to every couple** on explore, search and
`/v/[slug]` from the moment it is created, and becomes visible only after:

1. the supplier submits documents (`submitApplication` → `pending_review`), **and**
2. a human — in practice the owner — approves the application, **and**
3. a human *separately* flips `public_visibility` via `transitionVendorVisibility`,
   **which notifies the supplier of nothing at all.**

There is no automation, no SLA, and no second admin. **Zero applications have ever been
submitted in production** (both rows sit at `draft`). The path from "I signed up" to
"couples can find me" has therefore **never once been walked end to end by anybody.**

---

## THE REGISTER

Ranked: money/trust first, then dead ends, then absence.
Status key — **BROKEN** · **UNREACHABLE** · **NOT BUILT** · **DECIDED-UNBUILT** · **NEVER EXERCISED**

| # | Symptom the supplier hits | Status | Anchor / re-measure | Money+trust | Eff |
|---|---|---|---|---|---|
| 1 | **The Earnings page says ₱0 to a shop that was paid.** Saysay was paid ₱2,000 (09-18) and ₱3,350 (09-20), both vendor-confirmed — Earnings shows nothing. `fetchVendorEarnings` matches `orders.service_key` against `vendor_services.category`; in prod those vocabularies are **disjoint** (`ONBOARDING_SERVICES`/`SETNAYAN_AI`/`PAPIC_GUEST_*` vs `live_band`/`host_mc`). The filter can never match, for anyone, ever. | BROKEN | `grep -n "catSet.has(r.order.service_key)" apps/web/lib/vendor-earnings.ts` · `select service_key from orders group by 1;` vs `select category from vendor_services group by 1;` | **Highest.** The supplier's own money reads as zero. Renders identically to "Setnayan never paid you". | M |
| 2 | **Earnings is not scoped to a vendor at all.** Admin client, platform-wide `payments` read, filtered *only* by category — no `vendor_profile_id` anywhere. Two shops sharing a category would each see the other's orders: amounts, reference codes and the couple's `event.display_name`. Masked today only because #1 matches nothing and one shop has services. | BROKEN (latent leak) | `grep -n "vendor scope is enforced by the" apps/web/lib/vendor-earnings.ts` | Cross-tenant disclosure of couples' names + amounts the moment a 2nd shop shares a category. | M |
| 3 | **The honesty guard covers this page and cannot see either defect.** `reads-are-honest.test.ts` lists `earnings/surface.tsx` but asserts only `payoutsMeasured ?` — a *refused* payout read. `fetchVendorEarnings` **succeeds** and returns `[]`, so the ₱0 is a legitimate, unflagged zero and the guard stays green. | BROKEN (guard gap) | `grep -n "payoutsMeasured" apps/web/app/vendor-dashboard/reads-are-honest.test.ts` | The mechanism built to catch exactly this class does not face it. | S |
| 4 | **The supplier's fee bill renders an empty page on a refused read.** `fetchVendorFeeOrders` ends `if (error) return [];` — an RLS refusal or outage says "nothing due" instead of saying it could not read. Same disease as #1, on the other money page. | BROKEN | `grep -n "if (error) return \[\]" apps/web/lib/vendor-booking-fees.server.ts` | "You owe nothing" is a claim; a failure must never make it. | S |
| 5 | **The first 5 bookings are invisible on the fee bill.** The bill reads `orders`, and a waived booking calls `createOrder: false` — so no row exists. `highest_declared_centavos` **has zero readers in the entire app**, so the "what it would have cost" figure is written and never shown. A supplier sees an empty bill for bookings 1–5, then a ₱837.50 charge on #6 with no prior context. | BROKEN | `git grep -rln highest_declared -- apps/web/app apps/web/lib` → **empty** · `grep -n "createOrder: false" apps/web/lib/booking-fee-lock.ts` | ⚠ **Directly contradicts the brief's known-context.** See § Contradictions. | M |
| 6 | **The subscription paywall is OFF in production.** `VENDOR_TIER_FEATURE_GATE` is **absent** from `vercel env pull --environment=production`; `envFlagEnabled(undefined)` is `false`, so all 5 `VendorTierGate` mounts and `thread-calls-gate` are inert. Every `free` shop gets Solo tooling free. The code says so itself. | DECIDED-UNBUILT (deliberate ship-dark) | `grep -n "VENDOR_TIER_FEATURE_GATE" apps/web/lib/vendor-feature-gate.ts` · `grep -n "default OFF → every tier sees every card" apps/web/app/vendor-dashboard/performance/page.tsx` | The ₱1,000/mo ladder collects nothing and cannot. Owner call, not a bug — but it is off. | S to flip / L to trust |
| 7 | **No supplier has ever paid Setnayan for a subscription.** Both `vendor_subscriptions` rows belong to the owner's own shop, both `reviewed_by` the owner, both `order_id` NULL — no payment rail was ever touched. | NEVER EXERCISED | `select vendor_id, sku_code, status, order_id, reviewed_by from vendor_subscriptions;` | The subscription rail is unproven end to end. | M |
| 8 | **An unverified shop is charged no booking fee, ever.** `!args.verified` returns `charge:false` before the ordinal is even considered. Safe while unverified shops are unfindable — but any `import`-attribution booking (a supplier bringing their own client) by an unverified shop is free forever. | BROKEN (latent) | `grep -n "if (!args.flagEnabled || !args.verified)" apps/web/lib/booking-fee-lock.ts` | A fee hole that opens the moment self-serve import bookings exist. | S |
| 9 | **The only place a supplier can see money they actually received is inside one chat thread.** `event_vendor_payments` is read on the vendor side **only** by `messages/[threadId]`. No total, no per-event rollup, no "what am I still owed". | NOT BUILT | `git grep -ln event_vendor_payments -- apps/web/app/vendor-dashboard` | To answer "what have I been paid?" a supplier must open every thread one at a time. | M |
| 10 | **Going live is silent.** `transitionVendorVisibility` writes an audit row and a tier-history row and calls **no notifier**; `notifyVendorStatusChange` is wired to the applications path only. The findability banner is the only telling, and only if they happen to log in. | UNREACHABLE | `awk '/async function transitionVendorVisibility/,/^}/' apps/web/app/admin/verify/actions.ts \| grep -c notify` → **0** | The best news the product ever has for a supplier reaches them by accident. | S |
| 11 | **Nothing ever tells a supplier their event is over and needs marking complete.** The answers-desk kinds are `lock_request · delete_request · lock · lock_request_lapsed · review · dispute · message · meeting · quote_draft · contract_draft`. There is no `mark_complete`. | NOT BUILT | `grep -n "kind: '" apps/web/lib/vendor-overview.ts` | The starter motor for the whole after-the-event flywheel is missing. | M |
| 12 | **The entire after-the-event chain is dammed behind that one control.** `coupleConfirmReceived` requires `.not('service_marked_complete_at','is',null)`. **0 of 51** `event_vendors` rows have it set. So no couple has ever been able to confirm delivery — which is what unlocks the review. | NEVER EXERCISED | `select count(*) filter (where service_marked_complete_at is not null) from event_vendors;` → **0** | No reviews ⇒ no track record ⇒ no next booking. The retention loop has never closed once. | M |
| 13 | **Reviews have never existed.** `vendor_reviews` = 0 rows. The only `INSERT` in the tree is the demo seeder. `vendor_review_stats` / `vendor_trusted_review_stats` sit on empty input. | NEVER EXERCISED | `select count(*) from vendor_reviews;` → 0 · `git grep -n "from('vendor_reviews').insert" -- apps/web/app` | The single strongest trust signal on the marketplace is unproven. | M |
| 14 | **Verification has never run end to end.** 2 applications, **both `draft`** — never submitted. `vendor_verifications` = 0. Both live badges come from `vendor_verification_bypasses`, whose own `reason` cites the owner's 2026-09-11 Q4 ruling ("the badge stays for six months while the papers come in"). Nothing is scheduled to check at that deadline. | NEVER EXERCISED | `select status, count(*) from vendor_verification_applications group by 1;` · `select reason from vendor_verification_bypasses;` | Both badges lapse ~2027-03-11 with no mechanism watching. | M |
| 15 | **Packages: live, switched on, never used once.** `NEXT_PUBLIC_PACKAGE_AUTHORING="true"` in prod and `/vendor-dashboard/packages/new` is handled (`isNew = packageId === 'new'`), yet `vendor_packages` = 0 and `vendor_package_items` = 0. | NEVER EXERCISED | `select count(*) from vendor_packages;` → 0 · `grep -n "isNew = packageId === 'new'" apps/web/app/vendor-dashboard/packages/\[packageId\]/page.tsx` | The shop's main pricing instrument is untested by any real supplier. | M |
| 16 | **Services in production are bare shells.** The 2 live `vendor_services` rows have `title = NULL`, and **every** structure table is empty: `_inclusions`, `_addons`, `_discounts`, `_price_brackets`, `_time_slots`, `_payment_schedules`, `_attributes` — all 0. | NEVER EXERCISED | `select count(*) from vendor_service_inclusions;` (repeat per table) | "Services, packages and prices" — the thing a couple actually shops — is unexercised. | M |
| 17 | **Contracts: never exercised.** `vendor_contracts` = 0. Upload → `publishContractToCouple` → a SQL trigger stamps `event_vendors.contract_signed_at`; that stamp is **0 of 51**. ⚠ There is no e-signature — "signed" means a contract row went active, not that a person signed anything. | NEVER EXERCISED | `select count(*) from vendor_contracts;` → 0 · `grep -n "SET contract_signed_at" supabase/migrations/20270217864104_contract_booking_link.sql` | The booking handshake's paper half is unproven and its name overclaims. | M |
| 18 | **Payouts are retired but the Earnings page still renders a payout section.** The 3-stage model was retired at the 2026-05-28 V2 cutover (the page's own docblock says so). `vendor_payouts` = 0 and `dispatchVendorPayouts` has exactly one caller, an admin action. | DECIDED-UNBUILT | `grep -n "Retired 2026-05-28 V2 cutover" apps/web/app/vendor-dashboard/earnings/surface.tsx` | A permanently empty money section trains the supplier to distrust the page. | S |
| 19 | **`is_published` is vestigial but still leaks to suppliers.** `isShopLive` reads `public_visibility` + `verification_state` only, and explore notes the legacy boolean "is no longer queried here" — but `/api/v1/vendor/profile` still returns it. SetnaProd is **live** with `is_published=false`. | BROKEN (minor) | `grep -n "is_published" apps/web/app/api/v1/vendor/profile/route.ts` · `select business_name, is_published, public_visibility from vendor_profiles;` | A supplier reading their own API is told "not published" about a live shop. | S |
| 20 | **Day-of Papic capture + per-guest delivery are ON and never used.** Both `data_privacy_controls` rows read `status='active'`. `vendor_papic_captures` = 0, `vendor_guest_deliveries` = 0, `vendor_dayof_configs` = 0. | NEVER EXERCISED | `select control_key, status from data_privacy_controls where control_key in ('vendor_papic_capture','vendor_guest_delivery');` | ⚠ Contradicts the brief's "two OFF switches". See § Contradictions. | M |
| 21 | **The booking-fee send-gate is dormant with zero callers — re-measured, still true.** `bookingFeeSendGate` is referenced only by a comment. The fee's single trigger is the lock, deliberately, to prevent a double charge. The code is right; the comment claiming the flags are off is stale. | DECIDED-UNBUILT (correct) | `git grep -n bookingFeeSendGate -- apps/web/app` → 1 comment only | None — but the stale comment invites a wrong re-derivation. | S |
| 22 | **Branches, crew and manpower are entirely unexercised.** `vendor_branches` 0 · `manpower_gigs` 0 · `vendor_lines` 0 · `registered_crew_devices` 0 · `vendor_event_sets` 0. `vendor_team_members` = 2. | NEVER EXERCISED | `select count(*) from vendor_branches;` (repeat) | The multi-location/multi-crew story is untested. | L |
| 23 | **Disputes, change orders and handovers never exercised.** `vendor_disputes` 0 · `vendor_change_orders` 0 · `booking_handovers` 0 · `vendor_reuse_requests` 0 · `vendor_date_waitlist` 0 · `vendor_calendar_blocks` 0. | NEVER EXERCISED | `select count(*) from vendor_disputes;` (repeat) | Every conflict path is unproven; these fire first when a real booking goes wrong. | L |
| 24 | **Two supplier pages are "Coming soon" in full.** `real-stories` and `recaps` render nothing else. Honest, but they occupy menu slots. | NOT BUILT (honest) | `grep -n "Coming soon" apps/web/app/vendor-dashboard/real-stories/page.tsx apps/web/app/vendor-dashboard/recaps/page.tsx` | Low — labelled correctly. | M |
| 25 | **Instagram connect is inert.** No `META_APP_*` in the production env, so the card renders its "Coming soon" placeholder. | NOT BUILT (honest) | `grep -n "Coming soon" apps/web/app/vendor-dashboard/_components/instagram-connect-card.tsx` | Low — labelled correctly. | M |
| 26 | **A lapsed tier keeps its public benefits until someone logs in.** `sweep_vendor_tier_expiry` is login-driven by design and well documented, but `/v/[slug]` and `sitemap-vendors` can serve a lapsed shop's tier benefits indefinitely. SetnaProd expires **2026-10-19**. | DECIDED-UNBUILT (deliberate) | `grep -n "sweep_vendor_tier_expiry" apps/web/app/v/\[slug\]/page.tsx` | Small, bounded, and already reasoned about in the tree. | S |
| 27 | **`pending_tier` is shown to the supplier but the ladder lives only in SQL.** The subscription page reads `pending_tier`; no TypeScript writes it. It is written and cleared by `the_plan_change_ladder` SQL functions. **Not a defect — recorded so the next session does not "fix" it.** | BUILT (SQL-side) | `grep -n "pending_tier" apps/web/app/vendor-dashboard/subscription/page.tsx` · `grep -n pending_tier_scheduled_at supabase/migrations/20271177335213_the_plan_change_ladder.sql` | None. A TS grep cannot see it. | — |
| 28 | **51 `event_vendors` rows, only 2 linked to a real shop.** Everything else is demo/manual/directory. Any supplier-side aggregate has therefore only ever been rendered against near-empty input. | NEVER EXERCISED | `select count(*) filter (where linked_vendor_profile_id is not null) from event_vendors;` → **2** | Every count, median and ranking on the supplier side is unproven at scale. | — |

---

## VERIFIED LIVE (the brief's known-context, re-measured — do not rebuild)

| Claim | Verdict | Evidence |
|---|---|---|
| The booking fee is charged at lock and the rail works | ✅ **TRUE** | Ledger ordinal 6: base ₱16,750 → `fee_paid_total_centavos = 83750` (₱837.50, 5%). Order `vendor_booking_fee__6a8e0ec9…` status `paid`. |
| The bill is findable | ✅ **TRUE** | `app/vendor-dashboard/booking-fees/page.tsx` + `[orderId]/page.tsx` exist and read the supplier's own fee orders. |
| Both booking-fee switches | ✅ **ON** — `NEXT_PUBLIC_BOOKING_FEE_ENABLED="true"`, `NEXT_PUBLIC_BOOKING_FEE_RAIL_LIVE="true"` (the latter set 3 days ago). `isBookingFeeEnforced()` is **TRUE** in prod. |
| Packages work and are switched on | ✅ **TRUE** | `NEXT_PUBLIC_PACKAGE_AUTHORING="true"`. (But 0 have ever been made — row 15.) |
| Admins are told when an application is submitted | ✅ **TRUE** | `notifyAdminsApplicationSubmitted` is called in `submitApplication`. |
| A waived free-5 booking shows what it would have cost | ❌ **NOT TRUE** — see row 5. |

---

## CONTRADICTIONS WITH THIS REPO'S DOCUMENTS

1. **"The fee gates the event's supplier surfaces behind two OFF switches."** Nothing
   supplier-facing is behind an off switch. Both booking-fee flags read `"true"`, and the
   two day-of capability controls (`vendor_papic_capture`, `vendor_guest_delivery`) are
   both `status='active'`. The gate is **armed**, not dark.

2. **"A waived free-5 booking now shows the amount it would have cost."** It does not.
   `highest_declared_centavos` has **zero readers anywhere in the application**, and a free
   booking creates no order, so it produces no row on the bill at all.

3. **`lib/booking-fee-gate.ts` says "The fee is off until this flag is set (default off)"**
   and `proposals/actions.ts` says "the block was inert while the two-key flags are off".
   Both assert a production state that is no longer true. The *code* is still correct — the
   send-gate was retired to keep a single trigger at lock — but the comments are stale, and
   this repo has been burned before by a comment read as a measurement.

4. **`CLAUDE.md`: "6 orders as of 2026-08-29"** → now **9**. Re-measure with
   `select count(*) from orders;`, never trust the line.

5. **`lib/vendor-earnings.ts` docblock: "Once the schema links event_vendors →
   vendor_profiles we can refine this."** That link **already exists**
   (`linked_vendor_profile_id`, populated on 2 rows). The stale "V1 simplification" is now
   defects #1 and #2.

6. **Memory: "BOOKING_FEE_RAIL_LIVE was never the blocker — a send-gate with zero callers."**
   ✅ Re-measured and still true.

---

## ⚠ THE FREE-5 LEDGER WAS SEEDED BY HAND

`booking_fee_ledger` ordinals **2, 3, 4 and 5** are synthetic: UUIDs
`54200000-5342-4000-8000-00000000000{2,3,4,5}`, `event_id = NULL`, all four stamped at one
instant (`2026-09-19 11:24:17.767775+00`). They were inserted to burn the free-5 allowance
so the paid path on booking #6 could be reached.

That test succeeded and the paid path works. But it means **bookings #2 through #5 on a real
shop have never been exercised** — nobody has seen what the product does across the free
window, which is exactly where every real supplier will spend their first months.

```sql
select booking_ordinal, event_id, is_free_booking, created_at from booking_fee_ledger order by booking_ordinal;
```

---

## WHAT I COULD NOT VERIFY

- **I did not render a single page.** Every UI claim here is read from source plus the
  database. Nothing was confirmed against a live browser session as a logged-in supplier.
  Per this repo's own rule, **a flag's default in code is not its value on screen** — the
  env values above are decisive for the flags, but the *rendering* is not.
- **I ran no test suite** (one heavy slot, shared with live sessions). The guard gap in
  row 3 is read from the assertion text, not from a mutation run. It should be proven by
  sabotaging `fetchVendorEarnings` and confirming `reads-are-honest.test.ts` stays green.
- **The cross-vendor leak (#2) was not executed.** It is read from the admin-client code
  path. Confirming it needs a second shop sharing a category with the first.
- **`RESEND_API_KEY` is set but unreadable from a session.** I cannot confirm any email
  actually arrives — only that the allowlist includes `vendor_status_change`.
- **`VENDOR_TIER_FEATURE_GATE` is absent** from the production pull. Absence is decisive
  for "off", but I did not check for a project-level or branch-level override outside the
  `production` scope.
- **I did not check the mobile/PWA supplier surfaces separately**, nor `is_internal`
  behaviour — the owner's accounts pass paid gates, which is part of why these gaps survived.
- **I did not open any PR or change any code**, per the session's scope.

---

*Compiled 2026-09-21 · read-only · no app code changed · no PR opened.*
