## 2026-09-21 · fix(invitation): one QR on the invitation

The Me section's "My QR" button opened a pop-up with the same code the pass
card already shows on the page. Owner: "they serve the same purpose." The
button now shows only when the pass card is NOT on the page (the couple hid
it, or the phase leaves it out), so no guest loses their only QR. Pinned by
`one-qr-on-the-invitation.test.ts`.

SPEC IMPACT: None (removes a duplicate entry to an existing surface).
