## 2026-09-30 · feat(face-tagging): the 2026-09-30 face rules — asked only with Papic on, the selfie only on the day, erased at sign-out or when Papic closes

Builds the owner's six 2026-09-30 face-tagging rows (DECISION_LOG) on the RSVP-release train.

- **Asked only where Papic is active (R1).** `resolveFaceTagging` moved to the server-only
  `lib/face-tagging-gate.ts` and now needs all of: the event's Papic active
  (`eventPapicGuestActive`), face tagging running (`mode_a`, which carries the couple's
  switch) and Papic not yet closed (`faceTaggingAskable`, `lib/face-selfie-lifetime.ts`).
  `lib/papic-face-mode.ts` stays isomorphic and no longer answers "askable".
- **The question on every reply card, the camera on none (R2/R3).** The Event Hub RSVP card
  passed `offerSelfie={faceTaggingAskable}` and enrolled a selfie weeks before the day
  (`submitRsvp`, source `rsvp_selfie`). `offerSelfie` and the card's `SelfieCapture` are
  gone; both cards pass `askTagging`. `submitRsvp` strips every selfie field first and writes
  no enrollment. The selfie is taken only by the day-of catch.
- **Erased at sign-out and at Papic close, tags kept (R4).** New narrow erase
  `eraseFaceTaggingSelfie` (`lib/face-selfie-erase.ts`): the R2 selfie objects (own folder
  only), the enrollment rows, and the selfie-as-avatar (→ initials). It never touches
  `photo_tags` or the account face. Called by `/{slug}/sign-out` (before the pass is cleared)
  and `/auth/sign-out` (every seat the account holds + the browser's pass). Papic close = the
  shipped capture close (12 h after the event's last Manila day, or a later stored window end):
  new periodic job `face-selfie-papic-close` (30-min claim) carried by admin-layout AND
  home-page `after()`. The sign-out controls say *"Signing out also erases your face-tagging
  selfie. Photos already tagged stay tagged."* first; "Photos of you" carries the screen-2 line.
- **Server-side enrol checks the Yes, Papic and the couple (R6).** `enrollGuestFace` refuses
  unless `face_tagging_wanted === true` and the gate is askable — so a mode_b event stores no
  selfie image. The couple's "Turn it off" now ERASES every guest's selfie (tags kept).
- **Reuse the account's face, per event, off by default (R7).** Migration
  `20271256918022_account_face_reuse_is_per_event` adds `user_face_profiles.reuse_event_ids`;
  `accountSeedsForEvent` seeds only listed events. Switch on "Save it to your account"
  (`/join/[id]/connect/confirm`, only when the account has a face and the event is askable)
  and one switch per event in Profile → Privacy. Both ride existing server actions (+0).
- **R5 (one end-of-event rescan) is NOT built** — there is no server-side face embedder;
  descriptors are computed only on phones (face-api.js from R2). Options are in the PR body.

Guards: `lib/face-tagging-rules.test.ts` (new, R1/R4/R6/R7 — executes the lifetime maths, the
erase against a recording fake, and the matcher's seed query) plus the reworked
`the-selfie-waits-for-a-yes`, `the-arrival-says-what-opens`, `only-the-answer-freezes`,
`face-enrolment-age`, `papic-face-mode-gate`, `rsvp-selfie-ref-tenancy`,
`admin-carries-the-cron-free-jobs`. Every rule sabotaged once and caught.

SPEC IMPACT: DECISION_LOG.md — one implementation row under the 2026-09-30 face rows (what was
built, the rescan options, and the mode_b narrowing flagged for owner sign-off).
