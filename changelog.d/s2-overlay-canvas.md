## 2026-09-06 · feat(encoder): draw the ₱0 broadcast extras on the program canvas

S2 of the encoder build series (`build-sessions/encoder/README.md`). Adds
`apps/web/lib/encoder/encoder-layout.ts` (the 1280×720 layout reference table
for the monogram bug / lower third / event QR, with a scale factor for 1080p —
no such spec existed before this) and `apps/web/lib/encoder/draw-overlays.ts`
(a pure painter for `ResolvedOverlays`, the SAME decision `BroadcastOverlays`
in `program-surface.tsx` draws from `resolveOverlays`). Wires into S1's
compositor via the `setOverlayHook` seam it already left: the program canvas
worker now accepts an `overlays` message (mirroring how S1's `air` message
already works) and draws through the hook only when there is an actual camera
on program — `EMPTY_FRAME` draws nothing, matching "nothing on program = nothing
to brand".

E2 is confirmed retired: it guarded `ProgramFrame.overlay` / `WatermarkReason`,
which nothing that airs on this path publishes any more (rule 18). This module
never touches that field and imports only TYPES from `live-studio-overlays.ts`
— a directory-wide grep test (`draw-overlays.test.ts`) fails on any reference
to `resolveOverlays`, `canPublishMultiCam`, or `decideWatermark` anywhere under
`lib/encoder/`.

Parity with the DOM is decision-level (same overlays present/absent, same
`lowerThird.forced` state and colour), not pixel-level — the canvas has no
Tailwind box model to replicate, so `encoder-layout.ts` is this module's own
reference table, documented as such in both files' docblocks.

OWNER QUESTION (unchanged by this PR, recorded per rule 12/§4c): the two owner
locks that contradict on free-tier branding, noted in
`program-bridge.tsx` (spec § 4c), are still open. This PR does not decide them
— it draws exactly what `airOverlays` already says, whichever branch resolves.

SPEC IMPACT: None — this documents an existing owner lock (§ 4c), not a new one.
