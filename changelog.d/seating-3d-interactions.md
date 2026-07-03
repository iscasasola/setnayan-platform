## 2026-07-03 · feat(seating-3d): walk-around interactions — swipe-to-look, tap-your-seat, booth vendor cards

Slice B of the owner's 2026-07-03 3D interaction model, across the phone demo
walk (`/3d_plan/demo/[token]`), the guest venue explorer (`/[slug]/venue`), and
the shared scene renderer:

- **Swipe-to-look** (chase-camera surfaces): a horizontal drag on the canvas
  rotates the roam camera's yaw (gentle clamped pitch on vertical drag); a short
  press with barely any movement stays "walk here". User-set facing takes
  priority over the chase camera's auto-facing; it eases back (never snaps)
  after ~2.6 s without a swipe, and a walk tap releases the yaw so the camera
  settles behind the new heading. Frame-rate-independent damping; honors
  `prefers-reduced-motion`. New shared hook
  `app/_components/plan3d/use-look-gesture.ts`. The guest venue explorer's
  drag-to-look remains its existing OrbitControls orbit; its floor tap now uses
  a movement threshold so an orbit drag no longer also walks the avatar. (The
  couple lab already had its own WalkController/LookPad — untouched.)
- **Tap your own seat**: the guest's gold-ringed seat is tappable in roam —
  walks there via the existing `seatApproachPath` around-the-table approach.
  Pulsing gold halo + desktop hover cursor as the affordance.
- **Booth vendor card**: tapping a `BoothMesh` (via invisible hit targets, so
  the shared fixture renderer stays interaction-free) opens a bottom sheet
  (mobile) / side drawer (desktop) on the shared `Sheet` primitive: booth label
  + type, the booked vendor's business name/logo/category when linked
  (business identity only — zero personal PII), the `offerings` copy ("What
  they're serving"), and a "Walk to this booth" button (steers to a point just
  in front, facing it, via new pure helper `boothApproach`). Backdrop/X/ESC
  close. New `app/_components/plan3d/booth-vendor-card.tsx`.
- **Data plumbing**: `public_venue_scene` v5 (CREATE OR REPLACE) — the UNION of
  every shipped revision: RESTORES v3's host-gated guest photos
  (photoVisibility/photos), which the theming branch's v4 (PR #2759, written
  over v2) had unknowingly dropped; preserves v4's receptionDesign +
  venueSetting verbatim; and booths gain `offerings` + `vendor {name, logoUrl,
  category} | null`
  through `event_vendor_id` → `event_vendors` → `vendor_profiles`; all guest
  privacy gates preserved byte-for-byte (booth vendor identity is public
  business info, outside the token block). Defensive
  `ADD COLUMN IF NOT EXISTS offerings` (canonical add + CHECK landed in Slice
  A's `20270509511134_booth_offerings.sql`, PR #2757). `fetchBooths` joins the
  vendor block (FK-hinted embed via `marketplace_vendor_id`, lean fallback);
  demo scene loader, couple-lab fetch, and the venue page carry the same booth
  fields, resolving `r2://` logo refs server-side via
  `displayUrlForStoredAsset`. Migration
  `20270510377963_venue_walk_interactions.sql` (not yet applied to prod).
- Sample-event demo data (prod, fictional Maria & Jose): one linked "Mobile
  Bar" booth (Tagay Mobile Bar, with offerings copy) + the floor plan published
  so `/maria-and-jose/venue` demos live.
- Unit tests for `boothApproach` + `boothTypeLabel` in `lib/seating-3d.test.ts`.

SPEC IMPACT: None (implements the 2026-07-03 owner interaction model already
logged in DECISION_LOG; seat plan remains free).
