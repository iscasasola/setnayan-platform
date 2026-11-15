## 2026-11-15 · fix(layout): RW-309/311/312 — Live Studio fits a 375 phone; /dashboard presses at 44; shop cover says "events done"; Manpower tab title

W1's walk on 4c094d4:

- **Live Studio** (`/dashboard/[eventId]/studio/live-studio-control`) was 400 px wide at a 375 viewport — the
  free-controller doorway is a one-line ActionButton and its label ran off the edge. The label is now "Go live with one
  camera — included" (same link, same meaning: one camera is free).
- **/dashboard** — the profile pens are a 44 × 44 box with the 26-px circle drawn inside (was a 26 × 26 box); the
  handle's link ("Choose your @handle" / the public address) has a 44-px floor (was an 18-px line); the section's
  Search field is 44 tall (was 42). All three in the shared pieces (`ProfileHeader`'s pen and handle,
  `HomeFindRow`) — no hand-made buttons.
- **Shop cover** (RW-311): the cover's "N events" counts events FINISHED on Setnayan (the Events badge's own number), so a
  new shop read "0 events" beside its open bookings. It now says "0 events done".
- **Manpower** (RW-312): `/dashboard/[eventId]/manpower` gets its own tab title, "Manpower · Setnayan", like Sponsors.
- **44 px** (RW-314): Story's "Back to Event Hub"; Invitation's "Preview as guest", each guest's name and "Re-issue"
  (one line now); "Download PNG" in the shared QR actions; the Shop cover's "Verified" and plan links (the "Get
  verified" pill presses at 46 through the shared `.sn-hit`, its drawing unchanged).
- **Admin walk**: the Studio section tabs (Moodboard library and the rest) press at 44 (were 36); a record's inline
  text links (Person, Shop) use the new shared `RECORD_LINK` in `record-kit` (were 17–18 px lines); Problems › the
  expanded "What" mends a stored pre-#7768 "IIndalecio" on display (`mendAction`) — no stored row is rewritten.
- Not changed (RW-311 item 4): the tour bubble's Skip and Next are already `min-height: 44px`
  (`spotlight-tour.tsx`); its pop-in starts at `scale(.94)`, and 44 × 0.94 ≈ 41 — the walk's 41 px reads as a
  mid-animation measurement.
- Guard: `lib/rw309-fits-375-and-presses-at-44.test.ts` (every `.ab` label on the Live Studio page fits 343 px; the
  pen box, the handle link and the field are 44).

SPEC IMPACT: None — sizing and one label.
