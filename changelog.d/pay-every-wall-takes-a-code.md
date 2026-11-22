## 2026-11-22 · feat(pay): every payment wall takes a code, and Maya in two taps

**EVERY PAYMENT WALL TAKES A CODE** (owner: *"so check all payment walls and add the enter code"*, DECISION_LOG 00bfe8db). `/pay/[reference]` carries the inline-checkout drawer's collapsed "Have a code?" — on step 1 of the BDO route, and between Order summary and Pay with on the Maya page. Apply posts `intent=apply_code` to the page's existing `submitPaymentProof` (no new server action) → `app/pay/[reference]/pay-code.ts`, which re-prices the UNPAID order through the same voucher engine (`validateAndCalculateVoucher`, `discount_code_redemptions`, `orders.voucher_code_applied/voucher_discount_centavos`, the `voucher_applied` ledger event). It refuses — and the page hides the box — once anything was sent, the order is paid/closed/admin-quoted, a code is already on it, or a Maya checkout is open (that read fails closed: `readOpenMayaCheckout`). A code that would make the bill ₱0 is refused before any write (no free route on /pay yet — open call). A failed check says "We couldn't check that code".

**MAYA IN TWO TAPS** (owner: *"why does it take 3 pay to enter maya. we want it quick and simple"*). With Maya open, /pay opens straight on the approved v3 page (the amount · Order summary · Have a code? · Pay with · the pinned Pay ₱X) — buy → Pay ₱X → Maya. No step 1, no Continue, no stepper on that route; step 1 stays for BDO and the fallback. Merges `claude/pay-step1-follows-maya` (the step-1 Maya wording, `lib/pay-next-steps.ts`), now meaningful for the page back from Maya.

Held by `lib/every-payment-wall-takes-a-code.test.ts`, `lib/pay-step-one-follows-maya.test.ts`, `lib/maya-checkout-wiring.test.ts`.

SPEC IMPACT: None (both rulings are already in DECISION_LOG).
