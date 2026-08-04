## 2026-07-29 · feat(papic): guests can buy Papic from the capture surface, flag-dark

A guest at the party — no account, no intention of making one — can now buy
shots for the event they are standing in, at the SAME rungs and prices the host
pays (owner-locked 2026-07-29). Two shapes: a **pool top-up** into the event's
shared pool (`PAPIC_GUEST` · `PAPIC_GUEST_6K` · `PAPIC_GUEST_10K`) and a **Papic
One reload of THEIR OWN camera only** (`PAPIC_CAMERA_MINI_DAY` · `PAPIC_ONE_100`).
No new SKUs, no new prices, no catalog change.

**The order has no account behind it.** Migration `20271019639608` makes
`orders.user_id` / `payments.user_id` / `receipts.user_id` NULLABLE and adds
`public.papic_guest_orders`, which carries the OWNER AXIS (the claimed camera
seat, or the guest-QR identity) that replaces the missing `user_id`, plus an
unguessable bearer `access_token` — the account-less equivalent of
`orders_owner_read` — and the snapshotted points. `guestOrderRowFor` /
`guestPaymentRowFor` (lib/order-mint-identity.ts) are the third and fourth doors
in the identity-stamping module: they refuse to build a payload unless an event
plus one owner axis resolved, and they still stamp `payments.status = 'pending'`.

**Why nullable and not a second order table:** the admin does not get a second
inbox. A guest order is an ORDINARY `orders` + `payments` pair, so it lands in
`/admin/payments` with no reader change and inherits — unforkably — the shortfall
guard, the promote-to-paid gate, receipt issuance and `activateOrderSku`. A
guest pool top-up is already routed by `service_key` to `grantPapicPassPoints`;
a guest One reload writes the SAME `papic_one_orders` row the host path writes,
so `papic_grant_camera_points` grants it. **`lib/sku-activation.ts` is unchanged**
and the activation gate stands: points appear only when an admin approves a
payment that fully covers what is owed. A short or rejected payment provisions
nothing.

**"Their own camera only"** is enforced twice: the requested seat must BE the
seat the credential resolved (`resolveGuestReloadTarget` refuses a mismatch
outright rather than silently redirecting), and the seat must already hold a
dedicated balance — a pool-drawing camera has none to top up, and granting it one
would silently move it off the pool the host is watching. `event_id` is never a
parameter on either action; it is read off the credential, so no endpoint lets
anyone order against an arbitrary event or enumerate which ids exist.

**Host visibility** needs no new policy: the shipped `orders_owner_read` event
arm already lets the couple/coordinator of an event read every order on it. Now
pinned by a test so a future narrowing cannot take it away silently. The
`payments` row (the payer's bank screenshot) stays invisible to the host — that
is a stranger's receipt.

Surfaces are FLAG-DARK behind `NEXT_PUBLIC_PAPIC_GUEST_BUY` (documented in
`.env.example`). OFF ⇒ the panel renders null, `/papic/order/[token]` 404s, both
server actions refuse, and the seat page skips even the extra balance read — the
capture screens are byte-identical. The exhaustion moment is wired by a
`papic:out-of-shots` window event so the two ~1,400-line capture components did
not have to grow page-level state; with the flag off nothing listens.

Verified locally: typecheck 0 errors · lint 0 new warnings · **5,381/5,381 unit
tests** · **614/614 db tests** (20 new in `tests/db/papic-guest-orders.db.test.ts`,
including a neutralisation proof that a fresh `public` table really does ship
OPEN in the harness, so the REVOKE assertions are not vacuous) · the exposure
freeze reports **zero widenings**.

⚠ BIR, flagged not blocked (standing interim-payments default): an anonymous
receipt is issued to whatever name the payer typed on the payment form, falling
back to "Guest of &lt;event&gt;". Needs accountant sign-off.

SPEC IMPACT: None — the owner decision is already the last row of
`DECISION_LOG.md` (2026-07-29, "GUESTS CAN BUY PAPIC"), and this PR implements it
without changing prices, SKUs or any locked claim.
