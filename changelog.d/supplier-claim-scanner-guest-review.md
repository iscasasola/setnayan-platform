## 2026-11-04 · feat(supplier-scan): slice 5 — the guest's optional review after "received"

Slice 5 of 5 of the supplier claim scanner (stacked on slice 4). Owner ruling: DECISION_LOG 2026-09-25 "AFTER A GUEST
RECEIVES A SUPPLIER'S ITEM, AN OPTIONAL REVIEW CAN POP UP ON THEIR EVENT HUB" — *"optional to respond"*: 1–5 stars +
an optional line, skippable, ONE per guest per supplier service, verified by a real claim, the supplier never sees who
wrote it, its own store + admin moderation.

- **Migration `20271310845415`**: `supplier_scan_reviews` (one row per event · service · guest: a rating with an
  optional line ≤ 140, or a skip — "Not now" is an answer too, so the card never asks twice; state pending → published |
  hidden). RLS at CREATE: Setnayan admin reads and moderates; no supplier, couple or anon access.
  `supplier_scan_review_submit` is the only writer — SERVICE ROLE ONLY, called with the guest id from the verified pass,
  and refuses unless that guest has a RECEIVED claim for that service (a supplier claim, or the souvenir row a
  supplier's scanner wrote).
- **Guest**: under "Your number", "How was the Photo booth?" — a rating dropdown (★★★★★ Loved it … ★ Poor — a set of
  choices is a dropdown), one optional line, Send · Not now (`ScanReviewAsk`).
- **Admin › Reviews**: "Guests' ratings from the scanner" — Publish · Hide, audited. The guest is not named there.
- One more op on the one action (`guest_review`, `admin_review`) — no new export.
- Tests: `tests/db/a-guest-reviews-a-supplier-only-after-receiving.db.test.ts` (4) · `lib/supplier-scan.test.ts` (+1).

SPEC IMPACT: DECISION_LOG row for slice 5 added. Owner 2026-11-05: *"separate"* — published ratings show on the
supplier's public page in their own **Guest ratings** section after the couple reviews (`GuestRatingsSection`, read by
`readPublishedGuestRatings`: published only, never a skip, never the guest or the event), never merged into the
couple reviews' average. Draws nothing when none are published or the read fails.
