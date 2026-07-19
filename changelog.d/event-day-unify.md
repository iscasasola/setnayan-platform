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

## 2026-06-28 · feat(face): 3-angle day-of face enrollment for better photo-tagging

The day-of "Add your face" enrollment captured a single frontal selfie. Faces
at an event are turned, side-lit, mid-laugh — one reference descriptor misses
them. The capture now guides up to **three angles** (center · slight-left ·
slight-right) and writes **one `guest_face_enrollments` row per angle**;
`lib/face-match.ts` already compares a photo against every non-revoked row per
guest, so more angles = more chances to match.

- `SelfieCapture` gains an opt-in `multiShot` mode (default off → the RSVP
  single-selfie path is byte-identical). It accumulates committed angles, shows
  a per-angle pose hint + an "add another angle" gallery, and submits
  `selfie_refs[]` / `selfie_vectors[]` / `selfie_qualities[]` (plus the single
  inputs = first angle for the action's guard + display-photo write).
- `enrollGuestFace` parses the arrays and inserts up to 3 rows (single-input
  fallback preserved for RSVP + older clients). Cap of 3 enforced client + server.
- `day-of-face-enroll.tsx` opts into `multiShot`; RSVP untouched.

Still subject to the hosted-model gate (`lib/face-embed.ts` is dormant until
`NEXT_PUBLIC_FACE_MODEL_URL` is live) — this future-proofs the enrollment data
so the accuracy lands the moment the model is hosted. Biometric consent stays a
single, skippable RA 10173 gate.

SPEC IMPACT: Logged in `DECISION_LOG.md` (same event-day hub program row).
