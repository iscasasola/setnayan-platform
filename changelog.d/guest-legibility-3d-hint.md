## 2026-06-26 · fix(a11y): clear the guest-legibility floor regression (3D venue HUD hint)

The `lint guest legibility` CI check (Guest Legibility Floor, 2026-06-20 "Lola
Remedios" audit) was failing on `main`: the guest 3D venue view's navigation
hint — "Tap the floor to walk around · drag to look · pinch to zoom" — used
load-bearing **11px** text at `white/55`, below the floor and illegible to older
guests (the exact failure mode the audit targets). It's instructional text that
tells a guest how to move through the scene, so it can't be tiny+faint.

Bumped it to `text-xs` (12px) at `white/75`, matching the sibling HUD hints in
the same overlay (the tablemates line and the no-seat fallback already use
12px/`white/75`). `node apps/web/scripts/lint-guest-legibility.mjs` now passes —
the one over-baseline occurrence is cleared.

Note for a future pass: the baseline still tolerates **81 grandfathered
`text-[<=11px]` occurrences** across 65 guest-facing files (deliberately
baselined when the floor shipped). Burning those down — and then promoting
`lint guest legibility` to a **required** status check so regressions like this
can't merge again — is a worthwhile follow-up (flagged to the owner, not done
here since branch-protection is a policy change).

SPEC IMPACT: None — enforces the existing Guest Legibility Floor spec; no
schema / SKU / pricing / flow change.
