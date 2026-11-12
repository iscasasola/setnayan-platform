## 2026-11-12 · feat(supplier): the first-login tour walks the four tabs and shows until ticked · founders verification owes papers on 30 Mar 2027

For the owner's first real suppliers (invited from his own event, signing up 13 Nov):

- **The supplier's first-login spotlight (`supplier_spotlight_v1`) is rewritten** to walk Today · Shop · Clients ·
  Portfolio in the order a new supplier fills them in: the set-up list → logo → cover photo → service cards (the ones a
  couple's event brought in) → ⚙ › Your page → the page editor → Clients → an event → its Chat and Quotation tabs →
  Portfolio → back to Today. Same key, so the four page tours still wait for it and never stack.
- **Shows until ticked.** `SpotlightFinale.tick` (new, opt-in): the last card carries "I’ve seen it — don’t show this
  tour again"; only a ticked Done records the tour. Skip leads to that card; closing it unticked hides the tour for this
  visit (`lib/spotlight-later.ts`, sessionStorage) and it plays again at the next sign-in. A replay never shows the box.
- The engine treats a row door (`data-opens-to`, the Clients row on a phone) as a link, so it waits for the event page
  instead of skipping ahead while it loads. New anchors: `shop-logo` · `shop-cover-photo` · `shop-gear` · `shop-services`
  · `shop-your-page` · `customers-event` · `client-chat` · `client-quote` (`PickedShell` takes `tours`). Retired with the
  old steps: `today-next` · `shop-details` · `shop-add-service` · `today-money` stops.
- **Founders verification.** Admin › Verify's "Vouch for them…" is now "Founders verification…": the same Verified badge
  at once, no documents today, the four required papers due **30 March 2027** (`FOUNDERS_PAPERS_DUE_ISO`, end of day
  Manila) for any grant pressed before that day; after it, the six-month window as before (`founderVouchExpiry`).
- **Verification gives Ultra weeks** (owner 12 Nov 2026, on top of the badge's Papic 150 + 4 weeks Papic Challenges):
  founders verification → 3 × 4 weeks of Ultra; regular verification (the four papers approved) → 1 × 4 weeks. The
  shipped comp (`tier_state` · `tier_expires_at` · `tier_source = 'admin_comp'`), so it reads "free until … · from
  Setnayan" and ends by itself. Once per shop, ever (`vendor_verification_plan_reward` audit row checked first); a
  comped Ultra still running is extended; a plan a shop pays for itself is never overwritten
  (`lib/verification-plan-reward.ts`). **The tools, not the gifts** (owner: *"We only give the service but not the
  gifts"*): Ultra's 4-weekly 6 × Papic 150 (`PLAN_PERIOD_GIFTS`, decided, not built) is never part of this reward —
  its docblock now says so, and `planIsVerificationReward` / `readVerificationRewardPlanUntil` let the future payer skip
  such a shop.
- **Today's "What you offer" step can finish.** It asked every service for 3 cards (Good · Better · Best) while a Free or
  Verified shop may make 1 per category — so it said "2 to go" forever. It now counts to the smaller of the two
  (`cardsToCount`).

SPEC IMPACT: DECISION_LOG — "FOUNDERS VERIFICATION" (owner 12 Nov 2026: a founders-verified shop is Verified now and
owes its four papers by 30 March 2027; founders → 3 × 4-week Ultra, regular → 1 × 4-week Ultra) and "THE SUPPLIER FIRST-LOGIN TOUR SHOWS UNTIL TICKED" need rows in the spec
corpus, which this session could not reach. NOT BUILT, owner to confirm: the yearly 30 March deadline for ordinary
document approvals (still the permit date, else one year), and moving the two early shops from 12 to 30 March 2027.
