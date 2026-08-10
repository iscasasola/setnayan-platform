## 2026-08-11 · feat(onboarding): the Papic services step becomes a picker — pick your shots and cameras, pay after

Owner, this session: *"how many shots do you want for this event? 50 - Free … then they can
press + and minus. which will set how much they will pay. Or papic one (pick how many papic
one) they want to add. so this can be their paywall for the onboarding. can add more later."*

**RULE 0 first — almost none of this was new.** The screen already ships
(`app/onboarding/_shared/services-step.tsx`, live on all three flows). The − / + stepper with a
running total already ships too, on `/pricing` (`_papic-estimator.tsx`), display-only. The whole
apply-then-pay Papic purchase machine already ships (`purchasePapicPoolTopUp` ·
`purchasePapicOneCamera` · the guest buy path). What was missing was the JOIN: the onboarding
card *informed*, it never *asked*. Nothing was redrawn.

### It asks, it does not block

Paying is a bank / GCash transfer a human reconciles — up to 24 hours. A step that refused to
finish until the money landed would lock every new couple out of their own dashboard overnight.
So the free floor is always a complete, finishable answer; the order is minted **alongside** the
event, never in front of it, and the couple lands on their Papic studio with its existing payment
banner. Buy nothing and it is the ordinary dashboard landing, unchanged.

### + and − walk the ladder, not single shots

There is no SKU for an arbitrary shot count — the Pool sells whole blocks. A free-running counter
would display a quantity that cannot be ordered, priced or granted. So a step IS a rung: step 0 is
the free grant alone, each + adds the next live rung, and the free grant is ADDED to every step
rather than replaced by one. A rung an admin retires shortens the ladder instead of putting an
unbuyable step in the middle of it. All of that arithmetic is pure and unit-tested in
`lib/papic-onboarding-selection.ts` (21 tests).

### 🔴 The database only allowed ONE camera per order

"Pick how many Papic One" has to mint ONE order with ONE reference code — N orders would hand a
brand-new couple N separate bank transfers. `papic_one_orders.order_id` was the PRIMARY KEY, so the
second camera was refused outright (`23505`). Migration `20271128697126` widens the key to
`(order_id, seat_id)` and makes `papic_grant_camera_points` iterate every row instead of reading
one — which is now load-bearing, since with several rows and the old single-row read the cameras
after the first would be provisioned, paid for, and funded with nothing.

⚠ **A correction is recorded in the migration itself.** The first draft claimed the function had a
silent multi-row bug. It did not — the single-row read was correct for a table whose key permitted
one row. The database was REJECTING, not miscounting. Writing the test first is what caught it.

🚨 **And the first draft silently reverted a security fix.** It was written against the function's
ORIGINAL definition (`20271019231590`) and so dropped the 2026-08-06 cross-event guard added in
`20271114597183` — `CREATE OR REPLACE FUNCTION` replaces the whole body. Only
`papic-camera-grant-authz.db.test.ts`'s source assertion caught it. **Before replacing a function,
find the LAST migration that defines it, not the one that created it.**

### Guarded

- `papic-one-multi-camera-grant.db.test.ts` — 6 tests, **mutation-tested**: reverting the loop to
  the single-row read turns 3 of them red, including the headline one.
- `papic-onboarding-selection.test.ts` — 21 tests over the ladder, the clamps and the untrusted
  parse boundary.
- The controls render **only** where the mount passes `selection` + `onSelectionChange`, i.e. only
  where the commit actually carries the pick through to an order. The wedding and `simple` flows
  keep today's read-only ladder until their commits are wired — a stepper that changes a price and
  charges nothing is a fake door.
- SEC-4 holds: the browser posts service_codes and a count and **no amount**. Every rung is
  re-resolved from the live tier tables and every price from the ACTIVE catalog server-side, with
  `is_active` checked before an order exists.
- The camera order **fails closed**: if fewer seats are provisioned than were bought, the order is
  cancelled rather than left standing as a charge we cannot fulfil.
- Order minting is **non-fatal by contract** — the event and both free grants are committed first,
  so nothing here can cost a couple their event.
- The purchase intent is deliberately **not** persisted into the localStorage draft: a resumed
  draft must not silently still be buying the biggest pool from a session days ago.

### Reverses two owner locks, at the owner's instruction

The 2026-06-21 *"no paywall in onboarding"* ruling and the 2026-07-27 *"Papic informs, never sells /
NO checkout in onboarding"* ruling. The rest of both stands: `PAYWALL_SCREENS` in the wedding shell
is untouched and the retired bundle / à-la-carte tail stays out of the funnel. What comes back is
ONE product's ladder, on the screen that was already showing it.

SPEC IMPACT: `DECISION_LOG.md` row for 2026-08-11 (the reversal + the picker shape) and
`Onboarding_Papic_AI_Cards_BUILD_SPEC_2026-07-27.md` § 3 Card 1, whose "**Action:** none. It is
already on. The card informs." is now superseded.
