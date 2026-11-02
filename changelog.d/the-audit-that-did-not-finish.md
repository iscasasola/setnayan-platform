## 2026-08-23 · finishing an audit that stopped halfway — two live defects it had not reached

The adversarial review of the payment conversion ran on 2026-08-21 and **17 of its 57 agents died
on a usage limit**, including the whole completeness pass and the verification for two of six
lenses: `redirect-mechanics` and `notify-and-admin`. Those findings were never confirmed or
refuted. **A partial pass is not a clean bill of health.** Both lenses were re-run. Two live
defects survived, and both had the same cause.

### 🚨 A ₱400 PURCHASE THE BUYER COULD NOT PAY

A vendor sponsoring Papic Challenges for a client's event pays ₱400 (free only for their first
five bookings). That button kept the exact panel every other buy button shed: it printed the
amount and the reference and said *"Pay to our BDO or GCash account and put ABC123 in the transfer
note."* — **naming NEITHER account.** No QR carrying the amount, no bank details, nowhere to send
a screenshot. A person had been charged and had no way to pay.

It now lands on `/pay/<reference>` like every other purchase, and the dead panel is deleted rather
than left behind.

### 🚨 A GUEST'S PAYMENT THAT TOLD NOBODY

A guest settling a Papic order uploads a bank screenshot and a reference, and a real `payments`
row is written. The only trace was `revalidatePath('/admin/payments')` — which the notify guard's
own docblock already calls insufficient: *"the only trace was a queue somebody had to already be
looking at."* The daily digest is the net **under** the alert, not a substitute; for "your customer
has paid", next morning is the wrong answer. It now alerts the admins who can confirm it, before
the redirect.

### 🔑 ONE CAUSE, TWICE: A HAND-ENUMERATED GUARD LIST IS A LIST OF THE DOORS YOU THOUGHT OF

Both guards were real, both were passing, and both name their subjects one file at a time.
`PAID_PATHS` listed seven buy paths; **nine files call the paid mint.** The notify guard named
three functions; a fourth took proof and told nobody. Neither guard was broken — each was simply
never told about the door.

So both now ask the question of the **code**:
- every file calling the paid mint `orderRowFor(` must land on the payment page **or** appear in a
  reasoned exception list — and the exception list may not outlive its subject, so a file that
  stops minting loses its row instead of leaving the next reader a stale exemption;
- every file that reads payment proof out of a form **and** writes a `payments` row must alert
  somebody.

Each derived sweep is floored (`>= 8`, `>= 3`), because **a sweep that finds nothing passes
silently** — which is the failure these guards exist to prevent, one level up.

⚖ **One exception is recorded WITH ITS REASON, not smuggled:** the couple's inline checkout drawer
mints an amount-carrying QR inline, takes the screenshot in the same step, and does alert the team.
Converting it would invert pay-then-mint into mint-then-pay and leave an unpaid order in the admin
queue on every abandoned checkout.

### 🧹 A THIRD SURFACE THAT TOLD NOBODY — and a deletion I talked myself out of

`logBookingFeePayment` takes a bank reference and a screenshot, writes a `payments` row, and
alerted nobody. It now alerts, before the redirect and **not** on the idempotent-retry branch —
one payment, one alert.

⚠ **I FIRST DELETED IT, AND THAT WAS THE WRONG CALL.** After the booking fee moved to the payment
page it has **zero references anywhere**, so removing it looked like finishing #4699's job. CI
disagreed for a reason worth keeping: **two guard files read that source, one of them dedicated
entirely to it** — the owner's 2026-08-06 rule that a vendor paying us must give a reference. Six
assertions went red. Deleting the subject would have deleted the coverage, which is the same
mistake as a guard going out with its subject, pointed the other way. Restored, and made to comply
instead.

⏭ **NAMED, NOT SMUGGLED:** the action is still unreachable, and retiring it properly means
re-pointing that dedicated guard at `/pay`, where the reference rule now lives (`requiresReference`
is enforced there). That is a real change with its own reasoning and does not belong inside an
audit fix. The dead import the page still carried IS removed.

🪤 **AND WHILE LOOKING AT THOSE GUARDS I FOUND THE SAME HAND-LIST WEAKNESS AGAIN:**
`payment-proof-ref-tenancy.test.ts` names three call sites, and **`/pay/[reference]/actions.ts` —
now the main proof-taking surface in the product — is not one of them.** It does gate correctly
(`parseClientRef` with `orderPaymentProofPolicy`, verified), so nothing is broken today; it is
simply unguarded. Recorded here rather than fixed, because widening that guard needs its third
assertion generalised (it matches one specific variable name) and that is its own change.

🛡 **All four new assertions mutation-tested and MEASURED, each restored from an explicit backup:**
dropping the new path from the list (1 → 0) turns the derived check RED · removing its redirect
(1 → 0) turns two checks RED · deleting the Papic notify (1 → 0) turns both notify checks RED ·
deleting the booking-fee notify (1 → 0) turns the derived notify check RED. Restored, 40/40 green
across all four guard files. An unmeasured mutation proves nothing in either direction.

✅ **Verified against the DEPLOYED build, not the merge:** production reported serving `0deceeb`,
and all six shop redirects, the shared helper and both guards were read out of **that exact
commit**. The payment page itself was fetched live — a real reference and a fake one both redirect
to sign-in identically, so it cannot be used to test whether somebody else's order exists.

Baseline regenerated: 0 routes, 0 destinations, 0 actions lost. Typecheck clean.

SPEC IMPACT: None — no price, SKU or scope change. One buy path now reaches the payment page every
other purchase already used.
