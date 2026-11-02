## 2026-08-20 · fix(orders): deleting a celebration no longer strands its unpaid order

`orders.event_id` is `ON DELETE SET NULL`, so removing a celebration did not take
its orders with it — it **detached** them. The order stayed alive, still
`submitted`, still owing money, with its event link wiped.

That matters because **a buyer's only route to an order is
`/dashboard/<eventId>/orders/<orderId>`**, and there is no account-level orders
page at all (`/dashboard/orders` is a 404 even signed in). So the customer kept
the debt and lost the one screen naming the amount, the reference code and where
to send the money — while the order sat in the admin queue attached to nothing.

**Not hypothetical.** It happened in production on 2026-08-20 to a real ₱499
order, found by walking the product with a signed-in account — the first defect
this project has found from inside the login.

⚖ **Cancel, not block.** The money gate on deletion deliberately admits an unpaid
order; blocking would trap somebody who just wants a test celebration gone. And
nothing is lost by cancelling: an unpaid order has unlocked nothing, since only
`paid`/`fulfilled` ever activate a service. This ends a commitment that could
never have completed rather than destroying a live one. **A paid order still
blocks the delete outright, untouched.**

The buyer is told, in-app **and by email** — `order_cancelled` is on the email
allowlist because an order whose event no longer exists leaves no screen for a
tray badge to be noticed on.

⚠ Scoped to `submitted` / `awaiting_payment` only, idempotent and race-safe
through the status filter, and non-fatal: refusing to delete because a tidy-up
failed would strand the person instead of the order.

9014 unit tests passing, typecheck exit 0, lint clean.

SPEC IMPACT: None — the 15-day question this was originally bundled with turned
out to belong to the vendor lock request, not to in-app orders (owner
2026-08-20), and is tracked separately.
