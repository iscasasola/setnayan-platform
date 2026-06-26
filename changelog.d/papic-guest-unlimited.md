## 2026-06-26 · feat(papic): upgrade-to-Unlimited on the guest-camera card

The "a camera for every guest" card now offers a tier choice for the WHOLE guest
list, not just off-list extras (owner 2026-06-26).

- **Tier picker** (`guest-camera-tier-picker.tsx`): Limited (₱30/guest/day · 30
  photos + 10 clips each · capped ₱6,000) vs Unlimited (₱100/guest/day · no shot
  limit · Drive-archived · capped ₱10,000). One control covers fresh activation
  AND a live upgrade/switch — keeping the current tier re-syncs (free, covers late
  RSVPs); choosing the other tier upgrades/switches.
- **Schema** (`20270305816900`, applied to prod + ledger backfilled):
  `papic_limited_snapshots.tier` (`roll` | `unlimited`, default `roll`).
- **`activatePapicLimited`** takes a `tier`; quotes against that tier's
  admin-managed rate + cap; on a tier change it supersedes the live snapshot and
  cancels its still-`submitted` order (no double pending charge), then creates the
  new-tier snapshot + order.
- **`syncGuestCameras`** now treats a guest camera as any `guest_id`-bound seat
  (Limited OR Unlimited), provisions new ones at the snapshot's tier, and re-tiers
  existing guest seats + re-points their `paid_order_id` on an upgrade. Never
  deletes photos.
- Guest-camera reads (`fetchGuestRollSeat`, the studio count) are tier-agnostic
  (`guest_id` bound), so the QR→camera bridge resolves an Unlimited guest camera
  too. Per-camera capture quota already honors `tier='unlimited'` (no cap).

Note: Unlimited caps at ~100 guest cameras (₱10,000 ÷ ₱100); over that, the card
flags the overflow (add Unlimited extras / free tier). Prices stay admin-managed.

SPEC IMPACT: 0012_papic — guest-list cameras are tier-selectable (Limited or
Unlimited). Recorded in DECISION_LOG (2026-06-26). Open for the holistic pricing
pass: on a paid-then-upgrade, the new order bills the full new tier (no delta).
