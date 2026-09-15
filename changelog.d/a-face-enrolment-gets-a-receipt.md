## 2026-09-16 · feat(privacy): a guest who enrols her face gets a plain receipt

A guest ticking the biometric-consent box was told what the matching is FOR, but
never what is kept, for how long, or how to undo it. RA 10173 asks for all four.

`lib/face-receipt.ts` is the one place those four sentences exist. The retention
period is DERIVED from `FACE_DATA_POST_EVENT_GRACE_DAYS` — the constant
`faceDataIsPastRetention` compares against — so the receipt can only ever state
the period the sweep enforces. No day count and no month count is typed into any
surface.

Shown twice, on purpose: at the moment of enrolling (inside `SelfieCapture`,
which all three enrolment surfaces mount) and afterwards next to the removal
control (`FaceDataNotice`), where the event's dates are known so the receipt can
name the day the clock runs out.

Also corrected in the same change: `FaceDataNotice` told EVERY guest her photo
was "set up for face recognition". Every event is `mode_b` until an admin
switches matching on, and in `mode_b` no descriptor is ever computed — so that
line claimed a measurement of her face that did not exist. It now branches on the
server-resolved effective mode, like the consent copy already did.

SPEC IMPACT: None. The receipt restates what `lib/face-data-retention.ts` and
`withdrawFaceConsent` already enforce; no policy, period or SKU moves.
