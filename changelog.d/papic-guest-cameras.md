## 2026-06-26 · feat(papic): Limited cameras = the guest list + minimalist studio

Owner-locked reshaping of the per-camera model (the three questions on the Papic
studio page). A "camera" is still a paparazzi seat — this splits how they're sold:

- **Limited (roll) = the guest list.** Every guest who hasn't declined becomes a
  Limited camera; their existing personal QR (`guests.qr_token`) is the
  credential, so the couple does nothing per guest. The count auto-derives — no
  stepper. Sold once via a reversible **snapshot** (new
  `papic_limited_snapshots`): "Ready for Papic" freezes the count + bill, and
  late "yes" RSVPs are covered free within the cost cap by a render-time
  `syncGuestCameras` (idempotent + self-healing — provisions for non-declined
  guests up to the cap, revokes cameras for guests who declined / were deleted;
  never deletes photos). Count basis = everyone except `declined`.
- **Unlimited = the only off-list path.** Cameras for shooters NOT on the guest
  list (videographer friend, hired second shooter) can only be Unlimited —
  uncapped, Drive-archived, anonymous `paparazzi_seats` with claim links. New
  `purchasePapicExtras` action + `extra-cameras-picker.tsx` (one stepper, min 1).
- **Schema** (`20270305788856`, applied to `setnayan-prod` + ledger backfilled):
  `paparazzi_seats.guest_id` (FK guests, ON DELETE SET NULL so photos are never
  cascade-deleted) + a partial unique index (one active camera per guest);
  `papic_limited_snapshots` (frozen count/bill/cap/rate + status) with
  couple-or-admin RLS at CREATE TABLE.
- **Minimalist studio rewrite** (`studio/papic/page.tsx`, ~1700 → ~1100 lines):
  header trimmed; "Your cameras" = Limited guest card + Unlimited-extras picker;
  storage / gallery / moderation kept but tightened; DSLR bridge + the shutter +
  capture defaults folded under one "Setup & help" disclosure; the 4-brand SDK
  matrix compacted (Canon at launch, honest). All shipped surfaces preserved
  (Unlock-all, Live Wall, Magazine, Recap, sampler retention, Drive OAuth).
- Removes the two-stepper `camera-picker.tsx` (replaced by guest-bound Limited +
  Unlimited-only extras). New `apps/web/lib/papic-limited.ts` holds the pure
  quote + the single guest-camera provisioning path. Prices stay admin-managed.

Two packaging deltas flagged for owner pricing review (not price changes — they
change *quantity rules*): (1) Limited has no 5-camera minimum (it's the real
guest count); (2) Unlimited extras minimum is 1 (was 5) so a single off-list
shooter can be added. The guest personal-QR → "open my camera" capture entry is
a tracked follow-up (waits on PR #2280's capture route to avoid a collision).

SPEC IMPACT: 0012_papic — Limited/Unlimited split + guest-list binding +
reversible snapshot recorded in `DECISION_LOG.md` (2026-06-26) and noted in the
0012 spec. Prices remain provisional admin-catalog dials.
