## 2026-06-28 · feat(slug): unify event-day chrome onto the no-guest / host-preview view

The public event page (`/[slug]`) rendered two different event-day experiences:
identified guests (personal QR) got the `GuestHubBar` (Camera · Photos · My QR
bottom bar), while a no-guest viewer — an anonymous link open, or the host's
`?phase=event` preview — dropped into `PublicLanding` with **no** event-day
chrome at all, so the same live event looked like a different, barer page.

Added a slim public counterpart `PublicEventDayBar` and rendered it inside all
three `PublicLanding` branches (no-session · wrong-event · no-guest). Because a
non-guest has no personal QR and no personal gallery, the public bar carries
only the two event-level actions:

- bottom-center **Camera** → the couple's candid camera (`/papic/guest`), shown
  only during the live window when the `PAPIC_GUEST` camera is open;
- bottom-right **Photos** → the event's public album (Live Photo Wall during the
  day, `/[slug]/recap` after), shown only when one exists.

The bottom-left "My QR" slot is intentionally empty (owner 2026-06-28 — a
non-guest has no personal QR). The bar self-hides outside the live/post window.
`eventPapicGuestActive` is lifted above the early returns (one cheap read, only
in the live window). First slice of the phased event-day guest-hub program
(directions, ported day-of cards, 3-shot selfie, souvenir-scan to follow).

SPEC IMPACT: Logged at the bottom of `DECISION_LOG.md` (event-day chrome is now
unified across the guest, anonymous, and host-preview views; public bar = candid
Camera + public Photos only). Code is canonical per the 2026-06-07 ground-truth
posture; iteration `0031_day_of_guest` remains the reference home.
