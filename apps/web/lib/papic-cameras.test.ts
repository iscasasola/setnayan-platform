import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeCameraQuote,
  papicCaptureCost,
  papicPerCameraTier,
  resolvePointsGate,
  isMissingRpcErrorCode,
  PAPIC_CAMERA_FREE_SKU,
  PAPIC_CAMERA_ROLL_SKU,
  PAPIC_CAMERA_UNLIMITED_SKU,
  PAPIC_FREE_CAMERA_COUNT,
  PAPIC_FREE_CAMERA_INDEX_BASE,
  PAPIC_CAMERA_INDEX_BASE,
  type CameraRates,
  type CameraCaps,
} from './papic-cameras';

// Money-logic guard for the PAPIC_UNLOCK "free + uncapped Unli" allowance (owner
// 2026-06-26). computeCameraQuote is the single pure source the picker (client)
// and purchasePapicCameras (server) both mirror — so its unliFree branch must be
// exactly: Unli charge → ₱0, Roll (Ltd) untouched, never "free up paid cameras"
// when unliFree is false.

const RATES: CameraRates = { roll: 30, unlimited: 100 };
// roll==Mini (owner 2026-07-17): the roll tier caps at the MINI cap (6000);
// unlimited==Unli caps at the Unli cap (10000). ltd is dormant (distinct Ltd
// tier ships later). Generous enough that nothing clamps in the small cases.
const CAPS: CameraCaps = { mini: 6000, ltd: 10000, unli: 10000 };

test('paid path (unliFree off): both tiers bill — Unli is NOT free', () => {
  const q = computeCameraQuote({ roll: 5, unlimited: 2 }, 1, RATES, CAPS);
  assert.equal(q.rollChargePhp, 150); // 5 × ₱30
  assert.equal(q.unlimitedChargePhp, 200); // 2 × ₱100 — charged
  assert.equal(q.totalPhp, 350);
});

test('unliFree: Unli charge collapses to ₱0, Roll still bills', () => {
  const q = computeCameraQuote({ roll: 5, unlimited: 4 }, 1, RATES, CAPS, {
    unliFree: true,
  });
  assert.equal(q.rollChargePhp, 150); // 5 × ₱30 — unchanged
  assert.equal(q.unlimitedChargePhp, 0); // freed by the umbrella
  assert.equal(q.totalPhp, 150);
  // Subtotal is still computed for display (the "would be" figure).
  assert.equal(q.unlimitedSubtotalPhp, 400);
});

test('unliFree + only Unli → whole order is free (₱0)', () => {
  const q = computeCameraQuote({ roll: 0, unlimited: 12 }, 1, RATES, CAPS, {
    unliFree: true,
  });
  assert.equal(q.totalPhp, 0);
  assert.equal(q.paidCount, 12); // count is preserved (uncapped), only the charge is 0
});

test('unliFree never trips the Unli cap flag (free, not clamped)', () => {
  // 200 Unli × ₱100 = ₱20,000 would exceed the ₱10,000 cap on the paid path…
  const paid = computeCameraQuote({ roll: 0, unlimited: 200 }, 1, RATES, CAPS);
  assert.equal(paid.capped, true);
  // …but with unliFree it is ₱0, so it is not "capped".
  const free = computeCameraQuote({ roll: 0, unlimited: 200 }, 1, RATES, CAPS, {
    unliFree: true,
  });
  assert.equal(free.capped, false);
  assert.equal(free.totalPhp, 0);
});

test('unliFree does NOT free Roll: a Roll-over-cap order still bills the Mini cap', () => {
  // 300 Roll × ₱30 = ₱9,000 → clamps to the ₱6,000 Mini cap even when unliFree.
  const q = computeCameraQuote({ roll: 300, unlimited: 5 }, 1, RATES, CAPS, {
    unliFree: true,
  });
  assert.equal(q.rollChargePhp, 6000); // Mini cap honored (roll->Mini)
  assert.equal(q.unlimitedChargePhp, 0); // Unli free
  assert.equal(q.totalPhp, 6000);
  assert.equal(q.capped, true); // Roll tripped its cap
});

// ── PAPIC_UNLOCK_LTD "free + uncapped Ltd" allowance (owner 2026-07-11) ───────
// Ltd-tier mirror of the unliFree branch: ltdFree → Roll charge ₱0, Unli untouched.

test('ltdFree: Roll charge collapses to ₱0, Unli still bills', () => {
  const q = computeCameraQuote({ roll: 8, unlimited: 3 }, 1, RATES, CAPS, {
    ltdFree: true,
  });
  assert.equal(q.rollChargePhp, 0); // freed by the Ltd umbrella
  assert.equal(q.unlimitedChargePhp, 300); // 3 × ₱100 — charged
  assert.equal(q.totalPhp, 300);
  assert.equal(q.rollSubtotalPhp, 240); // "would be" figure preserved for display
});

test('ltdFree + only Roll → whole order is free (₱0)', () => {
  const q = computeCameraQuote({ roll: 250, unlimited: 0 }, 1, RATES, CAPS, {
    ltdFree: true,
  });
  assert.equal(q.totalPhp, 0);
  assert.equal(q.paidCount, 250);
  assert.equal(q.capped, false); // free, not clamped
});

test('ltdFree does NOT free Unli: an Unli-over-cap order still bills the Unli cap', () => {
  // 200 Unli × ₱100 = ₱20,000 → clamps to the ₱10,000 Unli cap even when ltdFree.
  const q = computeCameraQuote({ roll: 5, unlimited: 200 }, 1, RATES, CAPS, {
    ltdFree: true,
  });
  assert.equal(q.rollChargePhp, 0); // Ltd free
  assert.equal(q.unlimitedChargePhp, 10000); // Unli cap honored
  assert.equal(q.totalPhp, 10000);
  assert.equal(q.capped, true); // Unli tripped its cap
});

test('both unlocks: ltdFree + unliFree → whole order is ₱0', () => {
  const q = computeCameraQuote({ roll: 120, unlimited: 90 }, 2, RATES, CAPS, {
    ltdFree: true,
    unliFree: true,
  });
  assert.equal(q.totalPhp, 0);
  assert.equal(q.capped, false);
});

// ── uncapped (non-wedding events): caps do NOT apply (owner 2026-07-17) ───────
// Weddings clamp to the per-tier caps; every other event type bills the raw
// subtotal (the `uncapped` flag, set by isPapicUncapped(event_type)).

test('uncapped (non-wedding): bills the raw subtotal, nothing clamps', () => {
  const q = computeCameraQuote({ roll: 300, unlimited: 200 }, 1, RATES, CAPS, {
    uncapped: true,
  });
  assert.equal(q.rollChargePhp, 9000); // 300 × ₱30 — NOT clamped to the 6000 Mini cap
  assert.equal(q.unlimitedChargePhp, 20000); // 200 × ₱100 — NOT clamped to the 10000 Unli cap
  assert.equal(q.totalPhp, 29000);
  assert.equal(q.capped, false); // uncapped never trips the cap flag
});

test('uncapped default off: the wedding path still clamps to the caps', () => {
  const q = computeCameraQuote({ roll: 300, unlimited: 200 }, 1, RATES, CAPS);
  assert.equal(q.rollChargePhp, 6000); // Mini cap
  assert.equal(q.unlimitedChargePhp, 10000); // Unli cap
  assert.equal(q.totalPhp, 16000);
  assert.equal(q.capped, true);
});

test('uncapped does not override an unlock free tier (still ₱0)', () => {
  const q = computeCameraQuote({ roll: 300, unlimited: 200 }, 1, RATES, CAPS, {
    uncapped: true,
    unliFree: true,
  });
  assert.equal(q.rollChargePhp, 9000); // roll uncapped raw
  assert.equal(q.unlimitedChargePhp, 0); // unlock still frees Unli
  assert.equal(q.totalPhp, 9000);
});

// ── Capture-POINTS enforcement (Papic v3 · brief PR-3) ────────────────────────
// resolvePointsGate is the SINGLE fail-posture policy both seams share (presign
// in api/upload + record in papic/actions). The brief's invariant, pinned:
// fail-CLOSED on every RPC error EXCEPT function-not-found (the seam-cutover
// carve-out); a definitive "no budget left" surfaces as 'exhausted' → the seams
// return 409 camera_points_exhausted (presign refuses the URL — no orphan bytes;
// record refuses the row — the capture never lands).

test('points cost: 1 photo = 1 point · 1 five-second clip = 3 points', () => {
  assert.equal(papicCaptureCost('photo'), 1);
  assert.equal(papicCaptureCost('clip'), 3);
});

test('exhausted budget → "exhausted" (the seams answer 409 camera_points_exhausted, no presign URL)', () => {
  // RPC succeeded and definitively said "does not fit" (reserve returned false /
  // remaining < cost) → exhausted, never a silent allow.
  assert.equal(resolvePointsGate(null, false), 'exhausted');
});

test('points fit → allow (paid tiers unaffected: unlimited resolves NULL budget → RPC true)', () => {
  // A successful reserve (or remaining >= cost) allows the capture. The
  // unlimited tier's NULL budget is an RPC-side passthrough (returns TRUE
  // without touching the ledger), so a paid Unli camera lands here — unaffected.
  assert.equal(resolvePointsGate(null, true), 'allow');
});

test('fail-CLOSED: any RPC error blocks…', () => {
  assert.equal(resolvePointsGate('XX000', null), 'blocked'); // generic pg error
  assert.equal(resolvePointsGate('unknown', null), 'blocked'); // thrown/unidentified
  assert.equal(resolvePointsGate('57014', true), 'blocked'); // error wins over a stale verdict
});

test('…EXCEPT function-not-found (the seam-cutover carve-out) → allow', () => {
  assert.equal(resolvePointsGate('42883', null), 'allow'); // pg undefined_function
  assert.equal(resolvePointsGate('PGRST202', null), 'allow'); // PostgREST schema-cache miss
  assert.equal(isMissingRpcErrorCode('42883'), true);
  assert.equal(isMissingRpcErrorCode('PGRST202'), true);
  assert.equal(isMissingRpcErrorCode('42P01'), false); // a missing TABLE is NOT the carve-out
});

test('indeterminate RPC result (no error, no verdict) → fail-CLOSED blocked', () => {
  assert.equal(resolvePointsGate(null, null), 'blocked');
});

// ── Free-tier per-camera seats (the fake-door close) ─────────────────────────
// papicPerCameraTier decides WHICH seats the points gate meters. Free cameras
// (sku PAPIC_CAMERA_FREE · tier 'free') must be enforced exactly like paid
// per-camera seats; the legacy PAPIC_SEATS pack must stay uncapped (feature-
// loss firewall — it returns null and skips the gate entirely).

test('free per-camera seats ARE metered: PAPIC_CAMERA_FREE + tier free → "free"', () => {
  assert.equal(papicPerCameraTier(PAPIC_CAMERA_FREE_SKU, 'free'), 'free');
});

test('paid per-camera seats keep their tiers (roll / unlimited)', () => {
  assert.equal(papicPerCameraTier(PAPIC_CAMERA_ROLL_SKU, 'roll'), 'roll');
  assert.equal(
    papicPerCameraTier(PAPIC_CAMERA_UNLIMITED_SKU, 'unlimited'),
    'unlimited',
  );
});

test('legacy PAPIC_SEATS pack seats are NOT metered (null → gate skipped)', () => {
  // The pack also carries tier='free' from the column backfill — the sku is
  // what keeps it out of the per-camera gate.
  assert.equal(papicPerCameraTier('PAPIC_SEATS', 'free'), null);
  assert.equal(papicPerCameraTier(null, 'free'), null);
});

test('free-seat index range (100..102) never collides with the pack (1–5) or paid range (>= 200)', () => {
  const last = PAPIC_FREE_CAMERA_INDEX_BASE + PAPIC_FREE_CAMERA_COUNT - 1;
  assert.equal(PAPIC_FREE_CAMERA_COUNT, 3); // owner 2026-07-17 — the advertised 3 free cameras
  assert.ok(PAPIC_FREE_CAMERA_INDEX_BASE > 5); // clear of the legacy pack
  assert.ok(last < PAPIC_CAMERA_INDEX_BASE); // clear of the paid per-camera range
});
