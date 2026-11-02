## 2026-08-21 · feat(payments): every shop purchase now lands on the ONE payment page

Owner: *"this can apply to all purchasable buttons."* Twelve places in the product take money.
Before this, **one** of them showed a payment page; the rest quoted a reference code and left the
buyer to work the rest out. Six more now land on `/pay/<reference>`: **extra team seat · additional
branch (buy and renew) · Vendor AI · 3D Booth · Deep Search · the negotiated Custom plan.**

Scoped from a twelve-path map (one reader per path, then a synthesis that re-verified every
load-bearing claim against prod).

### 🚨 The shared fix that had to land first — /pay was broken for almost every path

Eight buy paths INSERT an **empty placeholder `payments` row** at checkout — no screenshot, no
reference, `status` `'pending'` by column default. `/pay` asked *"does any payment row exist?"*,
so every one of those buyers would have arrived at **"We're checking your payment… Nothing else to
do"** — thanked for money they had not sent, with the upload form gone.

The honest question is whether **they** told us something: a picture, or a number. Fixed in the
one place instead of deleting eight inserts, so it also survives the next path that pre-mints.
(The plan purchase is the one path that does not pre-mint, which is exactly why it was the one
that worked.)

### The other shared work

- **The coordinator gate no longer fires on a person paying their own order.** It exists so a
  coordinator without the couple's payment permission cannot log a claim on the *couple's* order.
  It asked only *"does this order carry an event?"* — so a supplier paying Setnayan on a
  couple-scoped order (a Papic Challenge sponsorship, a booking fee) was refused **in the couple's
  words**, on a page where no couple is involved. `coordinator_consent_money` is `active` in prod,
  so this fired for real.
- **The page says who it is for, and what is in it.** `who` and `rows` were declared and never
  filled, so it could name nobody and itemise nothing — wrong for the onboarding basket (the one
  genuinely multi-item bill, which collapsed into a run-on headline) and for every event-scoped
  purchase, where the payer needs to know *which* celebration their money is for.
- **An anonymous draft session is turned away**, as couple checkout already does before it will
  mint an order. A payment page must not be the one door that takes money from a session the buyer
  loses by closing the tab.
- **The page is no longer a dead end** — a way back to the celebration or the shop.
- `lib/pay-path.ts` — one place that builds the address, so a dozen call sites cannot each encode
  a reference differently.

### 🔒 A free grant is never sent to a payment page

`compOrderRowFor` stamps `status: 'paid'`, which reads as SETTLED — so a shop that just switched a
feature on for **free** would have been greeted with *"This one is settled — there's nothing left
to send."* Every one of these paths has a free branch (first cycle free, first-5-free, the free
Deep Search run); each returns before the redirect, and a guard now asserts that ordering.

### Tests

- `lib/every-buy-button-lands-on-the-payment-page.test.ts` (4) + 4 new page assertions + 2 on the
  path helper. **Five sabotages, each measured by occurrence count** (placeholder-is-proof 1→0 ·
  coordinator scope 1→0 · anonymous check 1→0 · one path stops paying 1→0 · dead panel 0→1), all
  five RED, baseline and restore green.
- **9,272 unit tests green.** Typecheck and lint clean.

### Deliberately NOT converted — and why the owner should hear it

- **The guest buying Papic shots with no account.** `/pay` needs a sign-in and the order is minted
  with no owner; `orders` has **no grants to `anon` at all**, so widening a policy would not even
  reach the wall. Their bearer-token link *is* their way back. The honest fix from the other
  direction — putting the amount-carrying QR on that page too — is follow-on work, not a
  conversion.
- **Couple checkout (the inline drawer).** It already mints an amount-carrying QR inline, and
  `requested_total_php` is the **pre-voucher** base while the real charge is discounted — a
  redirect today would QR-charge a couple who used a code the **full** price. Needs the amount
  reconciled first.
- **The booking fee.** The owner ruled on 2026-08-06 that the **full** bank reference is required
  there; `/pay` asks for the last six. That is an owner call, not a port decision.
- **Every ₱0 branch**, above.

SPEC IMPACT: `DECISION_LOG.md` — appended to the 2026-08-21 ONE-payment-page row.
