## 2026-09-21 · fix(invitation): the face step waits for the camera — no static card on the event hub

Owner, looking at the "Add your face" card: *"so many text. we want the event hub to be
minimalist"* … *"should be a pop up on their first click on the camera"* … *"not a static widget on
event hub"*.

- **The invitation and the day-of hub no longer mount the face card.** It was a large static block
  of consent text sitting on the page for every guest who had not enrolled.
- **The camera asks instead — once, on the first click.** The moment a guest accepts the camera's
  terms ("Before you start shooting"), the face step opens. The small in-camera prompt remains for
  later.
- **It stays separate and skippable.** Terms are recorded FIRST; the face step is a second,
  optional screen with its own "not now". Biometric consent under RA 10173 must be freely given, so
  declining it never costs a guest the camera. The consent wording and the retention receipt are
  unchanged — they moved with the step, they were not shortened.
- **Dead reads removed from the hub.** It computed the face requirement (two database reads) only
  to feed the card; the camera page decides that for itself.

⚠ **The trade-off, stated:** a guest who never opens the camera AND skips the RSVP sheet's optional
selfie is now never asked. That is the owner's call for a minimalist hub, recorded here so it is a
choice rather than a surprise.

Two guards had pinned the static mounts and were answered, not deleted: `face-receipt.test.ts` now
asserts the camera is the DayOfFaceEnroll surface and the two pages mount NONE; and
`the-arrival-says-what-opens.test.ts` records that the open owner question it carried is answered.
New `the-face-step-waits-for-the-camera.test.ts` sweeps the whole guest tree (with a floor) for a
static card, and pins that the camera opens the step after acceptance and keeps `onSkip`. Removing
the camera's prompt turns it red.

SPEC IMPACT: `DECISION_LOG.md` 2026-09-21 row — where the face step lives.
