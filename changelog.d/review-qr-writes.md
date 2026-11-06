## 2026-11-06 · feat(shop): the printed Reviews QR opens "Leave a review" for a couple after their event

Owner ruling, 6 Nov (verbatim pick: "Write a review (Recommended)"): the Reviews code on a shop's prints (Promote ›
Prints, #7325) should open WRITE A REVIEW, tied to a verified booking. It opened `/v/<slug>#reviews` (read only).

- **New door `/v/<slug>/review`** (`app/v/[slug]/review/route.ts`, decision in `lib/shop-review-door.ts`). No new
  screen — it sends people to the one write flow that exists, `/dashboard/<eventId>/vendors/<vendorId>/review`:
  - signed out, or a guest pass → `/login?next=/v/<slug>/review` (the login page's own `next`);
  - a booking with this shop (`event_vendors.marketplace_vendor_id`, not archived) on an event the person hosts, that
    the review page's handshake calls `reviewable` or `awaiting_confirm` → that booking's review page; several → the
    most recent event's;
  - no such booking → `/v/<slug>#reviews`; a renamed shop → the door on its new address (slug ledger).
  - **Reads are honest:** a refused or thrown read lands on `/v/<slug>#reviews`, never a 404 or a silent "no booking".
- `printQrUrl('reviews')` now returns `<origin>/v/<slug>/review`; caption **"Scan to review us"** (title stays "Reviews").
- Unchanged: the On the Day guest review QR (`guest-review-qr.tsx`) — it serves guests, not the booking couple.
- 🔒 `lib/shop-review-door.test.ts` (every branch against stubbed clients, incl. four refused-read cases);
  `lib/supplier-prints-decode.test.ts` / `lib/supplier-prints.test.ts` updated for the new URL and caption.

SPEC IMPACT: The owner's 6 Nov ruling ("Write a review") is not yet a DECISION_LOG row — this PR does not add one;
flagged in the PR body for the controller to record.
