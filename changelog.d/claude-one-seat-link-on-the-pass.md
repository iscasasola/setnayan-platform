## 2026-09-21 · fix(invitation): one seat link on the pass

The pass card carried "Find my table" and "Your seat pass". The custom QR is
free (2026-09-06), so both showed for every guest and did the same job; the
seat pass does everything the map does plus tablemates and the arrival
greeting. One link now, "Find my seat", to the personal seat pass.

Also fixed: because the QR is free, ownership alone said yes for every kind of
event, and both links pointed a trip, dinner or hangout guest at a page that
returns notFound(). The link now also requires a kind that seats people and
published seating, the same rule as the room footer. The Indoor Blueprint map
stays reachable from the everything-else sheet. Pinned by
`one-seat-link-on-the-pass.test.ts`.

SPEC IMPACT: None.
