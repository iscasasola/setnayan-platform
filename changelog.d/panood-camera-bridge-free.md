## 2026-06-26 · copy(panood): camera bridge is included free in the multicam tier

The Panood camera bridge is now FREE — included in the multicam control-room
tier (owner 2026-06-26, "make it free"). Connecting any camera, **phone or
DSLR**, carries NO per-camera fee; the phone-camera QR join was already free.

Copy-only clarification across the Panood "Cameras" feature group:
- `apps/web/app/dashboard/[eventId]/studio/panood/page.tsx` — Cameras
  highlight, multicam plan scope, description paragraph, preview caption,
  and plan-sheet intro now read "connect any camera — phone or DSLR — …
  camera bridge included, no per-camera fee."
- `apps/web/app/pricing/page.tsx` — Panood paid card "Cameras" bullet gets
  the same one-clause clarification.

No price added anywhere (the bridge is included/free). Papic's camera bridge
is untouched (separate SKU, stays ₱100/seat/day).

SPEC IMPACT: Pricing.md Panood bridge → included free (no per-camera fee);
PANOOD_CAMERA_BRIDGE SKU removed. Papic camera bridge unchanged.
