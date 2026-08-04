## 2026-07-29 · fix(papic): the seat camera's out-of-shots panel is reachable again

Pack seats carry no client-side cap (`photoCap`/`clipCap` are null), so the
exhausted panel — which derived only from those props — could never render for
them. Meanwhile the real exhaustion signal (`camera_points_exhausted` from
recordSeatCapture / the presign 409) only marked the individual shot `capped`
and flashed a 1.8s notice, leaving a dry camera looking like a working one that
silently refuses every shot. A page-level `outOfShots` latch now sets from both
cap-code branches (alongside PR #3874's `announceOutOfShots()` guest-buy event
— complementary: one opens the purchase sheet, this tells the shooter why the
camera stopped) and feeds the existing panel. The prop-derived trigger is kept
for seats that genuinely carry per-camera caps.

SPEC IMPACT: None
