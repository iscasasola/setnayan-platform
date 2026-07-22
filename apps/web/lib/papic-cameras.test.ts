import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeCameraQuote,
  papicCaptureCost,
  papicPerCameraTier,
  papicRungForTier,
  papicRungRate,
  papicRungSku,
  isPaidCameraTier,
  resolvePointsGate,
  isMissingRpcErrorCode,
  PAPIC_CAMERA_FREE_SKU,
  PAPIC_CAMERA_ROLL_SKU,
  PAPIC_CAMERA_MINI_SKU,
  PAPIC_CAMERA_LTD_SKU,
  PAPIC_CAMERA_UNLIMITED_SKU,
  PAPIC_FREE_CAMERA_COUNT,
  PAPIC_FREE_CAMERA_INDEX_BASE,
  PAPIC_CAMERA_INDEX_BASE,
  PAPIC_RUNGS,
  type CameraRates,
  type CameraCaps,
} from './papic-cameras';

// Money-logic guard for the PAPIC_UNLOCK "free + uncapped Unli" allowance (owner
// 2026-06-26). computeCameraQuote is the single pure source the picker (client)
// and purchasePapicCameras (server) both mirror — so its unliFree branch must be
// exactly: Unli charge → ₱0, Roll (Ltd) untouched, never "free up paid cameras"
// when unliFree is false.

const RATES: CameraRates = { mini: 30, roll: 30, ltd: 50, unlimited: 100 };
// roll==Mini (owner 2026-07-17): the roll tier caps at the MINI cap (6000);
// unlimited==Unli caps at the Unli cap. These test caps deliberately keep the
// pre-ladder values (unli 10000, not the prod 15000) so the shipped assertions
// below stay byte-comparable; the prod-shaped caps are exercised separately in
// the three-rung block at the bottom.
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

test('points cost: 1 photo = 1 point · 1 ten-second clip = 7 points', () => {
  assert.equal(papicCaptureCost('photo'), 1);
  assert.equal(papicCaptureCost('clip'), 7);
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

// ── The THREE-rung camera ladder (owner-confirmed 2026-07-20) ────────────────
// Mini ₱30 · Ltd ₱50 · Unli ₱100 per camera per day, on top of 3 free cameras.
// Prod-shaped caps: Mini ₱6,000 · Ltd ₱10,000 · Unli ₱15,000, WEDDINGS ONLY.

const LADDER_CAPS: CameraCaps = { mini: 6000, ltd: 10000, unli: 15000 };

test('three rungs bill independently at their own rates', () => {
  const q = computeCameraQuote(
    { mini: 4, ltd: 3, unlimited: 2 },
    1,
    RATES,
    LADDER_CAPS,
  );
  assert.equal(q.miniChargePhp, 120); // 4 × ₱30
  assert.equal(q.ltdChargePhp, 150); // 3 × ₱50
  assert.equal(q.unlimitedChargePhp, 200); // 2 × ₱100
  assert.equal(q.totalPhp, 470);
  assert.equal(q.paidCount, 9);
  assert.equal(q.capped, false);
});

test('days multiply every rung', () => {
  const q = computeCameraQuote({ mini: 2, ltd: 2, unlimited: 1 }, 3, RATES, LADDER_CAPS);
  assert.equal(q.miniChargePhp, 180); // 2 × ₱30 × 3d
  assert.equal(q.ltdChargePhp, 300); // 2 × ₱50 × 3d
  assert.equal(q.unlimitedChargePhp, 300); // 1 × ₱100 × 3d
  assert.equal(q.totalPhp, 780);
  assert.equal(q.days, 3);
});

test('roll and mini quote IDENTICALLY — roll is the legacy code for the Mini rung', () => {
  const asRoll = computeCameraQuote({ roll: 7 }, 2, RATES, LADDER_CAPS);
  const asMini = computeCameraQuote({ mini: 7 }, 2, RATES, LADDER_CAPS);
  assert.equal(asRoll.totalPhp, asMini.totalPhp);
  assert.equal(asRoll.miniChargePhp, asMini.miniChargePhp);
  assert.equal(asRoll.miniSubtotalPhp, asMini.miniSubtotalPhp);
  assert.equal(asRoll.miniCount, asMini.miniCount);
  assert.equal(asRoll.miniCount, 7);
  assert.equal(asRoll.ltdChargePhp, 0); // roll must NEVER leak into the ₱50 rung
  // The deprecated legacy field keeps mirroring Mini for old readers.
  assert.equal(asRoll.rollChargePhp, asMini.miniChargePhp);
  assert.equal(asRoll.rollCount, 7);
});

test('roll + mini in the same selection are ONE rung (summed, not double-capped)', () => {
  const q = computeCameraQuote({ mini: 3, roll: 4 }, 1, RATES, LADDER_CAPS);
  assert.equal(q.miniCount, 7);
  assert.equal(q.miniChargePhp, 210); // 7 × ₱30 — one line, not two
  assert.equal(q.totalPhp, 210);
});

test('wedding caps clamp EACH rung independently at its own ceiling', () => {
  // 300 Mini = ₱9,000 → ₱6,000 · 300 Ltd = ₱15,000 → ₱10,000 · 300 Unli =
  // ₱30,000 → ₱15,000. One rung blowing its cap never eats another's headroom.
  const q = computeCameraQuote(
    { mini: 300, ltd: 300, unlimited: 300 },
    1,
    RATES,
    LADDER_CAPS,
  );
  assert.equal(q.miniChargePhp, 6000);
  assert.equal(q.ltdChargePhp, 10000);
  assert.equal(q.unlimitedChargePhp, 15000);
  assert.equal(q.totalPhp, 31000);
  assert.equal(q.capped, true);
  assert.equal(q.lines.mini.capped, true);
  assert.equal(q.lines.ltd.capped, true);
  assert.equal(q.lines.unlimited.capped, true);
});

test('the Ltd rung caps at the LTD cap, not the Mini cap', () => {
  // 150 Ltd × ₱50 = ₱7,500 — over the ₱6,000 Mini cap but under the ₱10,000
  // Ltd cap, so it must bill in full. Guards the pre-v3 field-name confusion
  // where quote.ltdCapPhp carried the Mini cap.
  const q = computeCameraQuote({ ltd: 150 }, 1, RATES, LADDER_CAPS);
  assert.equal(q.ltdChargePhp, 7500);
  assert.equal(q.capped, false);
  assert.equal(q.ltdCapPhp, 10000);
  assert.equal(q.miniCapPhp, 6000);
  assert.equal(q.unliCapPhp, 15000);
});

test('non-wedding events are uncapped on ALL three rungs', () => {
  const q = computeCameraQuote(
    { mini: 300, ltd: 300, unlimited: 300 },
    1,
    RATES,
    LADDER_CAPS,
    { uncapped: true },
  );
  assert.equal(q.miniChargePhp, 9000);
  assert.equal(q.ltdChargePhp, 15000);
  assert.equal(q.unlimitedChargePhp, 30000);
  assert.equal(q.totalPhp, 54000);
  assert.equal(q.capped, false);
});

test('miniFree is the honest name for the legacy ltdFree option (both free Mini only)', () => {
  const viaLegacy = computeCameraQuote({ mini: 10, ltd: 10, unlimited: 10 }, 1, RATES, LADDER_CAPS, {
    ltdFree: true,
  });
  const viaNew = computeCameraQuote({ mini: 10, ltd: 10, unlimited: 10 }, 1, RATES, LADDER_CAPS, {
    miniFree: true,
  });
  assert.equal(viaLegacy.totalPhp, viaNew.totalPhp);
  assert.equal(viaNew.miniChargePhp, 0); // the ₱30 rung the pass was sold against
  assert.equal(viaNew.ltdChargePhp, 500); // the NEW ₱50 rung is NOT freed
  assert.equal(viaNew.unlimitedChargePhp, 1000);
  assert.equal(viaNew.totalPhp, 1500);
});

test('an empty selection quotes ₱0 with no rungs', () => {
  const q = computeCameraQuote({}, 1, RATES, LADDER_CAPS);
  assert.equal(q.totalPhp, 0);
  assert.equal(q.paidCount, 0);
  assert.equal(q.rungSummary, 'none');
});

test('the order description names every rung it bought', () => {
  const q = computeCameraQuote({ mini: 2, ltd: 1, unlimited: 3 }, 2, RATES, LADDER_CAPS);
  assert.equal(q.rungSummary, '2 Mini + 1 Ltd + 3 Unli');
  assert.equal(q.description, 'Papic cameras — 2 Mini + 1 Ltd + 3 Unli · 2 days');
});

// ── Rung ↔ tier plumbing ────────────────────────────────────────────────────

test('papicRungForTier folds the legacy roll code into Mini', () => {
  assert.equal(papicRungForTier('roll'), 'mini');
  assert.equal(papicRungForTier('mini'), 'mini');
  assert.equal(papicRungForTier('ltd'), 'ltd');
  assert.equal(papicRungForTier('unlimited'), 'unlimited');
  assert.equal(papicRungForTier('free'), null); // free is not a paid rung
  assert.equal(papicRungForTier(null), null);
});

test('every paid tier is money-gated; only free is not', () => {
  for (const tier of ['roll', 'mini', 'ltd', 'unlimited'] as const) {
    assert.equal(isPaidCameraTier(tier), true, `${tier} must be paid-gated`);
  }
  assert.equal(isPaidCameraTier('free'), false);
  assert.equal(isPaidCameraTier(null), false);
});

test('each rung bills against its own catalog SKU', () => {
  assert.equal(papicRungSku('mini'), PAPIC_CAMERA_MINI_SKU);
  assert.equal(papicRungSku('ltd'), PAPIC_CAMERA_LTD_SKU);
  assert.equal(papicRungSku('unlimited'), PAPIC_CAMERA_UNLIMITED_SKU);
  // Three distinct rungs must never collapse onto one SKU.
  assert.equal(new Set(PAPIC_RUNGS.map(papicRungSku)).size, 3);
});

test('papicRungRate reads the live rate per rung', () => {
  assert.equal(papicRungRate(RATES, 'mini'), 30);
  assert.equal(papicRungRate(RATES, 'ltd'), 50);
  assert.equal(papicRungRate(RATES, 'unlimited'), 100);
});

test('mini/ltd per-camera seats ARE metered by the points gate', () => {
  assert.equal(papicPerCameraTier(PAPIC_CAMERA_MINI_SKU, 'mini'), 'mini');
  assert.equal(papicPerCameraTier(PAPIC_CAMERA_LTD_SKU, 'ltd'), 'ltd');
  // The legacy roll seat keeps working unchanged.
  assert.equal(papicPerCameraTier(PAPIC_CAMERA_ROLL_SKU, 'roll'), 'roll');
});
