## 2026-08-28 · feat(vendor-plans): moving UP is prorated and immediate; moving DOWN waits for the term you already paid for

Owner ruling, 2026-08-27, verbatim: *"if the plan is lower (solo) to pro then we prorate. if the original plan is higher pro then downgrade to (solo) then we finish that subscription then the new lower plan start after that pro ends."* Plus: a credit bigger than the bill **carries forward until it runs out** — not capped, not refunded.

Nothing existed for this before. Verified, not assumed: `vendor_profiles` carried no pending-change or credit column of any kind, and `create_vendor_subscription` treated every purchase as a renewal.

**UPGRADE** — the unused value of the plan being replaced comes off the price, the new plan is live as soon as the payment is confirmed, and a **fresh term** starts then. **DOWNGRADE** — nothing changes on the day. The current plan runs to the end of its paid term and the cheaper one begins when it ends.

### And a purchase may never be shorter than the time you already hold

Second owner ruling, same day: *"they cannot purchase a smaller timeline. if they paid for a year. their purchase must cover the same timeline. this means, they cannot purchase a months worth if what they have now is more than a months worth of subscription."*

A purchase whose **term** is shorter than the time remaining is refused. Holding 300 days of Solo annual, the only Pro you can buy is Pro annual; holding 10 days, a 28-day plan is fine. The test is term length against time remaining — not tier, not price — and it applies going up and going down alike.

**Refused at the SERVER**, inside `create_vendor_subscription`, because a hidden option is not a rule; the picker also shows the sentence where the too-short card's button would be, so nobody meets the refusal only after choosing. The refusal names the day — *"You're paid up until 14 June. That plan is shorter than the time you already have, so choose the yearly plan, or come back nearer that date."* — and a person never reads the raw code. **Strictly shorter, never shorter-or-equal:** an exact match is an ordinary same-length renewal and is allowed, pinned in both suites (and one hour past the term is correctly refused).

A lapsed or never-subscribed shop has no remaining time, so every term is legal for them. That **falls out of the condition** rather than needing a case of its own — confirmed by test, not by reading.

⚖ **And one clause in that guard is deliberately redundant, which is recorded rather than hidden.** A mutation deleting `v_expires_at > now()` stayed **green**, correctly: a lapsed expiry makes the remaining interval negative, and no positive term is ever shorter than a negative interval, so the comparison beside it already refuses to fire. The clause stays — it states the lapsed case at a glance and keeps the guard correct if that comparison is ever rewritten — and the migration says so explicitly, **so nobody later "discovers" it as dead code and deletes it believing it was an oversight**. No test covers it in isolation and none can; that is exactly why the reason is written down instead of asserted.

⚖ **A deliberate divergence from the industry norm, chosen knowingly.** The standard behaviour is to allow the switch and turn the unused annual time into carried credit. The owner was shown that and picked the stricter rule, and it is better here because it **deletes** the large-credit case instead of managing it. ⛔ Do not "fix" this toward the norm — relaxing it silently re-creates the standing balance the gate exists to prevent.

**The two rules compose.** A downgrade keeping the same term still defers exactly as before. A downgrade that *also* shortens the term is refused outright, before anything is scheduled — so what a person reads is the refusal, not the "starts when your current plan ends" deferral. Pinned in both directions.

🔑 **And it measurably did what it was chosen to do.** Adding the rule broke the carry-forward test, because that test held a year of Solo and bought a 28-day Pro — the exact purchase now refused. A new test states the property directly: under the term rule an upgrade must buy a term at least as long as the one it replaces, and at equal terms the dearer plan always costs more than the unused value of the cheaper one, so **proration can no longer leave a standing balance at all**. See the note at the bottom on what the realistic maximum credit now is.

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

31 db tests + 17 unit tests. **13 mutations, every one landed and every one RED**, with occurrence counts printed before → after and the file restored from an explicit `cp` backup, run with the tree to itself.

🪤 **Three separate mutations reported DID-NOT-LAND before they could be measured, all the same mistake in different clothes:** `grep -c` is line-based and one pattern spanned lines; one count anchor survived its own replacement (1 → 1); and one counted a line the edit never touches. Every time the honest answer was *this result proves nothing*, not *the guard held*. **Count the thing the edit moves.**

🪤 **And the boundary test could not detect the mistake it existed to catch.** Setting `tier_expires_at = now() + 28 days` in one statement and calling the checkout in the next leaves the expiry microseconds *short* of 28 days, because `now()` advanced in between — so `<` and `<=` give the same answer and the flipped comparison sailed through green. Both statements now run inside **one transaction**, where `now()` is frozen, which is the only arrangement in which the boundary is actually on the boundary. Caught by the mutation run, not by review.

Also fixed: the RA 10173 subject-access export projection, which went red on all seven new `vendor_profiles` columns. They are exported, not withheld — a response omitting a **balance we hold** would be incomplete in exactly the way that matters.

### Open, and flagged rather than decided

🔴 **What happens to carried credit if a shop lapses entirely.** The owner has not ruled. It **persists** — it is money they already paid, and persisting is the reversible choice — and the sweep deliberately does not clear it, with a test pinning that so any future change has to be deliberate.

⚖ **How much money that question is now worth, measured rather than assumed.** The term rule was expected to shrink the maximum credit "from months to weeks". Half of that is right and half is not, so both halves are recorded here:

- **From proration: zero.** Not "smaller" — gone. An upgrade must now buy a term at least as long as the one it replaces, and at equal terms the dearer plan always costs more than the unused value of the cheaper one, so the credit is fully absorbed by the bill and nothing is left over. A test asserts this as a property; if it ever fails, either the term rule was relaxed or a price was moved so a lower tier costs more than a higher one, and both deserve a hard look.
- **From a cancelled scheduled change: one plan term's price, and that is not weeks.** A shop can pay for a same-length downgrade, then call it off, and what they paid becomes credit — realistically ₱10,400 (Solo annual), up to ₱104,000 in the Enterprise-annual edge. That is money they genuinely handed over and have had no service for, so it has to go somewhere; returning it as credit is right. But it means a balance can still be large, and the open question above still has real money behind it.

⚠ Two corrections to the brief this was built from, both measured against production: there are **2 paid subscriptions**, not zero (₱1,000 Solo × 2, stacked, on one shop), and `sweep_vendor_tier_expiry` does not list `solo` among its sweepable tiers, so a lapsed Solo plan never drops today. That gap is pre-existing and untouched here; the applier deliberately does not depend on that list, so a scheduled change lands whatever tier the shop is standing on.

SPEC IMPACT: None on price. Adds a plan-change path to the vendor subscription model — `Vendor_Monetization_Model_LOCKED_2026-07-25.md` describes the ladder and its prices, neither of which moves; the rule for *changing* between rungs was previously unwritten and is now owner-ruled (2026-08-27).
