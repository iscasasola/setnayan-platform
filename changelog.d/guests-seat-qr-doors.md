## 2026-07-15 · fix(guests): seat-plan + guest-QR doorways

Two owner-reported wayfinding gaps on the couple Guests page ("I cannot find
their Custom QR and how to continue to seat plan 2D?"), both left by the #3258
Living Roster / Atelier-Glass re-expression.

- **Seat-plan door (desktop).** The Seat journey stage (`/seating` — the "Arrange
  the room" editor, authoring truth for the 3D plan) was reachable only from the
  mobile carousel's journey pill; the desktop Guests page had no door to it. Added
  an "Arrange the room" button (lucide `LayoutGrid`) to the desktop header action
  group, same `button-secondary` weight as the neighbouring Invite guests + Share
  affordances — matching the v2 prototype's `.gseat` glass pill. Same disease the
  Invite door (#3249) just cured.
- **Guest-QR door (drawer).** The guest quick-view drawer rendered a deliberately
  decorative (non-scannable) QR with no path to the real one. Made the section
  actionable: when the paid `CUSTOM_QR_GUEST` upgrade is admin-approved it now
  downloads the guest's REAL branded PNG straight from the existing gated
  `/api/website/qr/guest/[guestId]` route (same consumer pattern as the Invitation
  + Custom-QR surfaces); otherwise it routes to the Invitation page, where every
  guest's free default scannable QR always renders. A quiet "Customize guest QRs →"
  link reaches the Custom-QR studio. Copy states the honest split (default QR
  always free; branding is the SKU). Guests page reads the SKU-active flag via
  `eventSkuActive` (admin client, folded into the existing parallel fan-out,
  graceful-degrade on error) and threads it to the drawer host.
- Corrected the stale `guest-journey.ts` retired-ribbon comment (the Seat stage's
  desktop in-page door is now the Guests header button), mirroring the Invite fix.

No recomposition — doorways + the drawer QR section only.

SPEC IMPACT: None
