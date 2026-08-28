## 2026-08-28 · feat(vendor-plans): moving UP is prorated and immediate; moving DOWN waits for the term you already paid for

Owner ruling, 2026-08-27, verbatim: *"if the plan is lower (solo) to pro then we prorate. if the original plan is higher pro then downgrade to (solo) then we finish that subscription then the new lower plan start after that pro ends."* Plus: a credit bigger than the bill **carries forward until it runs out** — not capped, not refunded.

Nothing existed for this before. Verified, not assumed: `vendor_profiles` carried no pending-change or credit column of any kind, and `create_vendor_subscription` treated every purchase as a renewal.

**UPGRADE** — the unused value of the plan being replaced comes off the price, the new plan is live as soon as the payment is confirmed, and a **fresh term** starts then. **DOWNGRADE** — nothing changes on the day. The current plan runs to the end of its paid term and the cheaper one begins when it ends.

**Direction is by PLAN, never by the amount on the order.** It reads the existing `vendor_tier_rank` ladder (free 1 · verified 2 · solo 3 · pro 4 · enterprise 5 · custom 6); no second ranking was invented. An annual Solo at ₱10,400 costs four times a 28-day Pro at ₱2,500, and moving to Pro is still an upgrade — anything keying on price gets that backwards, and a test pins it.

### The applier is the load-bearing half

Recording *"becomes Solo on 19 October"* is easy and worth nothing on its own. `sweep_vendor_tier_expiry` — the login-driven, cron-free lapse sweep that already runs on every vendor dashboard load — did exactly one thing to an expired plan: drop it to verified/free. **Left alone, a shop that scheduled AND PAID FOR Solo would have landed on FREE the day their Pro ended, with nothing erroring anywhere.** The sweep now checks for a due scheduled change *first* and applies it; everything below that branch is byte-for-byte the old lapse, so a shop with nothing scheduled behaves exactly as it did yesterday. `a paid scheduled plan LANDS at term end, and not on free` is the regression test, and it goes red the moment the branch is removed.

**A pending tier is not an entitlement until somebody paid for it.** The applier requires a `paid` purchase that names this shop and this plan; a schedule with no payment behind it is cleared and lapses normally, and the unpaid purchase stays payable — paying it later activates immediately, because by then there is no live plan to wait for.

### The credit maths

`vendor_unused_plan_value_php` **derives** the figure from rows that already exist. Every paid purchase records `amount_php`, `period_days` and the `expires_at` it pushed the plan out to, so its term ran `[expires_at − period_days, expires_at]` and its unused share is the part still in the future. Summing over rows handles **stacked** purchases exactly and can never return more than was paid, because each row contributes at most its own amount. Checked against production while writing it: the two stacked ₱1,000 28-day Solo blocks that exist today tile end-to-end and reconcile to the profile's own `tier_expires_at` to the day.

**The quote is honoured, which is why a number is stored.** Unused value decays hourly; the figure a shop is quoted is the figure they pay. `credit_applied_php` / `credit_carry_forward_php` are written at order time — the same shape `vendor_custom_plans.quoted_28d_php` already has. A quote is a historical fact, not a duplicated derivation; the *live* value has exactly one source and nothing else recomputes it.

**Credit is consumed at activation, never reserved at order time.** A reserve needs an unwind, and one give-back against two reserve sites is how this codebase has leaked value before. Nothing is deducted until the money is confirmed, so an abandoned or rejected change costs the shop nothing and needs no repair. The double-spend that opens instead — two unpaid changes quoting the same balance — is closed by refusing the second (`ONE_PLAN_CHANGE_PENDING`). Activation is a plain **assignment** of the quoted carry-forward figure, so a replayed approval cannot double-count.

When the credit covers the whole bill there is nothing to reconcile, so the change applies on the spot rather than parking the shop in front of payment instructions for ₱0.

### Renewal maths untouched

`GREATEST(now(), tier_expires_at) + period_days` stays exactly as it is for every same-tier renewal and every purchase by a shop with no live plan. Only the upgrade branch starts a fresh term, and it must: the old term's remaining days were just converted into money and handed back, so keeping them too would pay the shop twice for the same days.

### What a supplier reads

Three plain sentences, each shown only when true: what plan they are on, what it changes to **and on what date**, and how much money is sitting on their account with the note that it is spent automatically and does not expire. Built by a pure, unit-tested module — including a test asserting none of them says *proration*, *tier*, *billing cycle* or *credit balance*. A scheduled change can be called off from the same card; what was paid becomes credit rather than being lost, because a change of mind is not a reason to keep somebody's money.

**No stored effective date, deliberately.** The date the change lands *is* `tier_expires_at`. A second copy goes wrong the first time a shop renews their current plan while a change is waiting — the real expiry moves out, the copy does not, and the applier fires early on a plan they are still paying for.

### Four things the guards caught that review did not

🪤 **`CREATE OR REPLACE` on the entitlement guard silently reverted ten columns of protection.** The first cut rebuilt `guard_vendor_profiles_entitlement` from the migration that *created* it (20270920020000) rather than from the live body. That quietly dropped five add-on columns, `verification_state`, `public_visibility`, all three trust-stamp columns and the year-change auto-unverify. **Fifteen db tests went red and named it.** Without them this would have shipped as a security regression dressed as a security improvement. **A function is not its first migration — read the current body out of the database before replacing it.**

🚨 **The exposure freeze caught two SECURITY DEFINER helpers granted to `authenticated` out of habit.** Both take a vendor id as an *argument*, so the grant let any signed-in person aim them at any shop: one returns **pesos** (how much unused plan a competitor is sitting on), the other discloses which plan a shop is on. Neither has a client caller — `create_vendor_subscription` calls them as its own owner and needs no grant. Both are now granted to nobody. *A SECURITY DEFINER function taking an id is a read of somebody else's row wearing a function's clothes.* The baseline was regenerated only after reading every one of the 12 diff lines.

🪤 **`'cancelled'` is not a legal status.** The undo path first wrote it; the CHECK on `vendor_subscriptions` admits `pending_payment | paid | rejected | superseded` and nothing else, so the value would have been refused by the constraint. It is `'superseded'`, and a test asserts the constraint rejects the word that reads better in English.

🪤 **One of my own guards was decoration, and only the mutation run said so.** Gutting the credit arithmetic inside the checkout (`v_carry := 0`) left the whole suite green, because every test built its purchase row by hand and never asked the checkout to price anything — the carry-forward figure the feature turns on was untested at its only real writer. Four end-to-end checkout tests were added and the mutation now goes red. *A test that hand-builds the row it is checking is testing its own fixture.*

### Measurement

21 db tests + 10 unit tests. **9 mutations, every one landed and every one RED**, with occurrence counts printed before → after and the file restored from an explicit `cp` backup. One mutation reported DID-NOT-LAND twice before it could be measured — first because `grep -c` is line-based and the pattern spanned lines, then because the count anchor survived its own replacement — and both times the honest answer was that the result proved nothing, not that the guard held.

Also fixed: the RA 10173 subject-access export projection, which went red on all seven new `vendor_profiles` columns. They are exported, not withheld — a response omitting a **balance we hold** would be incomplete in exactly the way that matters.

### Open, and flagged rather than decided

🔴 **What happens to carried credit if a shop lapses entirely.** The owner has not ruled. It **persists** — it is money they already paid, and persisting is the reversible choice — and the sweep deliberately does not clear it, with a test pinning that so any future change has to be deliberate.

⚠ Two corrections to the brief this was built from, both measured against production: there are **2 paid subscriptions**, not zero (₱1,000 Solo × 2, stacked, on one shop), and `sweep_vendor_tier_expiry` does not list `solo` among its sweepable tiers, so a lapsed Solo plan never drops today. That gap is pre-existing and untouched here; the applier deliberately does not depend on that list, so a scheduled change lands whatever tier the shop is standing on.

SPEC IMPACT: None on price. Adds a plan-change path to the vendor subscription model — `Vendor_Monetization_Model_LOCKED_2026-07-25.md` describes the ladder and its prices, neither of which moves; the rule for *changing* between rungs was previously unwritten and is now owner-ruled (2026-08-27).
