## 2026-11-16 · feat(suppliers): the couple's supplier list says when a shop is not yet verified

Owner ruling 36d74d48 (16 Nov): "A couple is always told when a supplier is not yet verified", on the event's
supplier list and "wherever a couple sees or acts on an unverified shop". The couple is told, never blocked.

- The Suppliers page already reads each shop's `verification_state` with the admin client. It now also reads
  `is_demo` on the same query and flags the shop with the chat head's own test (`threadShowsNotYetVerified`).
  - Only a state that was actually read and is not `verified` counts.
  - Demo, off-platform and unread shops draw nothing.
- The shipped `NotYetVerifiedThreadLine` is reused unchanged on:
  - the Suppliers card, drawn under the card because its ⓘ cannot sit inside the card's link;
  - the quick-view;
  - the booked team row and the waiting team row, drawn outside the row's toggle.
- No new words and no new server action.

Guard: `lib/every-couple-surface-says-not-yet-verified.test.ts`. It lists every couple-facing surface (chat head,
shop page, card, quick-view, booked row, waiting row) and the one flag each reads. It was sabotage-tested on each
surface and on the flag.

SPEC IMPACT: None. This implements specs DECISION_LOG 36d74d48 as ruled.
