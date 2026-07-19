## 2026-07-15 · feat(guests): desktop inspector column — click a guest, keep the roster

Inspector Column phase 2 — the Guests master-detail. On desktop (≥xl) clicking a
guest row's name (or the eye quick-view button) now SELECTS the guest into the
sticky right inspector column (`?inspect=<guestId>`, the shared #3265 primitive)
instead of replacing the page — macOS-Finder master-detail. The former
quick-view sheet's BODY was extracted into a shared `GuestDetailBody`
(identity + side/RSVP chips, the #3262 branded/default personal-QR doorway,
contact, groups, role/plus-one details) consumed by BOTH frames: the mobile /
below-xl slide-in sheet (unchanged behavior) and the new desktop
`InspectorColumn` — one body, two frames, zero content divergence. "Open full
details" ↗ deep-links the standalone `/guests/[guestId]` route, which is
untouched (and still serves below-xl + modified clicks). Selected row wears the
quiet gold wash; multiselect checkboxes, facet lens bar, capture bar, and header
actions all keep working beside the clamp-width rail. Additive primitive change
only: `useIsInspectorViewport` exported (was internal) so the quick-view button
gates select-vs-sheet on the same xl breakpoint.

SPEC IMPACT: None beyond the inspector program note — the Inspector Column
rollout (#3265 Studio + Overview) now covers Guests as its phase-2 surface; no
pricing/SKU/schema change, no new guest fields surfaced (RA-10173: the inspector
renders exactly what the P1 quick-view sheet already rendered).
