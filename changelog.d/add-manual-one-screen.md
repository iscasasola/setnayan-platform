## 2026-09-20 · feat(add-manual): the payment plan, the services search, and a sheet that moves

Owner, refining the one-screen "Add manually" popup:
*"services covered initially places it to the category you manually added then
add more to search more service that might be included on their package."* ·
*"Payment Plan Must set date for until the payment is fully paid. just like on
our quote maker."* · *"make sure it is fully animated as well."*

**The payment plan is real instalments, not a note.** `buildCouplePaymentPlan`
turns the couple's typed rows into `event_vendor_payment_plan.instances_json` —
the same table `finalizeVendor` freezes a marketplace booking's plan into, and
the one `paymentScheduleSource` already renders. Dates come from
`computePlanInstances`, the quote maker's own resolver, so `on_lock` /
`before_event` mean exactly what they mean there and nothing re-derives a date.
Relative anchors over calendar dates, per the owner, so a plan self-corrects
when a wedding date moves.

Two rules carry the feature, and both are sabotage-verified: **a plan must add
up to the price** (±₱1, because three rows of "a third" can never be exact) and
**every payment needs a day**. A short plan would let the couple pay the last
instalment and read the booking as settled while part of it was never
scheduled; an undated one is the untracked plan the owner asked us not to
build. `before_event` with no event date is refused with the fix named.

**Services covered is seeded then searched.** The earlier pass rendered 30+
plan groups as toggle chips — a paragraph of pills to hunt through for the two
that apply. Now the booking's own category is present, locked and un-togglable
(it is a fact, not a choice, and is deliberately not persisted — `bucketForVendor`
reads `covers_plan_groups[0]` as the money bucket), and anything else is a
search away.

**The sheet moves.** The Add-a-contact modal had no entrance at all. It now
reuses the maker's own motion — `sn-canvas-rise`, 280ms — rather than inventing
a second vocabulary, with fields staggered behind it.
🔴 `backwards`, never `both`: `both` holds the transform after the run, which
makes the element a containing block for every `position: fixed` descendant —
measured on production 2026-09-18, that put a coach-mark 341px below the fold.
`the-add-manual-sheet-is-animated.test.ts` fails CI on `both`, on a missing
fill mode, and on a motion class defined but not worn.

**Two guards caught this work and both were right.** The roster guard refused
the plan action until its price came through `agreedTotalNow` rather than the
raw column. And `the-payment-note-is-inert.test.ts` refused a single file that
wrote both the inert method note and the real plan — indistinguishable, to a
file-level check, from one piping the other. The fix was to SPLIT them
(`payment-plan-actions.ts`), restoring the guard's meaning instead of widening
it; the two genuinely have different blast radii. That guard also convicted its
own documentation twice, so it now strips comments before scanning — a rule
that punishes writing it down teaches people not to write it down.

SPEC IMPACT: `DECISION_LOG.md` — (h) the couple's payment plan for a
self-added supplier is real instalments in `event_vendor_payment_plan`, with
quote-maker anchors, that must sum to the agreed total and carry a due date
each; (i) services-covered is seeded with the booking's own category (locked,
not persisted) and extended by search.
