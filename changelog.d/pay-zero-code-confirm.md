## 2026-11-22 · feat(pay): a code that covers the whole price — "nothing to pay" + Send for confirmation

Follow-up to #8130 "EVERY PAYMENT WALL TAKES A CODE" (controller, 22 Nov 2026).

- **₱0 route.** A code that covers the whole price is now applied like any other. `/pay/[reference]` then shows
  "Your code covers this — nothing to pay" with ONE button, "Send for confirmation". It writes a ₱0 payment row on
  channel `voucher` into the existing `/admin/payments` queue and alerts the admins; an admin's approval is still the
  only thing that marks the order paid (a leaked 100% code switches nothing on by itself). No Maya and no receipt
  upload on that route: the page keeps both off it, and the Maya start refuses a ₱0 bill itself. One row per order
  (a fixed idempotency key). Rides the page's existing form action — no new server action.
- **Migration `20271357859993_pay_zero_code_confirm.sql`.** (1) `payments.amount_php` check relaxed from `> 0` to
  `> 0 OR (= 0 AND channel = 'voucher')`. (2) `pay_reprice_order_with_code(order, code, centavos)` — the code box's
  re-price as one statement that re-checks, inside the update, that no Maya checkout is open (review low 1: closes
  the two-tab race). service_role only.
- **`?code_error=` is a key from a fixed list** (review low 2). The page draws the message from `PAY_CODE_ERRORS`;
  words in the URL are never drawn.
- **A bill's empty placeholder row no longer hides the code box.** Eight buy paths write a blank `payments` row at
  checkout; #8130 counted it as "a payment was sent", so those bills never showed "Have a code?". Both the page and
  the server now ask `paymentWasLogged`.

SPEC IMPACT: None (the ₱0 ruling is logged in the specs DECISION_LOG by the controller).
