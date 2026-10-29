## 2026-10-29 · feat(supplier-today): Today + Customers › Events rows open — in place on a phone, beside the list from 701

Owner, 29 Oct (supplier dashboard v13, *"Approved."*): *"where is the expand look of these rows?"* (reverses the
one-line row of the round before) · *"for inquiries. we can say what service they are requesting for. and we can show
what services they also have that are on the categories added by the event."* Builder S3, on top of #7051 (S1's frame).

- **Two columns** — `SupplierColumns` (dropped from #7051 because no page used it) is back and USED: Today's lists and
  Customers › Events sit left, the opened row is drawn right from 701 (`SupplierOpenScope` / `SupplierOpenRow`,
  `vendor-dashboard/_components/supplier-open-row.tsx`). The row is the shared `Fold`; from 701 its body is PORTALED
  into the right column (one copy — no second form), the row wears the open wash, and the right column is never empty
  (the first row on screen; else the page's own sentence). Phone unchanged: a row opens in place, its head pins slim.
- **Every Today row opens** — Waiting on you (each ask's shipped answer, now with its ONE action beside the head:
  Reply → the chat · Confirm → the shipped deposit confirm), This week and To come in (the whole line + its door).
  An inquiry opens to the event's fixed lines + Decline · Ask a question · Accept. A logged payment shows the amount
  and method from the payment log (the one deposit rule, `recordedDepositPhp`) and a receipt thumbnail.
- **The event's fixed lines** (`event-lines.tsx` + `lib/supplier-event-lines(.server).ts`): Event type · Celebrant ·
  Hosted by (the asker marked "Asked you") · Location · Date · Est. pax · Service requested · You also offer (only this
  shop's other services in categories the event added, only while asking) · For your service (links to the shipped
  `clients/[eventId]/mood-board · seat-plan · production-sheet` and the Schedule tab — view only; seat plan and
  production sheet "open once they book you") · Also booked (names + services, never prices). ONE batched read per
  page (one parallel round + the names), scoped to events this shop holds a thread or a plan row on; opening a row
  reads nothing; a refused read says "couldn't load", never an empty list.
- **Customers › Events** rows open (were: a jump to the chat) to the same lines + Open the chat (or the inquiry's three
  answers); the other chats and kept notes follow the list in the left column.
- **The chat** — a pending inquiry opens on "Their ask": the same lines + Decline · Ask a question · Accept (Accept
  starts a quote), answers pinned in sight; the shipped "Talk to them" band stays.
- `Fold` gains `endPress` (a row's one action beside its head), `current`, `wrap` (two-line titles) and `titleNode`.
- Lab: `/dev/supplier-lab?s=chat-ask`; Today and People fixtures carry event lines.

Guards: `a-supplier-row-opens-beside-itself.test.ts` (new); `the-supplier-frame-holds.test.ts` case 5 restored; the
row-shape tests re-aimed at the v13 row (`people-is-rows`, `the-customers-counts-filter-in-place`,
`the-counts-filter-in-place`, `the-upcoming-row-opens-the-customer-card`, `a-count-you-can-tap-goes-somewhere`,
`the-columns-are-the-system` — the working Today fills the frame from 701).

SPEC IMPACT: None — builds the approved v13 prototype and the 2026-10-29 rulings already in DECISION_LOG; no new decision.
