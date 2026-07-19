## 2026-07-09 · feat(panood): camera-tier caps — provision 8 (Desktop) / 3 (Mobile) on approval

Phase 2, PR #2 of the Live Studio controller. Enforces the per-tier camera cap by provisioning exactly the tier's seat count when a paid Live Studio order is approved:

- `PANOOD_SYSTEM` (Desktop · ₱2,499/day) → **8** camera-operator seats
- `PANOOD_SYSTEM_MOBILE` (Mobile · ₱1,299/day) → **3** seats
- Free single-cam livestream → **0** (couple's own device → YouTube; no operator seats)

Adds `panoodCameraCapForSku()` + `PANOOD_TIER_CAMERA_CAP` to `lib/panood-camera-seats.ts`, and wires both SKUs into the `lib/sku-activation.ts` approval dispatcher (mirrors `PAPIC_SEATS` — idempotent top-up, best-effort, never throws). The cap is a **hard** limit: `panood_claim_camera()` only binds an operator to an EXISTING camera, so provisioning exactly `cap` seats is the ceiling (no per-camera fee). +2 unit tests (23/23 pass).

SPEC IMPACT: None — implements the camera caps recorded in `Live_Studio_Repackaging_2026-07-08.md` + `DECISION_LOG.md` 2026-07-08.
