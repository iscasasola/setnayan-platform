## 2026-09-20 · fix(money): a charge that carries centavos prints its centavos, everywhere it is named

🔴 **The owner saw it live.** `/vendor-dashboard/booking-fees/7d1a014d-54ec-4e66-b882-03a085f5f7ca`
— order `S89O-DW67KBQADN`, reference `SN9B7485DD`, charge `booking_fee_charges.amount_charged_centavos
= 83750`, `orders.requested_total_php = 837.50`, `payments.amount_php = 837.50`. The page printed
**₱838**: once under the headline *Amount to send*, once inside the copyable PAYMENT INSTRUCTIONS
block, once on the payment-log row.

🔑 **That is not a wrong label — it is an instruction to send a different amount than the system
recorded.** A supplier who does as told transfers ₱838 against a ₱837.50 charge and every
reconciliation after it is 50 centavos out.

- `lib/orders.ts` · `formatPhp` now prints centavos exactly when the amount has them. The rule is
  not new: it is the one SQL `public.booking_fee_php_text` (migration `20271177298989`) and
  `pesoText` in `lib/setnayan-gift.ts` already use — `1500.5 → ₱1,500.50`, `50 → ₱50`. A whole
  peso renders byte-for-byte as before, so no screen that was right has changed. The digits come
  from `toFixed(2)`, the same rounding `payAmount` uses for the `/pay` QR's EMV tag 54, so the fee
  page and the QR a supplier lands on agree structurally rather than coincidentally.
- `/vendor-dashboard/booking-fees/[orderId]` · the **Copy** button beside *Amount to send* copied
  `String(837.5)` → `"837.5"`. Now `.toFixed(2)` → `"837.50"`. **Decision: the copyable ask keeps
  its centavos and is never rounded** — GCash and BDO both accept a centavo amount, rounding down
  underpays the charge and rounding up overpays it.
- `app/admin/payments/_components/inbox-matcher.tsx` · deleted a **third** private peso formatter
  (`min 0 / max 2`) that rendered the same charge as `₱837.5` while the fee page said `₱838` and
  the QR carried `837.50`.

🔴 **One rounded number was COMPARED, not merely displayed.** The same matcher's amount tier keyed
on `String(Math.round(p.amount_php))` — for this fee, the literal `"838"`, a figure in no row of
`payments`, `orders` or `booking_fee_charges`. It cannot find this transfer by it, and it CAN find
somebody else's genuine ₱838 transfer, which the desk is then offered as a match. The forms now
come off the exact string (`3999.00` → `"3999"`, `837.50` → `"837.50"`), so each is a truncation
of the real digits rather than an invented neighbour. The rule moved into the pure
`lib/payment-amount-forms.ts` because the component is `'use client'` and a guard on it could
otherwise only grep. **Nothing rounded was ever WRITTEN** — `/pay` inserts the order's own
`amountPhp`, the fee order stores `centavos / 100`, and every `Math.round` on the path is
`× 100` centavo precision.

Guard: `app/vendor-dashboard/booking-fees/the-exact-peso-reaches-every-surface.test.ts` — 16 tests,
each sabotage-proven. It executes the formatters rather than grepping them, **counts** the three
mounts on the fee detail page, pins the copy value, forbids a private peso formatter or a
peso-level round on five money surfaces, and runs the match rule against a real ₱838 alert.

SPEC IMPACT: None. `booking_fee_php_text` already documented this rule; this makes the app's shared
formatter agree with it.
