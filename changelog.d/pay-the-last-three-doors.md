## 2026-08-21 · feat(payments): the last three doors — the couple, the guest, and the booking fee

Three owner rulings, in his own words: *"guest needs to have an account to buy"* · *"yes. couple
can purchase with the custom qr"* · *"yes"* (the booking fee). Every purchase in the product now
ends on `/pay/<reference>`, except free grants — which must never land there.

### 🚨 A money bug found on the way: the couple would have been QR-charged the undiscounted price

`orders.requested_total_php` is the **pre-VAT, PRE-VOUCHER base** on couple checkout — the original
price is stored there and the discount lives in `voucher_discount_centavos`, while the figure the
couple is actually charged is the voucher-adjusted base grossed by VAT. Reading the raw column onto
a payment page puts the **full** price inside the QR for anyone who used a code.

The rule now lives in `lib/payable-amount.ts`, **pure and unit-tested**, using the product's own
two conventions (vendor SKUs are quoted all-in, owner-locked 2026-07-05; customer SKUs gross at pay
time via `isVatInclusiveServiceKey`). 🪤 **It was inline first, and a sabotage deleting the voucher
subtraction left every test GREEN** — which is why it was extracted. VAT is 0.00 in prod, so the
VAT half is inert; **the voucher half was live.**

### The couple

Their order page rendered the **static** merchant QRs carrying no amount, and a form asking them to
type the amount, type a free-text channel (*"BDO, GCash, Cash, etc."*) and type the **full**
reference number. That block is replaced by one button to the payment page.

**Kept**: what they were charged, the resubmit banner with the admin's note, the receipt, Cancel,
and the payment log — that half is the RECORD, not the till.

🪤 **The guard caught a defect in my own removal**: the resubmit banner still said *"use the Log a
payment form below"*, pointing at a form I had just deleted. Now it links to the payment page.

### The guest

Buying shots requires an account (owner). Nothing live changed — `NEXT_PUBLIC_PAPIC_GUEST_BUY` has
never been on — and it is what makes the page reachable for them at all: an account-less order
carries no `user_id`, `orders_owner_read` has no disjunct that admits it, and **`orders` grants
nothing to `anon`**, so its own buyer got a 404 on the order they had just placed. The refusal
sits BEFORE the reference is minted, so somebody who goes off to sign in never returns to a
half-made order. The shell copy that promised *"you don't need an account"* now says the opposite.

⚖ **SETTLING an order that already exists is untouched.** The token page stays, and
`submitPapicGuestPayment` still works — a rule about NEW purchases must never strand a debt
somebody already owes. Same boundary the 2026-08-21 finished-event ruling drew. A test asserts it.

### The booking fee

⚠ **A correction to my own earlier framing.** I said the owner's 2026-08-06 rule required the
**full** bank reference; it does not. `requireBookingFeeReference` sets **no format and no minimum
length** and says so in its own docblock — six characters is a matching heuristic, not a validity
rule. What the owner required is that a reference is **PRESENT**. So the rule and the last-six
field never conflicted.

The fee page now leads to the shared page, where the reference is **required on that lane and
optional everywhere else**, and a pasted full number is **kept, not trimmed to six** — six is a
minimum a person can read off a receipt, not a maximum we store.

### Tests

- `lib/payable-amount.test.ts` (6, incl. the voucher case and a discount larger than the bill) ·
  4 new page assertions · 2 new cross-path assertions.
- **Seven sabotages, each measured by occurrence count** — account gate 1→0 · bill link 2→0 · fee
  reference 1→0 · truncate-to-six · voucher subtraction 1→0 · all-in respected 1→0 · and the one
  that **stayed green and forced the extraction**.
- The re-pointed guard `the-bill-has-somewhere-to-be-paid` is **re-pointed, not weakened**: from
  the bill there must still be a way to pay.
- **9,282 unit tests green.** Typecheck and lint clean.

SPEC IMPACT: `DECISION_LOG.md` — 2026-08-21 row for the three rulings.
