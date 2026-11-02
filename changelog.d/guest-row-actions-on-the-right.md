## 2026-10-20 · fix(guests): Edit and Remove end the name's line — one line per guest

Owner, on a Guests › List row whose Edit and Remove sat on a second line under the name: *"edit and remove button
can be in a row? on the right side?"*. `GuestRowLine` (`guests-screen.tsx`) now lays out avatar · name · buttons in
one three-track grid (`40px minmax(0, 1fr) auto`), the buttons at the right end and centred on the row. From 701 px
(the tablet/desktop boundary, #6682) they keep their words and look; under 701 they are 44 × 44 icons (pencil, ×),
each named for its guest (aria-label "Edit <name>" / "Remove <name>", and "Message <name>" where Message shows). The
name is one line and ellipsises before the buttons give way. Select mode (buttons hidden), Remove's confirm, the
Just-added rows, the +1 rows' indent and the passed-away line are unchanged. Held by
`guest-row-actions-share-the-name-line.test.ts` (grid placement simulated, phone targets, names).

SPEC IMPACT: None.
