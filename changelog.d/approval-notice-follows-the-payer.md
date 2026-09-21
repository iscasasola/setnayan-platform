## 2026-09-20 · fix(payments): an approval notice follows the payer, not the event

Measured in production on the first real booking fee Setnayan collected — order
`S89O-DW67KBQADN`, reference `SN9B7485DD`, ₱837.50, paid by the **supplier**
Saysay against a booking for a couple's event. Approving it sent that supplier
two notifications and two matching emails, and every one of them pointed at
`/dashboard/<the couple's event>/orders/<order>` — the couple's planning
dashboard.

**The cause was one expression, copied six times** in
`apps/web/app/admin/payments/actions.ts`:

```ts
relatedUrl: order?.event_id ? `/dashboard/${order.event_id}/orders/${…}` : null
```

It reads `event_id` as *"the payer owns this celebration"*. On a booking fee it
means only *the fee is FOR this event*; the same row's `user_id` is the supplier
and its `vendor_profile_id` is the shop being billed.

**It was a dead end, not a leak.** `app/dashboard/[eventId]/layout.tsx` requires
an `event_members` row of `member_type = 'couple'` or an accepted, non-removed
`event_moderators` row and `notFound()`s otherwise — *before* it reads a single
field of the event. A supplier holds neither, so they reached a 404 with
somebody else's celebration in the URL. Nothing of the couple's was disclosed.
The new guard pins that ordering independently, so this fix can never quietly
become the only thing standing between a shop and a couple's data.

### What changed

- `apps/web/lib/pay-back-link.ts` — the lane decision PR #5745 introduced for
  the `/pay` back control is hoisted into an exported `orderLane`, and two thin
  renderings now sit on it: `orderNoticeLink` (where a notification sends its
  reader) and `orderPaidBody` (what it may promise them). `payBackLink` is
  rewritten in terms of the same lane, unchanged in behaviour.
  `isBookingFeeOrder` moves here from `lib/payable-by-reference.ts` (which is
  `server-only`, so the notice path could not have imported it) — one spelling
  of "is this a fee", feeding one lane.
- `apps/web/app/admin/payments/actions.ts` — all **six** `relatedUrl` emit sites
  (`payment_matched`, `order_paid`, `payment_rejected`,
  `payment_resubmit_requested`, `payment_refunded`, `order_quoted`) now go
  through a single `noticeLinkFor` adapter. The five order reads that feed them
  widened to carry `user_id`, `vendor_profile_id` and `service_key` — without
  those columns the resolver is correct and its input is wrong.
- **Couple-only wording sent to a supplier:** the `order_paid` body read *"Your
  order is fully paid. We'll start work right away."* Setnayan starts no work
  when a shop settles the fee it owes us. It is now lane-keyed; the couple's
  wording is untouched.

### The amount

The same notice read **₱838 for a ₱837.50 charge**. That half is fixed by
PR #5744 (`formatPhp` in `lib/orders.ts` went from `maximumFractionDigits: 0`
to exact centavos) and is **not duplicated here** — but it is now *guarded*
from this path: `lib/notification-emit.ts` composes the Resend `subject` from
the notification title, so the new suite asserts the title-to-subject chain and
fails if either half regresses.

### Guard

`apps/web/app/admin/payments/the-notice-follows-the-payer.test.ts` — destination
and wording per payer type (executed through the resolver, not grepped), the
title/subject centavo chain, a **count** of the six emit sites so a seventh
cannot hand-roll a URL, the selects that feed them, one-lane agreement between
the notice and the `/pay` back control, and the layout's membership gate.
Each assertion sabotage-proven.

SPEC IMPACT: None — no locked decision, SKU, price or schema changes. The
booking-fee lane, its `vendor_booking_fee__` service-key prefix and the fee
schedule are all as already specified; this corrects who a notice addresses and
where it points.
