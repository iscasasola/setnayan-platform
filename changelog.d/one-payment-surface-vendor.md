## 2026-09-20 · fix(pay): the booking fee and the plan order stop handing out a code of their own

Owner: *"how about booking fee?"* — it was one of three surfaces still drawing
its own QR, and the worst part was which QR.

- `app/vendor-dashboard/booking-fees/[orderId]/page.tsx` — a "Payment
  instructions" block printed both receiving accounts beside their STATIC codes.
  A static code carries **no amount**: it is the ₱0 scan the owner hit on this
  very lane (*"the amount is not filled up. it only shows 0."*, paying a real
  ₱837.50 booking fee). It also told the supplier to "log it below" — the form
  it meant moved to /pay on 2026-08-21, so the instruction pointed at nothing.
  The bill's own facts (amount, reference, both copyable) stay; sending the
  money is the "Paying this fee" link that was already there.
  `FileUpload` / `SubmitButton` / `hasMerchantPaymentInfo` went with it — dead
  imports left behind by that August move.
- `app/vendor-dashboard/subscription/page.tsx` — two `PayBox` tiles did the same
  for a plan order, with no way to send proof at all, and **no link to /pay**.
  Replaced with "Send your payment" → `/pay/<reference>`.

Both now reach the one payment page, which mints the code with the figure inside
it and takes the screenshot.

⚠ **Still holding its own surface:** `app/papic/order/[token]/page.tsx`, the
account-less guest's order. It is the only door onto orders minted before an
account was required, so moving it is a decision, not a cleanup — listed, not
silently changed.

Guard: `one-payment-surface.test.ts` gains a third test — neither vendor page may
reference `settings.*_qr_url` or a receiving account number again, AND each must
still call `payPath`, so removing a tile can never strand a payer. Sabotage-proven
in both directions. `port-control-baseline.json` regenerated: `PayBox` leaves as
one readable line.

SPEC IMPACT: None.
