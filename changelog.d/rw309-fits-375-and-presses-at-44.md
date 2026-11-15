## 2026-11-15 · fix(layout): RW-309 — Live Studio fits a 375 phone; /dashboard's pens, handle link and Search press at 44

W1's walk on 4c094d4:

- **Live Studio** (`/dashboard/[eventId]/studio/live-studio-control`) was 400 px wide at a 375 viewport — the
  free-controller doorway is a one-line ActionButton and its label ran off the edge. The label is now "Go live with one
  camera — included" (same link, same meaning: one camera is free).
- **/dashboard** — the profile pens are a 44 × 44 box with the 26-px circle drawn inside (was a 26 × 26 box); the
  handle's link ("Choose your @handle" / the public address) has a 44-px floor (was an 18-px line); the section's
  Search field is 44 tall (was 42). All three in the shared pieces (`ProfileHeader`'s pen and handle,
  `HomeFindRow`) — no hand-made buttons.
- Guard: `lib/rw309-fits-375-and-presses-at-44.test.ts` (every `.ab` label on the Live Studio page fits 343 px; the
  pen box, the handle link and the field are 44).

SPEC IMPACT: None — sizing and one label.
